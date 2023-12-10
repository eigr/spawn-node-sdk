import {
  Actor,
  ActorDeactivationStrategy,
  ActorId,
  ActorSnapshotStrategy,
  ActorState,
  Channel,
  Kind,
  Metadata,
  TimeoutStrategy
} from '../protos/eigr/functions/protocol/actors/actor'
import { MessageType } from '@protobuf-ts/runtime'
import { Any } from '../protos/eigr/functions/protocol/actors/google/protobuf/any'
import { Noop, JSONType } from '../protos/eigr/functions/protocol/actors/protocol'

/**
 * Defines the type for options that can be passed when creating an Actor
 */
export type IActorOpts = {
  name: string
  stateType?: MessageType<any> | 'json'
  kind?: Kind
  stateful?: boolean
  snapshotTimeout?: bigint
  deactivatedTimeout?: bigint
  channels?: Array<string | Channel>
  tags?: { [key: string]: string }
}

export type PooledActorOpts = IActorOpts & {
  stateType: undefined
  stateful: false
  minPoolSize: number
  maxPoolSize: number
}

export type ActorOpts = IActorOpts | PooledActorOpts

export const defaultActorOpts = {
  kind: Kind.UNNAMED,
  stateType: 'json',
  stateful: true,
  snapshotTimeout: 3_000n,
  deactivatedTimeout: 10_000n
} as ActorOpts

export const buildActorForSystem = (system: string, opts: ActorOpts): Actor => {
  const state: ActorState = {
    tags: opts.tags || {},
    state: getPrivateInitialState(opts)
  }

  const timeoutSnapshot: TimeoutStrategy = {
    timeout: opts.snapshotTimeout!
  }

  const snapshotStrategy: ActorSnapshotStrategy = {
    strategy: {
      oneofKind: 'timeout',
      timeout: timeoutSnapshot
    }
  }

  const timeoutDeactivate: TimeoutStrategy = {
    timeout: opts.deactivatedTimeout!
  }

  const deactivationStrategy: ActorDeactivationStrategy = {
    strategy: {
      oneofKind: 'timeout',
      timeout: timeoutDeactivate
    }
  }

  const channelGroup =
    opts.channels?.map((channel) => {
      if (typeof channel === 'string') {
        return Channel.create({ topic: channel, action: 'receive' })
      }

      return channel
    }) || []

  const metadata: Metadata = { channelGroup, tags: {} }
  const id = { name: opts.name, system } as ActorId

  if (opts.kind === Kind.NAMED) {
    id.parent = opts.name
  }

  return {
    id,
    metadata,
    state,
    settings: {
      kind: opts.kind!,
      maxPoolSize: (opts as PooledActorOpts).maxPoolSize || 0,
      minPoolSize: (opts as PooledActorOpts).minPoolSize || 1,
      stateful: opts.stateful!,
      deactivationStrategy,
      snapshotStrategy
    },
    actions: [],
    timerActions: []
  }
}

function getPrivateInitialState(opts: ActorOpts) {
  if (opts.stateType === 'json') {
    return Any.pack(JSONType.create({ content: '{}' }), JSONType)
  }

  return Any.pack(opts.stateType?.create() || Noop.create(), opts.stateType || Noop)
}
