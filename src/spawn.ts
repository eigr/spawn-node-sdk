import { registerRequest, invokeRequest, spawnActorRequest } from './integration/node-fetch-client'
import {
  Actor,
  ActorId,
  ActorSystem,
  Registry
} from './protos/eigr/functions/protocol/actors/actor'
import {
  InvocationRequest,
  Noop,
  RegistrationRequest,
  RegistrationResponse,
  ServiceInfo,
  SpawnRequest,
  SpawnResponse
} from './protos/eigr/functions/protocol/actors/protocol'
import { ActorContext } from './client-actor/workflows'
import { SpawnSystemRegisteredError } from './integration/errors'
import { ActorOpts, buildActorForSystem, defaultActorOpts } from './client-actor/definitions'
import {
  buildPayload,
  parseScheduledTo,
  PayloadRef,
  scheduledToBigInt,
  unpackPayload
} from './integration/parsers'
import { startServer } from './integration/server'
import { MessageType } from '@protobuf-ts/runtime'
import { Value } from './client-actor/value'

/**
 * Action definition opts
 * - name: Name of the action
 * - timer: It means this action will be executed every X milliseconds
 */
export type ActorActionOpts = {
  name: string
  payloadType?: MessageType<any> | 'json'
  timer?: number
}

export type ActorActionCallback<T extends object = any, K extends object = any> = (
  context: ActorContext<T>,
  payload: any
) => Promise<Value<T, K>>

export type ActorCallbackConnector = {
  stateType: MessageType<any> | 'json'
  payloadType: MessageType<any> | 'json'
  callback: ActorActionCallback
}

export type SpawnSystem = {
  buildActor: (opts: ActorOpts) => {
    addAction: (actionOpts: ActorActionOpts, callback: ActorActionCallback) => void
  }
  register: () => Promise<RegistrationResponse>
  destroy: () => Promise<any>
}

let uniqueDefaultSystem = 'spawn_system'
let systemCreated = false

/**
 * Creates the spawn system
 * You need to call `register` after every actor and action has been registered and added.
 * 
 * Think of this as adding REST routes, its the same, you have to define all actions (routes) your actors are going to handle
 * 
 * `Limitation`: You can't create two systems instance in the same runtime
 * 
 * ## Example:
 * ```
    // builds system
    const system = spawn.createSystem('spawn_system_example')

    // builds the actor
    const actor = system.buildActor({
      name: 'user_actor_example',
      stateType: UserState,
      stateful: true
    })

    // adds a action handler to the actor
    actor.addAction(
      { name: 'setName', payloadType: ChangeUserName },
      async (context: ActorContext<UserState>, message: ChangeUserName) => {
        const response = ChangeUserNameResponse.create({
          newName: message.newName,
          status: ChangeUserNameStatus.OK
        })

        return Value.of<UserState, ChangeUserNameResponse>()
          .state({ ...context.state, name: message.newName })
          .response(ChangeUserNameResponse, response)
      }
    )

    // finally register all systems
    await system.register()

    // to invoke you would do something like
    const changeUserNameResponse = await spawn.invoke('user_actor_example', {
      action: 'setName',
      payload: payloadFor(ChangeUserName, { newName: 'new_user_name' }),
      response: ChangeUserNameResponse
    }) as ChangeUserNameResponse
```
 * 
 * @param {string} system - System name, defaults to `spawn_system`
 * @returns SpawnSystem
 */
const createSystem = (system: string = uniqueDefaultSystem): SpawnSystem => {
  if (systemCreated)
    throw new SpawnSystemRegisteredError('This API currently supports only one system per runtime.')

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
  } as ServiceInfo

  const registry = { actors: {} } as Registry
  const actorSystem = { name: system, registry } as ActorSystem
  const registeredCallbacks = new Map<string, ActorCallbackConnector>()
  let registered = false

  const server = startServer(registeredCallbacks)

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

      const overridenOpts = { ...defaultActorOpts, ...opts }
      const actor = buildActorForSystem(system, overridenOpts)
      const actorName = actor!.id!.name

      registry.actors[actorName] = actor

      return {
        /**
         * Use Noop payload if you don't need to interact with payload
         * @param {ActorActionOpts} actionOpts - The name of the actor on which the action is to be invoked
         * @param {ActorActionCallback} callback - The callback that spawn will route to when invoking this action
         * - name: Name of the action
         * - payloadType: The type of the payload you will use in this action
         * - timer: It means this action will be executed every X milliseconds
         */
        addAction: (actionOpts: ActorActionOpts, callback: ActorActionCallback) => {
          if (registered) throw new SpawnSystemRegisteredError(registeredErrorMsg)

          const derfaultActionOpts = { payloadType: 'json' }
          const overridenActionOpts = { ...derfaultActionOpts, ...actionOpts } as ActorActionOpts

          if (overridenActionOpts.timer) {
            actor.timerActions.push({
              action: { name: overridenActionOpts.name },
              seconds: overridenActionOpts.timer
            })
          } else {
            actor.actions.push({ name: overridenActionOpts.name })
          }

          registeredCallbacks.set(`${system}${actorName}${overridenActionOpts.name}`, {
            callback,
            stateType: overridenOpts.stateType || Noop,
            payloadType: overridenActionOpts.payloadType || Noop
          })
        }
      }
    },
    register: async (): Promise<RegistrationResponse> => {
      const MAX_RETRIES = 60
      const RETRY_DELAY = 1000
      let retries = 0

      const registrationRequest = { serviceInfo, actorSystem } as RegistrationRequest

      // make this register request retry with backoff when it fails
      const doRegister = async (): Promise<RegistrationResponse> => {
        try {
          const response = await registerRequest(registrationRequest)

          registered = true

          return response
        } catch (error) {
          retries++

          if (retries <= MAX_RETRIES) {
            console.log(
              `Registration attempt failed. Retrying in ${RETRY_DELAY} ms, with error: ${error?.toString()}`
            )
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))

            return doRegister()
          }

          console.error(`Registration failed after ${retries} retries.`)
          throw error // Rethrow the last error if maximum retries exceeded
        }
      }

      return doRegister()
    },
    destroy: async () => {
      return new Promise((resolve, reject) => {
        server.stop((err) => {
          if (err) return reject()

          registered = false
          systemCreated = false
          resolve(true)
        })
      })
    }
  }
}

