import { ActorSystem, Registry, ActorState, Actor, ActorSnapshotStrategy, ActorDeactivateStrategy, TimeoutStrategy } from './protos/eigr/functions/protocol/actors/actor'
import { RegistrationRequest, InvocationRequest, ServiceInfo } from './protos/eigr/functions/protocol/actors/protocol'
import { Any } from './protos/google/protobuf/any'
import { register, invoke } from './integration/node_fetch_client'
import { startServer } from './integration/server'
import type { ActorMetadata } from './decorators/actor'
import { GlobalEmitter } from './integration/global_event_emitter'
import { Value } from './client_actor/actor_context'
import { SpawnInvocationWrongOutput } from './integration/errors'
import { MessageType } from "@protobuf-ts/runtime";
import type { Server } from 'node:http'

class SpawnSystem {
    private serviceInfo: ServiceInfo = {
        serviceName: 'nodejs_sdk',
        serviceVersion: '0.1.0',
        serviceRuntime: `nodejs_${process.version}`,
        supportLibraryName: '',
        supportLibraryVersion: '',
        protocolMajorVersion: 1,
        protocolMinorVersion: 1,
    }

    private registry: Registry = {
        actors: {}
    }

    private actorSystem: ActorSystem = {
        name: 'actor_system'
    };

    private registrationRequest: RegistrationRequest = {}
    private actorClasses: {[key: string]: any} = {}
    private httpServer: Server;

    constructor() {
        this.httpServer = startServer(this.constructor)
    }

    init(actorDefinitions: Function[] = [], systemName = this.actorSystem.name, serviceInfo: ServiceInfo = this.serviceInfo) {
        Reflect.defineMetadata(`actor:collection:${systemName}`, actorDefinitions, this.constructor)

        this.serviceInfo = serviceInfo

        const actors = this.buildActors(actorDefinitions)
        const actorRegistries = actors.reduce((acc: object, [name, _class, _entity, actor]: [string, Function, Function, Actor]) => ({...acc, [name]: actor}), {})
        const actorClasses = actors.reduce((acc: object, [name, entityClass, _entity, _actor]: [string, Function, Function, Actor]) => ({...acc, [name]: entityClass}), {})

        this.registry = { actors: actorRegistries } as Registry
        this.actorClasses = actorClasses

        this.actorSystem = {
            name: systemName,
            registry: this.registry
        } as ActorSystem

        this.registrationRequest = {
            serviceInfo: this.serviceInfo,
            actorSystem: this.actorSystem
        } as RegistrationRequest

        register(this.registrationRequest)
            .then(_regResponse => {
                console.log('[SpawnSystem] Actors registered successfully')
            })
    }

    async invoke(actorName: string, commandName: string, outputType: MessageType<object>, message: object | null = null): Promise<Value<any>> {
        const actor = this.registry.actors[actorName]
        const actorClass = this.actorClasses[actorName]

        let request: InvocationRequest = {
            system: this.actorSystem,
            actor: this.invocationActor(actorName, actor),
            commandName: commandName,
            async: false
        }
        
        Reflect.defineMetadata(`actor:invoke:output:${this.actorSystem.name}:${actorName}:${commandName}`, outputType, this.constructor)
        
        if (actorClass) {
            const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass)

            if (message) {
                request.value = Any.pack(message, commandMetadata.message)
            }
            
            if (commandMetadata?.responseType === 'noreply') {
                await invoke(request)

                return undefined
            }
        }

        const promise = new Promise<Value<any>>((resolve, _reject) => {
            GlobalEmitter.once(`actor:command:${this.actorSystem.name}:${actorName}:${commandName}`, function (data) {
                if (!data) {
                    return resolve(data)
                }
                
                if (Any.is(data)) {
                    try {
                        data = Any.unpack(data, outputType)
                    } catch {
                        throw new SpawnInvocationWrongOutput(`The actor doesnt return the referenced output type, got: ${data.typeUrl}, expected: ${outputType.constructor.name}`)
                    }
                }

                if (!outputType.is(data)) {
                    throw new SpawnInvocationWrongOutput(`The actor doesnt return the referenced output type, got: ${JSON.stringify(data)}, expected instance of: ${outputType.constructor.name}`)
                }
                
                resolve(data)
            });
        });

        await invoke(request)

        return promise;
    }

    getServer(): Server {
        return this.httpServer
    }

    private buildActors(actorDefinitions: Function[]) {
        return actorDefinitions.reduce((acc: any[], actorEntity) => {
            const actorMeta = Reflect.getMetadata('actor:metadata', actorEntity) as ActorMetadata

            if (!actorMeta) {
                return acc;
            }

            return [...acc, [actorMeta.name, actorEntity, actorMeta.actorType, this.buildActorFromMetadata(actorMeta)]]
        }, [])
    }

    private invocationActor(name: string, actor?: Actor): Actor {
        if (actor) return actor;

        return Actor.create({
            name,
            persistent: true
        })
    }

    private buildActorFromMetadata(prop: ActorMetadata): Actor {
        let actorState: ActorState = {
            tags: {},
            state: Any.pack(prop.instance, prop.actorType)
        }
    
        let timeoutSnapshot: TimeoutStrategy = {
            timeout: prop.opts.snapshotTimeout,
        }
    
        let snapshotStrategy: ActorSnapshotStrategy = {
            strategy: {
                oneofKind: 'timeout',
                timeout: timeoutSnapshot
            }
        }
    
        let timeoutDeactivate: TimeoutStrategy = {
            timeout: prop.opts.deactivatedTimeout,
        }
    
        let deactivateStrategy: ActorDeactivateStrategy = {
            strategy: {
                oneofKind: 'timeout',
                timeout: timeoutDeactivate
            }
        }
    
        return {
            name: prop.name,
            persistent: prop.opts.persistent,
            state: actorState,
            snapshotStrategy: snapshotStrategy,
            deactivateStrategy: deactivateStrategy
        }
    }
}

export default new SpawnSystem()