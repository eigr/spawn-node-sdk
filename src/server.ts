import { ActorInvocation, ActorInvocationResponse } from '@protos/eigr/functions/protocol/actors/protocol';
import { Any } from '@protos/google/protobuf/any';
import http from 'node:http'
import { GlobalEmitter } from 'global_event_emitter'

function findCommandMetadata(registeredActors: Function[], commandName: string): any {
    for (const actorClass of registeredActors) {
        const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass)

        if (commandMetadata) {
            const { actorType } = Reflect.getMetadata('actor:metadata', actorClass)

            return { actorType, commandFunc: commandMetadata.function, messageType: commandMetadata.message }
        }
    }

    return {}
}

export function startServer(systemClass: Function, port = 8090) {
    http.createServer((req, res) => {
        if (req.url === '/api/v1/actors/actions') {
            req.on('data', buffer => {
                const { currentContext, actorName, actorSystem, commandName, value } = ActorInvocation.fromBinary(buffer)

                const registeredActors: Function[] = Reflect.getMetadata(`actor:collection:${actorSystem}`, systemClass)
                
                const { actorType, messageType, commandFunc } = findCommandMetadata(registeredActors, commandName)
                const commandValue = actorType.fromBinary(Any.create(currentContext?.state).value)
                const commandMessage = value && messageType.fromBinary(Any.create(value).value)
                
                const modifiedState = commandFunc(...[commandMessage].filter(v => v), {state: commandValue})
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
        
                const buf = ActorInvocationResponse.toBinary(resp)
                    
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-disposition': 'attachment; filename=data.json'
                });
                res.write(buf);
                res.end();
            });

            return;
        }

        res.writeHead(404, {})
        res.write([]);
        res.end();
    }).listen(port)
}
