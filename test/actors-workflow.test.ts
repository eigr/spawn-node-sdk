import { UserState, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import * as crypto from 'crypto'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createRandomActor, createUserActor } from './stubs/actors'

describe('testing workflows', () => {
  jest.setTimeout(5_000)

  const randomActorName = crypto.randomUUID()
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('spawn_sys_test')

    createUserActor(system)
    createRandomActor(system, randomActorName)

    await system.register()
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('settting new name and getting it after piped', async () => {
    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'newNameInput' }))
    const command = 'pipeTest'

    const newNameResponse = await spawn.invoke('userActorTest', {
      system: 'spawn_sys_test',
      command,
      payload,
      response: ChangeUserNameResponse
    })

    expect(newNameResponse.newName).toBe('transformed newNameInputInternal')

    const userState = await spawn.invoke(`userActorTest`, {
      system: 'spawn_sys_test',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('pipe_initial')
  })

  test('settting new name and getting it after forwarded', async () => {
    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'newNameForward' }))
    const command = 'forwardTest'

    const newNameResponse = await spawn.invoke('userActorTest', {
      system: 'spawn_sys_test',
      command,
      payload,
      response: ChangeUserNameResponse
    })

    expect(newNameResponse.newName).toBe('transformed newNameForward')

    const userState = await spawn.invoke(`userActorTest`, {
      system: 'spawn_sys_test',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('forward_initial')
  })
})
