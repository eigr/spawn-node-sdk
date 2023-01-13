import { registerRequest, invokeRequest } from "./integration/node-fetch-client";
import { Actor, ActorId, ActorSystem, Registry } from './protos/eigr/functions/protocol/actors/actor';
import { InvocationRequest, Noop, RegistrationRequest, RegistrationResponse, ServiceInfo } from "./protos/eigr/functions/protocol/actors/protocol";
import { ActorContext } from "./client-actor/context";
import { SpawnSystemRegisteredError } from "./integration/errors";
import { ActorOpts, buildActorForSystem, defaultActorOpts } from "./client-actor/definitions";
import { buildPayload, parseScheduledTo, PayloadRef, scheduledToBigInt, unpack, unpackPayload } from "./integration/parsers";
import { startServer } from "./integration/server";
import { MessageType } from '@protobuf-ts/runtime';
import { Value } from "./client-actor/value";

/**
 * Action definition opts
 * - name: Name of the action
 * - timer: It means this action will be executed every X milliseconds
 */
export type ActorActionOpts = {
  name: string
  payloadType: MessageType<any>,
  timer?: number
}

export type ActorActionCallback<T extends object = any, K extends object = any> = (context: ActorContext<T>, payload: any) => Promise<Value<T, K>>
export type ActorCallbackConnector = { stateType: any, payloadType: any, callback: ActorActionCallback }

let uniqueDefaultSystem = 'spawn_system'
let systemCreated = false

const createSystem = (system: string = uniqueDefaultSystem) => {
  if (systemCreated) throw new SpawnSystemRegisteredError("This API currently supports only one system per runtime.")

  uniqueDefaultSystem = system
  systemCreated = true

  const serviceInfo = {
    serviceName: 'nodejs_sdk',
    serviceVersion: '0.1.0',
    serviceRuntime: `nodejs_${process.version}`,
    supportLibraryName: '',
    supportLibraryVersion: '',
    protocolMajorVersion: 1,
    protocolMinorVersion: 1
  } as ServiceInfo;

  const registry = { actors: {} } as Registry;
  const actorSystem = { name: system, registry } as ActorSystem;
  const registeredCallbacks = new Map<string, ActorCallbackConnector>()
  let registered = false

  startServer(registeredCallbacks)

  return {
    /**
     * Builds an actor for this system with the following default options:
     * 
     * - kind: POOLED
     * - stateful: true
     * - snapshotTimeout: 10_000n
     * - deactivatedTimeout: 2_000n
     * 
     * @param opts - options for creating the actor
     */
    buildActor: (opts: ActorOpts) => {
      const registeredErrorMsg = `You cannot build more actors after registering the system. If you are trying to add dynamic actors or actions, you are probably mising some concept`
      if (registered) throw new SpawnSystemRegisteredError(registeredErrorMsg)
      
      const overridenOpts = {...defaultActorOpts, ...opts}
      const actor = buildActorForSystem(system, overridenOpts)
      const actorName = actor!.id!.name

      registry.actors[actorName] = actor

      return {
        /**
         * Use Noop payload if you don't need to interact with payload
         * @param {ActorActionOpts} actionOpts - The name of the actor on which the command is to be invoked
         * @param {ActorActionCallback} callback - The callback that spawn will route to when invoking this action
         * - name: Name of the action
         * - payloadType: The type of the payload you will use in this action
         * - timer: It means this action will be executed every X milliseconds
         */
        addAction: (actionOpts: ActorActionOpts, callback: ActorActionCallback) => {
          if (registered) throw new SpawnSystemRegisteredError(registeredErrorMsg)

          if (actionOpts.timer) {
            actor.timerCommands.push({ command: { name: actionOpts.name }, seconds: actionOpts.timer })
          } else {
            actor.commands.push({ name: actionOpts.name })
          }

          registeredCallbacks.set(
            `${system}${actorName}${actionOpts.name}`,
            {
              callback,
              stateType: opts.stateType || Noop,
              payloadType: actionOpts.payloadType || Noop,
            }
          )
        }
      }
    },
    register: async (): Promise<RegistrationResponse> => {
      const registrationRequest = { serviceInfo, actorSystem } as RegistrationRequest;
      return registerRequest(registrationRequest).then((response) => {
        registered = true

        return response;
      })
    }
  }
}

export type InvokeOpts = {
  command: string;
  system?: string;
  response?: MessageType<any>;
  payload?: PayloadRef<any>;
  async?: boolean;
  pooled?: boolean;
  metadata?: { [key: string]: string };
  ref?: string;
  scheduledTo?: Date;
  delay?: number;
}

/**
 * A utility function that allows for the invocation of a specific command on an actor by name.
 *
 * @param {string} actorName - The name of the actor on which the command is to be invoked
 * @param {InvokeOpts} invokeOpts - An object containing the fields that specify the details of the command invocation
 * @returns {Promise<any>} - a promise that resolves to the response payload of the command or null if no response is specified
 *
 * InvokeOpts fields:
 * - command - The command to be executed
 * - system - (optional, defaults to current registered system) The system that the actor belongs to
 * - response - (optional) The expected response type
 * - payload - (optional) The payload to be passed to the command
 * - async - (optional) Whether the command should be executed asynchronously
 * - pooled - (optional) Whether the command should be executed in a pooled actor
 * - metadata - (optional) Additional metadata to be passed to the command
 * - ref - (optional) A reference to the actor if you want to also spawn it during invocation
 * - scheduledTo - (optional) The scheduled date to be executed
 * - delay - (optional) The delay in ms this will be invoked
 */
const invoke = async (actorName: string, invokeOpts: InvokeOpts) => {
  let async = invokeOpts.async || false;
  let system = invokeOpts.system || uniqueDefaultSystem;
  let pooled = invokeOpts.pooled || false;
  let metadata = invokeOpts.metadata || {};

  const request = InvocationRequest.create({
    system: ActorSystem.create({ name: system }),
    actor: Actor.create({
      id: ActorId.create({ name: actorName, system: system })
    }),
    metadata: metadata,
    payload: buildPayload(invokeOpts.payload),
    commandName: invokeOpts.command,
    async: async,
    caller: undefined,
    pooled: pooled,
    scheduledTo: scheduledToBigInt(parseScheduledTo(invokeOpts.delay, invokeOpts.scheduledTo))
  })

  const { payload } = await invokeRequest(request)

  if (invokeOpts.response) {
    return unpackPayload(payload, invokeOpts.response)
  }

  return null
}

// TODO: Spawn Actor
const spawnActor = async () => {

}

export const payloadFor = (type: MessageType<any>, value: any): PayloadRef => {
  return { ref: type, instance: type.create(value) }
}

export default { createSystem, invoke, payloadFor }
