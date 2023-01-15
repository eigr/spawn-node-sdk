import {
  UserState,
  ChangeUserNameStatus,
  ChangeUserNameResponse,
  ChangeUserName
} from './protos/user_test'
import * as crypto from 'crypto'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createRandomActor, createUserActor } from './stubs/actors'

describe('testing invoke', () => {
  jest.setTimeout(30_000)

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

  test('using default proxy function "getState" to get the current state in a random actor', async () => {
    const userState = await spawn.invoke(randomActorName, {
      command: 'getState',
      response: UserState,
      system: 'spawn_sys_test'
    })

    expect(userState.name).toBe('')
  })

  // never use this for command discovery purpose
  test('invoking non existing function throws SpawnInvocationError', async () => {
    try {
      await spawn.invoke(randomActorName, {
        command: 'unknown',
        response: UserState,
        system: 'spawn_sys_test'
      })
    } catch (ex: any) {
      expect(ex.name).toBe('SpawnInvocationError')
    }
  })

  test('settting new name and getting it correctly after', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'novo_nome' }))
    const command = 'setName'

    const newNameResponse = await spawn.invoke('userActorTest', {
      command,
      payload,
      response: ChangeUserNameResponse,
      system: 'spawn_sys_test'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)

    const userState = await spawn.invoke(`userActorTest`, {
      command: 'getState',
      response: UserState,
      system: 'spawn_sys_test'
    })

    expect(userState.name).toBe('novo_nome')
  })

  test('invoking noreply async function and changing internal state with it', async () => {
    const command = 'noreplyChangeName'
    const invokeAsync = await spawn.invoke('userActorTest', {
      command,
      async: true,
      system: 'spawn_sys_test'
    })
    const stateChanged = await spawn.invoke('userActorTest', {
      system: 'spawn_sys_test',
      command: 'get',
      response: UserState
    })

    expect(invokeAsync).toBeNull()
    expect(stateChanged.name).toBe('noreplyNameOk')
  })
})