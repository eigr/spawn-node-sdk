import { ActorSystem, Registry, ActorState, Actor, ActorSnapshotStrategy, ActorDeactivateStrategy, TimeoutStrategy } from '@protos/eigr/functions/protocol/actors/actor'
import { RegistrationRequest, InvocationRequest, ServiceInfo } from '@protos/eigr/functions/protocol/actors/protocol'
import { Any } from '@protos/google/protobuf/any'
import { register, invoke } from 'node_fetch_client'
import { startServer } from 'server'
import type { ActorMetadata } from 'decorators/actor'
import { GlobalEmitter } from 'global_event_emitter'
import { Value } from 'actor_context'

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
    actorEntities: {[key: string]: any} = {}
    actorClasses: {[key: string]: any} = {}

    constructor() {
        startServer(this.constructor)
    }

    init(actorDefinitions: Function[] = [], systemName = this.actorSystem.name, serviceInfo: ServiceInfo = this.serviceInfo) {
        Reflect.defineMetadata(`actor:collection:${systemName}`, actorDefinitions, this.constructor)

        this.serviceInfo = serviceInfo

        const actors = this.buildActors(actorDefinitions)
        const actorRegistries = actors.reduce((acc: object, [name, _class, _entity, actor]: [string, Function, Function, Actor]) => ({...acc, [name]: actor}), {})
        const actorEntities = actors.reduce((acc: object, [name, _class, entity, _actor]: [string, Function, Function, Actor]) => ({...acc, [name]: entity}), {})
        const actorClasses = actors.reduce((acc: object, [name, entityClass, _entity, _actor]: [string, Function, Function, Actor]) => ({...acc, [name]: entityClass}), {})

        this.registry = { actors: actorRegistries } as Registry
        this.actorEntities = actorEntities
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

    async invoke(actorName: string, commandName: string, message: object | null = null): Promise<Value<any>> {
        const actor = this.registry.actors[actorName]
        const actorEntity = this.actorEntities[actorName]
        const actorClass = this.actorClasses[actorName]

        if (!actorClass) {
            throw new Error(`Actor ${actorClass.name} is not registered`)
        }

        let request: InvocationRequest = {
            system: this.actorSystem,
            actor: actor,
            commandName: commandName,
            async: false
        }

        if (message) {
            request.value = Any.pack(message, actorEntity)
        }

        const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass)

        if (!commandMetadata) {
            throw new Error(`Command ${commandName} for actor ${actorClass.name} is not registered`)
        }

        if (commandMetadata.responseType === 'noreply') {
            await invoke(request)

            return undefined
        }

        const promise = new Promise<Value<any>>((resolve, reject) => {
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

            return [...acc, [actorMeta.name, actorEntity, actorMeta.actorType, this.buildActorFromMetadata(actorMeta)]]
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