import {
  ChangeUserName,
  ChangeUserNameResponse,
  ChangeUserNameStatus,
  UserState
} from '../test/protos/user_test'
import * as b from 'benny'
import * as crypto from 'crypto'
import spawn, { payloadFor } from '../src/spawn'
import { Value } from '../src/client-actor/value'
import { ActorContext } from '../src/client-actor/workflows'

const randomActorName = crypto.randomBytes(16).toString('hex')

const system = spawn.createSystem('spawn_sys_bench')

;(async () => {
  const actor = system.buildActor({
    name: randomActorName,
    stateType: UserState,
    stateful: true,
    snapshotTimeout: 10_000n,
    deactivatedTimeout: 500_000n
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

  await system.register()

  await b.suite(
    'Invoke',
    b.add('Stateful invoke default function', async () => {
      await spawn.invoke(randomActorName, {
        command: 'getState',
        response: UserState
      })
    }),
    b.add('Stateful invoke setName function', async () => {
      const payload = payloadFor(ChangeUserName, { newName: 'new_name' })
      const command = 'setName'

      await spawn.invoke(randomActorName, {
        command,
        payload,
        response: ChangeUserNameResponse
      })
    }),
    b.add('Stateful invoke async function', async () => {
      const payload = payloadFor(ChangeUserName, { newName: 'new_name_async' })
      const command = 'setName'

      await spawn.invoke(randomActorName, {
        command,
        payload,
        response: ChangeUserNameResponse,
        async: true
      })
    }),
    b.cycle(),
    b.complete(),
    b.save({ file: 'invocations', format: 'chart.html', details: true })
  )

  process.exit(0)
})()
