import {
  Actor,
  ActorDeactivationStrategy,
  ActorId,
  ActorSnapshotStrategy,
  ActorState,
  Kind,
  Metadata,
  TimeoutStrategy
} from '../protos/eigr/functions/protocol/actors/actor'
import { MessageType } from '@protobuf-ts/runtime'
import { Any } from '../protos/google/any'
import { Noop } from '../protos/eigr/functions/protocol/actors/protocol'

/**
 * Defines the type for options that can be passed when creating an Actor
 */
export type IActorOpts = {
  name: string
  stateType?: MessageType<any>
  kind?: Kind
  stateful?: boolean
  snapshotTimeout?: bigint
  deactivatedTimeout?: bigint
  channel?: string
  metadata?: { [key: string]: string }
}

export type PooledActorOpts = IActorOpts & {
  stateType: undefined
  stateful: false
  minPoolSize: number
  maxPoolSize: number
}

export type ActorOpts = IActorOpts | PooledActorOpts

export const defaultActorOpts = {
  kind: Kind.SINGLETON,
  stateful: true,
  snapshotTimeout: 10_000n,
  deactivatedTimeout: 2_000n
}

export const buildActorForSystem = (system: string, opts: ActorOpts): Actor => {
  const state: ActorState = {
    tags: {},
    state: Any.pack(opts.stateType?.create() || Noop.create(), opts.stateType || Noop)
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

  const metadata: Metadata = { channelGroup: opts.channel!, tags: opts.metadata || {} }
  const id = { name: opts.name, system } as ActorId

  if (opts.kind === Kind.ABSTRACT) {
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
    commands: [],
    timerCommands: []
  }
}