export type InvokeOpts = {
  action: string
  system?: string
  response?: MessageType<any>
  payload?: PayloadRef<any> | { [key: number | string]: any }
  async?: boolean
  pooled?: boolean
  metadata?: { [key: string]: string }
  ref?: string
  scheduledTo?: Date
  delay?: number
}

/**
 * A utility function that allows for the invocation of a specific action on an actor by name.
 *
 * @param {string} actorName - The name of the actor on which the action is to be invoked
 * @param {InvokeOpts} invokeOpts - An object containing the fields that specify the details of the action invocation
 * @returns {Promise<any>} - a promise that resolves to the response payload of the action or null if no response is specified
 *
 * InvokeOpts fields:
 * - action - The action to be executed
 * - system - (optional, defaults to current registered system) The system that the actor belongs to
 * - response - (optional) The expected response type
 * - payload - (optional) The payload to be passed to the action
 * - async - (optional) Whether the action should be executed asynchronously
 * - pooled - (optional) Whether the action should be executed in a pooled actor
 * - metadata - (optional) Additional metadata to be passed to the action
 * - ref - (optional) A reference to the named actor if you want to also spawn it during invocation, not needing to call spawnActor previously
 * - scheduledTo - (optional) The scheduled date to be executed
 * - delay - (optional) The delay in ms this will be invoked
 */
const invoke = async (actorName: string, invokeOpts: InvokeOpts): Promise<any | null> => {
  let async = invokeOpts.async || false
  let system = invokeOpts.system || uniqueDefaultSystem
  let pooled = invokeOpts.pooled || false
  let metadata = invokeOpts.metadata || {}

  if (invokeOpts.ref) {
    await spawnActor(actorName, { system, actorRef: invokeOpts.ref })
  }

  const request = InvocationRequest.create({
    system: ActorSystem.create({ name: system }),
    actor: Actor.create({
      id: ActorId.create({ name: actorName, system: system })
    }),
    metadata: metadata,
    payload: buildPayload(invokeOpts.payload),
    actionName: invokeOpts.action,
    async: async,
    caller: undefined,
    pooled: pooled,
    scheduledTo: scheduledToBigInt(parseScheduledTo(invokeOpts.delay, invokeOpts.scheduledTo))
  })

  const { payload } = await invokeRequest(request)

  return unpackPayload(payload, invokeOpts.response)
}

export type SpawnActorOpts = {
  actorRef: string
  system?: string
}

/**
 * Used to dinamically spawn named actors.
 * This is kind of instances for a class, the actor being the "class" definition and the actorName of this input being the instanceId
 *
 * ## Example:
 * ```
 * spawnActor('namedActor_id_01', { system: 'test', actorRef: 'namedActor' })
 * ```
 *
 * @param {string} actorName name of the actor (this is the instanceId that you want to use usually for a named actor)
 * @param {SpawnActorOpts} opts
 * @returns {Promise<SpawnResponse>} response
 */
const spawnActor = async (actorName: string, opts: SpawnActorOpts): Promise<SpawnResponse> => {
  let system = opts.system || uniqueDefaultSystem

  const request = SpawnRequest.create({
    actors: [ActorId.create({ name: actorName, system, parent: opts.actorRef })]
  })

  return spawnActorRequest(request)
}

export const payloadFor = (type: MessageType<any>, value: any): PayloadRef => {
  return { ref: type, instance: type.create(value) }
}

export default { createSystem, invoke, spawnActor, payloadFor }
