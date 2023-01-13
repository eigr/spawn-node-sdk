import { Broadcast, Effect } from '../client-actor/context'
import { Actor, ActorId, ActorSystem } from '../protos/eigr/functions/protocol/actors/actor'
import {
  Noop,
  SideEffect,
  InvocationRequest,
  Broadcast as BroadcastProto
} from '../protos/eigr/functions/protocol/actors/protocol'
import { Any } from '../protos/google/any'
import { MessageType } from '@protobuf-ts/runtime'

type OneofPayload =
  | { oneofKind: 'value'; value: Any }
  | { oneofKind: 'noop'; noop: Noop }
  | { oneofKind: undefined }

export type PayloadRef<T extends object = any> = { ref: MessageType<T>; instance: any }

export const unpackPayload = (payload: OneofPayload, type: MessageType<any>) => {
  if (payload.oneofKind === undefined) {
    return null
  }

  if (payload.oneofKind === 'noop') {
    return Noop.create()
  }

  return unpack(payload.value, type)
}

export const buildPayload = (payload: any): OneofPayload => {
  if (!payload) {
    return { oneofKind: undefined }
  }

  if (Noop.is(payload)) {
    return { oneofKind: 'noop', noop: Noop.create() }
  }

  if (payload.ref !== undefined) {
    return { oneofKind: 'value', value: Any.pack(payload.instance, payload.ref) }
  }

  return { oneofKind: undefined }
}

export const scheduledToBigInt = (scheduledTo: Date | number | undefined): bigint | undefined => {
  if (scheduledTo instanceof Date) {
    return BigInt(scheduledTo.getTime())
  }

  if (typeof scheduledTo === 'number') {
    return BigInt(scheduledTo)
  }

  return undefined
}

export const buildBroadcast = (broadcast: Broadcast | undefined): BroadcastProto | undefined => {
  if (!broadcast) return undefined

  return BroadcastProto.create({
    channelGroup: broadcast.channel,
    commandName: broadcast.command,
    payload: buildPayload(broadcast.payload)
  })
}

export const buildSideEffects = (callerName: string, system: string, effects?: Effect[]) => {
  if (!effects) return undefined

  return effects.map((effect) => {
    const payload = buildPayload(effect.payload)
    const request = InvocationRequest.create({
      system: ActorSystem.create({ name: system }),
      actor: Actor.create({
        id: ActorId.create({ name: effect.actorName, system })
      }),
      payload,
      commandName: effect.command,
      async: true,
      caller: ActorId.create({ name: callerName, system }),
      scheduledTo: scheduledToBigInt(effect.scheduledTo)
    })

    return SideEffect.create({ request })
  })
}

export const parseScheduledTo = (delayMs?: number, scheduledTo?: Date): number | undefined => {
  if (!delayMs && !scheduledTo) {
    return undefined
  }

  if (typeof delayMs === 'number') {
    scheduledTo = new Date(Date.now() + delayMs)
    return parseScheduledTo(undefined, scheduledTo)
  }

  if (!scheduledTo) {
    return undefined
  }

  return scheduledTo.getTime()
}

export const unpack = (value: any, type: MessageType<any>) => {
  if (!value) return null

  return Any.unpack(value, type)
}
