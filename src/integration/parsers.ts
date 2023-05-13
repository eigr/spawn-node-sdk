import { Broadcast, Effect, Forward, Pipe } from '../client-actor/workflows'
import { Actor, ActorId, ActorSystem } from '../protos/eigr/functions/protocol/actors/actor'
import {
  Noop,
  SideEffect,
  InvocationRequest,
  Broadcast as BroadcastProto,
  JSONType
} from '../protos/eigr/functions/protocol/actors/protocol'
import { Any } from '../protos/google/any'
import { MessageType } from '@protobuf-ts/runtime'
import {
  Pipe as PipeProtocol,
  Forward as ForwardProtocol
} from '../protos/eigr/functions/protocol/actors/protocol'

type OneofPayload =
  | { oneofKind: 'value'; value: Any }
  | { oneofKind: 'noop'; noop: Noop }
  | { oneofKind: undefined }

export type PayloadRef<T extends object = any> = { ref: MessageType<T>; instance: any }

export const unpackPayload = (payload: OneofPayload, type?: MessageType<any>) => {
  if (!payload) {
    return null
  }

  if (payload.oneofKind === undefined) {
    return null
  }

  if (payload.oneofKind === 'noop') {
    return Noop.create()
  }

  const unpacked = unpack(payload.value, type || 'json')

  if (JSONType.is(unpacked)) {
    return JSON.parse(unpacked.content)
  }

  return unpacked
}

export const buildPayload = (payload?: PayloadRef<any> | Noop | JSON): OneofPayload => {
  if (!payload) {
    return { oneofKind: undefined }
  }

  if (Noop.is(payload as Noop)) {
    return { oneofKind: 'noop', noop: Noop.create() }
  }

  if ((payload as PayloadRef<any>).ref !== undefined && (payload as PayloadRef<any>).instance) {
    return {
      oneofKind: 'value',
      value: Any.pack((payload as PayloadRef<any>).instance, (payload as PayloadRef<any>).ref)
    }
  }

  try {
    const content = JSON.stringify(payload as JSON)
    return {
      oneofKind: 'value',
      value: Any.pack(JSONType.create({ content }), JSONType)
    }
  } catch (ex) {
    return { oneofKind: undefined }
  }
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
      scheduledTo: scheduledToBigInt(
        parseScheduledTo(effect.scheduledTo as number, effect.scheduledTo as Date)
      )
    })

    return SideEffect.create({ request })
  })
}

export const buildRoutingWorkflow = (pipe?: Pipe, forward?: Forward) => {
  let routingWorkflow: any = { oneofKind: undefined }

  if (pipe) {
    routingWorkflow = {
      oneofKind: 'pipe',
      pipe: { actor: pipe.actorName, commandName: pipe.command } as PipeProtocol
    }
  }

  if (forward) {
    routingWorkflow = {
      oneofKind: 'forward',
      forward: { actor: forward.actorName, commandName: forward.command } as ForwardProtocol
    }
  }

  return routingWorkflow
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

export const unpack = (object: any, type: MessageType<any> | 'json'): any | null => {
  if (!object) return null

  if (Noop.is(object)) {
    return Noop.create()
  }

  if (type === 'json' && object.value.length !== 0) {
    const unpacked = Any.unpack(object, JSONType)
    return JSON.parse(unpacked.content)
  }

  return Any.unpack(object, type === 'json' ? Noop : type)
}

export const pack = (object: any, type: MessageType<any> | 'json'): Any | undefined => {
  if (!object) return undefined

  if (type === 'json') {
    const content = typeof object === 'object' ? JSON.stringify(object) : object

    return Any.pack({ content }, JSONType)
  }

  return Any.pack(object, type)
}
