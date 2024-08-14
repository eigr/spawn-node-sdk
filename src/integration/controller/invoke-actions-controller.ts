import {
  ActorInvocation,
  ActorInvocationResponse,
  Context,
  JSONType,
  Noop
} from '../../protos/eigr/functions/protocol/actors/protocol'
import { ActorContext } from '../../client-actor/workflows'
import { ServerResponse, IncomingMessage } from 'node:http'
import { sendResponse } from '../server'
import { ActorCallbackConnector } from '../../spawn'
import { Any } from '../../protos/eigr/functions/protocol/actors/google/protobuf/any'
import {
  buildBroadcast,
  buildPayload,
  buildRoutingWorkflow,
  buildSideEffects,
  pack,
  unpack
} from '../parsers'

async function register(
  buffer: Buffer,
  actorCallbacks: Map<string, ActorCallbackConnector>,
  res: ServerResponse | null
) {
  const { currentContext, actor, payload, actionName, caller } = ActorInvocation.fromBinary(buffer)

  let callbackData = actorCallbacks.get(`${actor?.system}${actor?.name}${actionName}`)

  if (!callbackData) {
    callbackData = actorCallbacks.get(`${actor?.system}${actor?.parent}${actionName}`)
  }

  if (!callbackData) {
    const resp = ActorInvocationResponse.create({
      actorName: actor?.name,
      actorSystem: actor?.system,
      updatedContext: currentContext
    })

    return sendResponse(200, res, resp)
  }

  const { stateType, payloadType, responseType, callback } = callbackData

  const state = currentContext!.state && unpack(currentContext!.state, stateType)
  const context: ActorContext<any> = {
    state: state || Noop.create(),
    caller: currentContext!.caller!,
    self: currentContext!.self!,
    metadata: currentContext!.metadata!,
    tags: currentContext!.tags!
  }

  let payloadToUnpack = Any.create(Noop.create())
  if (payload.oneofKind === 'value') {
    payloadToUnpack = payload.value
  }

  let finalPayload

  if (payloadType === 'json') {
    const rawJSON = JSONType.fromBinary(payloadToUnpack.value).content
    finalPayload = rawJSON && JSON.parse(rawJSON)
  } else {
    finalPayload = payloadType.fromBinary(payloadToUnpack.value)
  }

  try {
    const value = await callback(context, finalPayload)
    const parsedValue = value.parse(responseType)

    const response = ActorInvocationResponse.create({
      actorName: actor?.name,
      actorSystem: actor?.system,
      updatedContext: Context.create({
        caller: caller,
        self: actor,
        metadata: currentContext?.metadata,
        tags: parsedValue.tags || currentContext!.tags || {},
        state: parsedValue.state ? pack(parsedValue.state, stateType) : currentContext!.state
      }),
      payload: buildPayload(parsedValue.value),
      workflow: {
        broadcast: buildBroadcast(parsedValue?.broadcast),
        effects: buildSideEffects(actor!.name, actor!.system, parsedValue.effects),
        routing: buildRoutingWorkflow(parsedValue?.pipe, parsedValue?.forward)
      }
    })

    return sendResponse(200, res, response)
  } catch (error) {
    console.error(`Error when calling: ${actor?.name}.${actionName} | ${(error as any)?.message}`)

    return sendResponse(400, res)
  }
}

export const registerControllerHandlerNode = (
  req: IncomingMessage,
  res: ServerResponse,
  actorCallbacks: Map<string, ActorCallbackConnector>
) => {
  req.on('data', (buffer: Buffer) => register(buffer, actorCallbacks, res))
}

export const registerControllerHandlerBun = async (
  req: Request,
  actorCallbacks: Map<string, ActorCallbackConnector>
): Promise<Response> => {
  const buffer = Buffer.from(await req.arrayBuffer())

  return register(buffer, actorCallbacks, null) as Promise<Response>
}
