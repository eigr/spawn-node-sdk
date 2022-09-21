import {
  ActorSystem,
  Registry,
  ActorState,
  Actor,
  ActorSnapshotStrategy,
  ActorDeactivateStrategy,
  TimeoutStrategy
} from './protos/eigr/functions/protocol/actors/actor';
import {
  RegistrationRequest,
  InvocationRequest,
  ServiceInfo
} from './protos/eigr/functions/protocol/actors/protocol';
import { Any } from './protos/google/protobuf/any';
import { register, invoke } from './integration/node_fetch_client';
import { startServer } from './integration/server';
import type { ActorMetadata } from './decorators/actor';
import GlobalEmitter from './integration/global_event_emitter';
import { Value } from './client_actor/actor_context';
import { SpawnInvocationWrongOutput, SpawnInvocationMissingResponse } from './integration/errors';
import { PartialMessage, MessageType } from '@protobuf-ts/runtime';
import type { Server } from 'node:http';

export type InvokeOpts = {
  command: string;
  message?: PartialMessage<object>;
  response?: MessageType<object>;
  timeout?: number;
};

class SpawnSystem {
  private serviceInfo: ServiceInfo = {
    serviceName: 'nodejs_sdk',
    serviceVersion: '0.1.0',
    serviceRuntime: `nodejs_${process.version}`,
    supportLibraryName: '',
    supportLibraryVersion: '',
    protocolMajorVersion: 1,
    protocolMinorVersion: 1
  };

  private registry: Registry = {
    actors: {}
  };

  private actorSystem: ActorSystem = {
    name: 'actor_system'
  };

  private registrationRequest: RegistrationRequest = {};
  private actorClasses: { [key: string]: any } = {};
  private httpServer: Server;

  private defaultMethods = ['get', 'Get', 'get_state', 'getState', 'GetState'];

  constructor() {
    this.httpServer = startServer(this.constructor);
  }

  // TODO: This shouldn't save in memory the actor definitions in registry and all.
  // every actor building structure should be lazy-loaded in invokes
  async init(
    actorDefinitions: Function[] = [],
    systemName = this.actorSystem.name,
    shouldRegister: boolean = true,
    serviceInfo: ServiceInfo = this.serviceInfo
  ) {
    Reflect.defineMetadata(`actor:collection:${systemName}`, actorDefinitions, this.constructor);

    this.serviceInfo = serviceInfo;

    const actors = this.buildActors(actorDefinitions);
    const actorRegistries = actors.reduce(
      (acc: object, [name, _class, _entity, actor]: [string, Function, Function, Actor]) => ({
        ...acc,
        [name]: actor
      }),
      {}
    );
    const actorClasses = actors.reduce(
      (acc: object, [name, entityClass, _entity, _actor]: [string, Function, Function, Actor]) => ({
        ...acc,
        [name]: entityClass
      }),
      {}
    );

    this.registry = { actors: actorRegistries } as Registry;
    this.actorClasses = actorClasses;

    this.actorSystem = {
      name: systemName,
      registry: this.registry
    } as ActorSystem;

    this.registrationRequest = {
      serviceInfo: this.serviceInfo,
      actorSystem: this.actorSystem
    } as RegistrationRequest;

    if (shouldRegister) {
      await register(this.registrationRequest).then((_regResponse) => {
        console.log('[SpawnSystem] Actors registered successfully');
      });
    }
  }

  async invoke(actorName: string, opts: InvokeOpts): Promise<Value<any>> {
    const { command: commandName, response, message } = opts;

    const actor = this.registry.actors[actorName];
    const actorClass = this.actorClasses[actorName];

    let request: InvocationRequest = {
      system: this.actorSystem,
      actor: this.invocationActor(actorName, actor),
      commandName: commandName,
      async: !response
    };

    if (response) {
      Reflect.defineMetadata(
        `actor:invoke:output:${this.actorSystem.name}:${actorName}:${commandName}`,
        response,
        this.constructor
      );
    }

    if (actorClass) {
      const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass);

      if (message) {
        request.value = Any.pack(message, commandMetadata.message);
      }

      if (commandMetadata?.responseType === 'noreply') {
        await invoke(request);

        return;
      } else if (!response) {
        throw new SpawnInvocationMissingResponse(
          `This actor command (${commandName}) is set to reply mode or doesn't exist, you need to set a response attribute in the invocation`
        );
      }
    }

    const invokeResponsePromise = new Promise<Value<any>>(async (resolve, _reject) => {
      const eventName = `actor:command:${this.actorSystem.name}:${actorName}:${commandName}`;

      console.debug(`Registered to commands in topic: ${eventName}`);

      const responseHandler = function (data: any) {
        console.debug(
          `Received response data for: ${eventName} with: ${data && JSON.stringify(data)}`
        );

        if (!data) {
          return resolve(data);
        }

        if (Any.is(data)) {
          try {
            data = Any.unpack(data, response!);
          } catch {
            throw new SpawnInvocationWrongOutput(
              `The actor doesnt return the referenced output type, got: ${
                data.typeUrl
              }, expected: ${response!.constructor.name}`
            );
          }
        }

        if (!response!.is(data)) {
          throw new SpawnInvocationWrongOutput(
            `The actor doesnt return the referenced output type, got: ${JSON.stringify(
              data
            )}, expected instance of: ${response!.constructor.name}`
          );
        }

        resolve(data);
      };

      GlobalEmitter.once(eventName, responseHandler);

      const res = await invoke(request);

      if (this.defaultMethods.indexOf(commandName) > -1) {
        console.debug(`Responding directly with proxy result for: ${eventName}`);
        GlobalEmitter.off(eventName, responseHandler);

        responseHandler(res.value);
      }
    });

    if (opts.timeout) {
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(`Promise timeout reached (limit: ${opts.timeout} ms)`),
          opts.timeout
        )
      );

      return Promise.race([timeout, invokeResponsePromise]);
    }

    return invokeResponsePromise;
  }

  getServer(): Server {
    return this.httpServer;
  }

  private buildActors(actorDefinitions: Function[]) {
    return actorDefinitions.reduce((acc: any[], actorEntity) => {
      const actorMeta = Reflect.getMetadata('actor:metadata', actorEntity) as ActorMetadata;

      if (!actorMeta) {
        return acc;
      }

      return [
        ...acc,
        [actorMeta.name, actorEntity, actorMeta.actorType, this.buildActorFromMetadata(actorMeta)]
      ];
    }, []);
  }

  private invocationActor(name: string, actor?: Actor): Actor {
    if (actor) return actor;

    return Actor.create({
      name,
      persistent: true
    });
  }

  private buildActorFromMetadata(prop: ActorMetadata): Actor {
    let actorState: ActorState = {
      tags: {},
      state: Any.pack(prop.instance, prop.actorType)
    };

    let timeoutSnapshot: TimeoutStrategy = {
      timeout: prop.opts.snapshotTimeout
    };

    let snapshotStrategy: ActorSnapshotStrategy = {
      strategy: {
        oneofKind: 'timeout',
        timeout: timeoutSnapshot
      }
    };

    let timeoutDeactivate: TimeoutStrategy = {
      timeout: prop.opts.deactivatedTimeout
    };

    let deactivateStrategy: ActorDeactivateStrategy = {
      strategy: {
        oneofKind: 'timeout',
        timeout: timeoutDeactivate
      }
    };

    return {
      name: prop.name,
      persistent: prop.opts.persistent,
      state: actorState,
      snapshotStrategy: snapshotStrategy,
      deactivateStrategy: deactivateStrategy
    };
  }
}

export default new SpawnSystem();
