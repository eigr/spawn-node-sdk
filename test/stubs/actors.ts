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
    name: 'userActorTest',
    stateType: UserState,
    stateful: true,
    snapshotTimeout: 10_000n,
    deactivatedTimeout: 500_000n
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
      return Value.of<UserState>().state({ ...context.state, name: 'noreply_name_ok' })
    }
  )

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
    name: 'pooledActorTest',
    kind: Kind.POOLED,
    minPoolSize: 1,
    maxPoolSize: 5
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
