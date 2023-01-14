import {
  ActorInvocation,
  ActorInvocationResponse,
  Context,
  Noop
} from '../../protos/eigr/functions/protocol/actors/protocol'
import { ActorContext } from '../../client-actor/workflows'
import { ServerResponse, IncomingMessage } from 'node:http'
import { sendResponse } from '../server'
import { ActorCallbackConnector } from '../../spawn'
import { Any } from '../../protos/google/any'
import {
  buildBroadcast,
  buildPayload,
  buildRoutingWorkflow,
  buildSideEffects,
  unpack
} from '../parsers'

export const registerControllerHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  actorCallbacks: Map<string, ActorCallbackConnector>
) => {
  req.on('data', async (buffer: Buffer) => {
    const { currentContext, actor, payload, commandName, caller } =
      ActorInvocation.fromBinary(buffer)

    let callbackData = actorCallbacks.get(`${actor?.system}${actor?.name}${commandName}`)

    if (!callbackData) {
      callbackData = actorCallbacks.get(`${actor?.system}${actor?.parent}${commandName}`)
    }

    if (!callbackData) {
      const resp = ActorInvocationResponse.create({
        actorName: actor?.name,
        actorSystem: actor?.system,
        updatedContext: currentContext
      })

      return sendResponse(200, res, resp)
    }

    const { stateType, payloadType, callback } = callbackData

    const state = currentContext!.state && unpack(currentContext!.state, stateType)
    const context: ActorContext<any> = {
      state: state || Noop.create(),
      caller: currentContext!.caller!,
      self: currentContext!.self!,
      metadata: currentContext!.metadata!
    }

    let payloadToUnpack = Any.create(Noop.create())
    if (payload.oneofKind === 'value') {
      payloadToUnpack = payload.value
    }

    const value = await callback(context, payloadType.fromBinary(payloadToUnpack.value))
    const parsedValue = value.parse()

    const response = ActorInvocationResponse.create({
      actorName: actor?.name,
      actorSystem: actor?.system,
      updatedContext: Context.create({
        caller: caller,
        self: actor,
        metadata: parsedValue.metadata || currentContext?.metadata,
        state: Any.pack(parsedValue.state, stateType)
      }),
      payload: buildPayload(parsedValue.value),
      workflow: {
        broadcast: buildBroadcast(parsedValue?.broadcast),
        effects: buildSideEffects(actor!.name, actor!.system, parsedValue.effects),
        routing: buildRoutingWorkflow(parsedValue?.pipe, parsedValue?.forward)
      }
    })

    sendResponse(200, res, response)
  })
}
