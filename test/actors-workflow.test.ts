import { UserState, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import * as crypto from 'crypto'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createRandomActor, createUserActor } from './stubs/actors'

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('testing workflows', () => {
  jest.setTimeout(5_000)

  const randomActorName = crypto.randomUUID()
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

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

    const newNameResponse = await spawn.invoke('MockUserActor', {
      system: 'SpawnSysTest',
      command,
      payload,
      response: ChangeUserNameResponse
    })

    expect(newNameResponse.newName).toBe('transformed newNameInputInternal')

    const userState = await spawn.invoke(`MockUserActor`, {
      system: 'SpawnSysTest',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('pipe_initial')
  })

  test('settting new name and getting it after forwarded', async () => {
    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'newNameForward' }))
    const command = 'forwardTest'

    const newNameResponse = await spawn.invoke('MockUserActor', {
      system: 'SpawnSysTest',
      command,
      payload,
      response: ChangeUserNameResponse
    })

    expect(newNameResponse.newName).toBe('transformed newNameForward')

    const userState = await spawn.invoke(`MockUserActor`, {
      system: 'SpawnSysTest',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('forward_initial')
  })

  test('calling effects to another actor schedule for 1 second in the future', async () => {
    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'newNameForward' }))
    const command = 'effectsTest'

    await spawn.invoke('MockUserActor', {
      system: 'SpawnSysTest',
      command,
      payload,
      response: ChangeUserNameResponse
    })

    await timeout(1_500)

    const userState = await spawn.invoke(`MockUserActor`, {
      system: 'SpawnSysTest',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('afterEffect')
  })

  test('calling broadcast and seeing its effect in another actor', async () => {
    const command = 'broadcastTest'

    await spawn.invoke('MockUserActor', {
      system: 'SpawnSysTest',
      command
    })

    await timeout(100)

    const userState = await spawn.invoke(randomActorName, {
      system: 'SpawnSysTest',
      command: 'getState',
      response: UserState
    })

    expect(userState.name).toBe('afterBroadcast')
  })
})
