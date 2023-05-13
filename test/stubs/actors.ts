import {
  UserState,
  ChangeUserName,
  ChangeUserNameResponse,
  ChangeUserNameStatus
} from '../protos/user_test'
import { ActorContext } from '../../src/client-actor/workflows'
import { Value } from '../../src/client-actor/value'
import { payloadFor, SpawnSystem } from '../../src/spawn'
import { Noop } from '../../src/protos/eigr/functions/protocol/actors/protocol'
import { Kind } from '../../src/protos/eigr/functions/protocol/actors/actor'

export const createUserActor = (system: SpawnSystem) => {
  const actor = system.buildActor({
    name: 'MockUserActor',
    stateType: UserState,
    stateful: true,
    snapshotTimeout: 5_000n,
    deactivatedTimeout: 15_000n,
    tags: { initial: 'initialTags' }
  })

  const actorTransformer = system.buildActor({
    name: 'userActorTransformerTest',
    stateType: Noop,
    stateful: false,
    snapshotTimeout: 10_000n,
    deactivatedTimeout: 500_000n
  })

  actorTransformer.addAction(
    { name: 'transform', payloadType: ChangeUserName },
    async (_ctx, payload: ChangeUserName) => {
      return Value.of<any, ChangeUserNameResponse>().response(ChangeUserNameResponse, {
        newName: `transformed ${payload.newName}`,
        status: 1
      })
    }
  )

  actor.addAction(
    { name: 'noreplyChangeName', payloadType: Noop },
    async (context: ActorContext<UserState>) => {
      return Value.of<UserState>().state({ ...context.state, name: 'noreplyNameOk' })
    }
  )

  actor.addAction({ name: 'init', payloadType: Noop }, async (context: ActorContext<UserState>) => {
    return Value.of().tags({ ...context.tags, init: 'initTag' })
  })

  actor.addAction(
    { name: 'pipeTest', payloadType: ChangeUserName },
    async (context: ActorContext<UserState>, payload: ChangeUserName) => {
      const name = 'pipe_initial'

      return Value.of<UserState, ChangeUserName>()
        .state({ ...context.state, name })
        .response(ChangeUserName, { newName: `${payload.newName}Internal` })
        .pipe({ actorName: 'userActorTransformerTest', command: 'transform' })
    }
  )

  actor.addAction(
    { name: 'forwardTest', payloadType: ChangeUserName },
    async (context: ActorContext<UserState>) => {
      const name = 'forward_initial'

      return Value.of<UserState, ChangeUserNameResponse>()
        .state({ ...context.state, name })
        .response(ChangeUserNameResponse, { newName: 'forward_newname_ignored', status: 1 })
        .forward({ actorName: 'userActorTransformerTest', command: 'transform' })
    }
  )

  actor.addAction(
    { name: 'effectsTest', payloadType: ChangeUserName },
    async (context: ActorContext<UserState>) => {
      return Value.of()
        .state({ name: 'effectsInitial' })
        .effects([
          {
            actorName: context.self.name,
            command: 'afterEffect',
            payload: payloadFor(Noop, {}),
            scheduledTo: 1_000
          }
        ])
    }
  )

  actor.addAction({ name: 'broadcastTest', payloadType: Noop }, async () => {
    return Value.of()
      .state({ name: 'broadcastInitial' })
      .broadcast({
        channel: 'broadcast_test',
        command: 'broadcastReceiver',
        payload: payloadFor(Noop, {})
      })
  })

  actor.addAction({ name: 'afterEffect', payloadType: Noop }, async () =>
    Value.of().state({ name: 'afterEffect' })
  )

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

  actor.addAction(
    { name: 'setNameMetadata', payloadType: ChangeUserName },
    async (context: ActorContext<UserState>) => {
      const response = ChangeUserNameResponse.create({
        newName: context.metadata.metakey,
        status: ChangeUserNameStatus.OK
      })

      const newTags = { ...context.metadata, newKey: 'newKeyMeta' }

      return Value.of<UserState, ChangeUserNameResponse>()
        .state({ ...context.state, name: context.metadata.metakey })
        .tags({ ...context.tags, ...newTags })
        .response(ChangeUserNameResponse, response)
    }
  )

  actor.addAction(
    { name: 'getTagsName', payloadType: Noop },
    async (context: ActorContext<UserState>) => {
      const response = ChangeUserNameResponse.create({
        newName: `${context.tags?.metakey}-${context.tags?.initial}-${context.tags?.init}`,
        status: ChangeUserNameStatus.OK
      })

      return Value.of<UserState, ChangeUserNameResponse>().response(
        ChangeUserNameResponse,
        response
      )
    }
  )

  return actor
}

export const createJsonActor = (system: SpawnSystem) => {
  interface ActorState {
    sum: number
  }
  const actor = system.buildActor({
    name: 'json_actor01'
  })

  actor.addAction({ name: 'init' }, async (context: ActorContext<ActorState>) => {
    const sum = context.state?.sum || 0

    return Value.of<ActorState, any>().state({ sum })
  })

  actor.addAction(
    { name: 'plusOne' },
    async (context: ActorContext<ActorState>, { value }: any) => {
      const sum = (value || 0) + 1

      return Value.of<ActorState, any>()
        .state({ ...context.state, sum })
        .response({ sum })
    }
  )

  return actor
}

export const createRandomActor = (system: SpawnSystem, actorName: string) => {
  const actor = system.buildActor({
    name: actorName,
    stateType: UserState,
    stateful: true,
    channel: 'broadcast_test',
    snapshotTimeout: 10_000n,
    deactivatedTimeout: 500_000n
  })

  actor.addAction({ name: 'broadcastReceiver', payloadType: Noop }, async () =>
    Value.of().state({ name: 'afterBroadcast' })
  )

  return actor
}

export const createAbstractActor = (system: SpawnSystem) => {
  const actor = system.buildActor({
    name: 'abstractActorTest',
    kind: Kind.ABSTRACT,
    stateType: UserState,
    stateful: true
  })

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

  return actor
}

export const createPooledActor = (system: SpawnSystem) => {
  const actor = system.buildActor({
    name: 'pooledActorExample',
    kind: Kind.POOLED,
    stateful: false,
    minPoolSize: 1,
    maxPoolSize: 3
  })

  actor.addAction(
    { name: 'setName', payloadType: ChangeUserName },
    async (_ctx, message: ChangeUserName) => {
      const response = ChangeUserNameResponse.create({
        newName: `${message.newName}-set`,
        status: ChangeUserNameStatus.OK
      })

      return Value.of<never, ChangeUserNameResponse>().response(ChangeUserNameResponse, response)
    }
  )

  return actor
}
