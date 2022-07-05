import { ActorInvocation, ActorInvocationResponse } from '@protos/eigr/functions/protocol/actors/protocol';
import { Any } from '@protos/google/protobuf/any';
import http, { ServerResponse } from 'node:http'
import { GlobalEmitter } from 'global_event_emitter'
import { ActorContext } from 'actor_context'

function findCommandMetadata(registeredActors: Function[], commandName: string): any | null {
    for (const actorClass of registeredActors) {
        const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass)

        if (commandMetadata) {
            const { actorType } = Reflect.getMetadata('actor:metadata', actorClass)

            return { actorType, commandFunc: commandMetadata.function, messageType: commandMetadata.message }
        }
    }

    return null;
}

function sendResponse(status: number, res: ServerResponse, resp: any = null) {
    if (status !== 200 || !resp) {
        res.writeHead(status, {});
        res.write([]);
        res.end();

        return;
    }

    const buf = ActorInvocationResponse.toBinary(resp)

    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-disposition': 'attachment; filename=data.json'
    });
    res.write(buf);
    res.end();
}

export function startServer(systemClass: Function, port = 8090) {
    http.createServer((req, res) => {
        if (req.url === '/api/v1/actors/actions') {
            req.on('data', buffer => {
                const { currentContext, actorName, actorSystem, commandName, value } = ActorInvocation.fromBinary(buffer)
                const registeredActors: Function[] = Reflect.getMetadata(`actor:collection:${actorSystem}`, systemClass)
                const metadata = findCommandMetadata(registeredActors, commandName)

                if (!metadata) {
                    const resp: ActorInvocationResponse = {
                        actorName,
                        actorSystem,
                        updatedContext: currentContext,
                        value
                    }

                    return sendResponse(200, res, resp)
                }

                const { actorType, messageType, commandFunc } = metadata

                const commandValue = actorType.fromBinary(Any.create(currentContext?.state).value)
                const commandMessage = value && messageType.fromBinary(Any.create(value).value)
                const commandContext = new ActorContext<typeof commandValue>(commandValue)
                
                let modifiedState = commandFunc(...[commandMessage].filter(v => v), commandContext)
                if (modifiedState === undefined) {
                    modifiedState = commandContext.state
                }

                const newState = Any.pack(modifiedState, actorType)
                
                GlobalEmitter.emit(`actor:command:${actorSystem}:${actorName}:${commandName}`, modifiedState)
                
                const resp: ActorInvocationResponse = {
                    actorName,
                    actorSystem,
                    updatedContext: {
                        state: newState
                    },
                    value
                }
                    
                sendResponse(200, res, resp)
            });

            return;
        }

        sendResponse(404, res)
    }).listen(port)
}
