import { ActorSystem, Registry, ActorState, Actor, ActorSnapshotStrategy, ActorDeactivateStrategy, TimeoutStrategy } from '@protos/eigr/functions/protocol/actors/actor'
import { RegistrationRequest, InvocationRequest, ServiceInfo } from '@protos/eigr/functions/protocol/actors/protocol'
import { Any } from '@protos/google/protobuf/any'
import { register, invoke } from 'node_fetch_client'
import { startServer } from 'server'
import type { ActorMetadata } from 'decorators/actor'
import { GlobalEmitter } from 'global_event_emitter'

class SpawnSystem {
    serviceInfo: ServiceInfo = {
        serviceName: 'nodejs_sdk',
        serviceVersion: '0.1.0',
        serviceRuntime: `nodejs_${process.version}`,
        supportLibraryName: '',
        supportLibraryVersion: '',
        protocolMajorVersion: 1,
        protocolMinorVersion: 1,
    }

    registry: Registry = {
        actors: {}
    }

    actorSystem: ActorSystem = {
        name: 'actor_system'
    };

    registrationRequest: RegistrationRequest = {}
    actorClasses: {[key: string]: any} = {}

    constructor() {
        startServer(this.constructor)
    }

    init(actorDefinitions: Function[] = [], systemName = this.actorSystem.name, serviceInfo: ServiceInfo = this.serviceInfo) {
        Reflect.defineMetadata(`actor:collection:${systemName}`, actorDefinitions, this.constructor)

        this.serviceInfo = serviceInfo

        const actors = this.buildActors(actorDefinitions)
        const actorRegistries = actors.reduce((acc: object, [name, _entity, actor]: [string, Function, Actor]) => ({...acc, [name]: actor}), {})
        const actorClasses = actors.reduce((acc: object, [name, entity, _actor]: [string, Function, Actor]) => ({...acc, [name]: entity}), {})

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

    async invoke(actorName: string, commandName: string, message: object | null = null) {
        const actor = this.registry.actors[actorName]

        let request: InvocationRequest = {
            system: this.actorSystem,
            actor: actor,
            commandName: commandName,
            async: false
        }

        if (message) {
            request.value = Any.pack(message, this.actorClasses[actorName])
        }

        const promise = new Promise((resolve, reject) => {
            GlobalEmitter.once(`actor:command:${this.actorSystem.name}:${actorName}:${commandName}`, function (data) {
                resolve(data)
            });
        });

        await invoke(request)

        return promise;
    }

    private buildActors(actorDefinitions: Function[]) {
        return actorDefinitions.reduce((acc: any[], actorEntity) => {
            const actorMeta = Reflect.getMetadata('actor:metadata', actorEntity) as ActorMetadata

            if (!actorMeta) {
                return acc;
            }

            return [...acc, [actorMeta.name, actorMeta.actorType, this.buildActorFromMetadata(actorMeta)]]
        }, [])
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