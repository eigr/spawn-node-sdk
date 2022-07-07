import { ActorInvocation, ActorInvocationResponse } from '../protos/eigr/functions/protocol/actors/protocol';
import { Any } from '../protos/google/protobuf/any';
import http, { ServerResponse } from 'node:http'
import { GlobalEmitter } from '../integration/global_event_emitter'
import { ActorContext } from '../client_actor/actor_context'
import { MessageType } from "@protobuf-ts/runtime";

function findCommandMetadata(registeredActors: Function[], commandName: string): any | null {
    for (const actorClass of registeredActors) {
        const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass)

        if (commandMetadata) {
            const { actorType } = Reflect.getMetadata('actor:metadata', actorClass)

            return { actorType, commandFunc: commandMetadata.function, messageType: commandMetadata.message, responseType: commandMetadata.responseType }
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

export function startServer(systemClass: Function, port = process.env.SPAWN_ACTION_PORT || 8090) {
    return http.createServer((req, res) => {
        if (req.url === '/api/v1/actors/actions') {
            req.on('data', buffer => {
                const { currentContext, actorName, actorSystem, commandName, value } = ActorInvocation.fromBinary(buffer)
                const registeredActors: Function[] = Reflect.getMetadata(`actor:collection:${actorSystem}`, systemClass)
                const metadata = findCommandMetadata(registeredActors, commandName)
                const outputType = Reflect.getMetadata(`actor:invoke:output:${actorSystem}:${actorName}:${commandName}`, systemClass) as MessageType<object>

                if (!metadata) {
                    const resp: ActorInvocationResponse = {
                        actorName,
                        actorSystem,
                        updatedContext: currentContext,
                        value
                    }

                    GlobalEmitter.emit(`actor:command:${actorSystem}:${actorName}:${commandName}`, Any.create(currentContext?.state))

                    return sendResponse(200, res, resp)
                }

                const { actorType, messageType, commandFunc } = metadata

                const commandValue = actorType.fromBinary(Any.create(currentContext?.state).value)
                const commandMessage = value && messageType?.fromBinary(Any.create(value).value)

                const commandContext = new ActorContext<typeof commandValue>(commandValue)
                
                const returnValue = commandFunc(...[commandMessage].filter(v => v), commandContext)
                GlobalEmitter.emit(`actor:command:${actorSystem}:${actorName}:${commandName}`, returnValue)
                
                let resp: ActorInvocationResponse = {
                    actorName,
                    actorSystem,
                    updatedContext: {
                        state: Any.pack(commandContext.getState(), actorType)
                    }
                }
                
                if (returnValue && outputType.is(returnValue)) {
                    resp.value = Any.pack(returnValue, outputType)
                }

                sendResponse(200, res, resp)
            });

            return;
        }

        sendResponse(404, res)
    })
    .listen(port, () => {
        console.log(`[SpawnSystem] Server listening on :${port}`)
    })
}
