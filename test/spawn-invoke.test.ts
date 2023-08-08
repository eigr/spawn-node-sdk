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
  jest.setTimeout(120_000)

  const randomActorName = crypto.randomUUID()
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createUserActor(system)
    createRandomActor(system, randomActorName)

    const registered = await system.register()
    expect(registered.status?.message).toBe('Accepted')
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('using default proxy function "getState" to get the current state in a random actor', async () => {
    const userState = await spawn.invoke(randomActorName, {
      action: 'getState',
      response: UserState,
      system: 'SpawnSysTest'
    })

    expect(userState.name).toBe('')
  })

  // never use this for action discovery purpose
  test('invoking non existing function throws SpawnInvocationError', async () => {
    try {
      await spawn.invoke(randomActorName, {
        action: 'unknown',
        response: UserState,
        system: 'SpawnSysTest'
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
    const action = 'setName'

    const newNameResponse = await spawn.invoke('MockUserActor', {
      action,
      payload,
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)

    const userState = await spawn.invoke(`MockUserActor`, {
      action: 'getState',
      response: UserState,
      system: 'SpawnSysTest'
    })

    expect(userState.name).toBe('novo_nome')
  })

  test('settting new name by tags and invoke metadata', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'newNameMeta'
    })

    const payload = payloadFor(
      ChangeUserName,
      ChangeUserName.create({ newName: 'newNameToIgnore' })
    )
    const action = 'setNameMetadata'

    const newNameResponse = await spawn.invoke('MockUserActor', {
      action,
      payload,
      metadata: { metakey: 'newNameMeta' },
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)

    const resp = await spawn.invoke('MockUserActor', {
      action: 'getTagsName',
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(resp.newName).toBe('newNameMeta-initialTags-initTag')

    const userState = await spawn.invoke(`MockUserActor`, {
      action: 'getState',
      response: UserState,
      system: 'SpawnSysTest'
    })

    expect(userState.name).toBe('newNameMeta')
  })

  test('invoking noreply async function and changing internal state with it', async () => {
    const action = 'noreplyChangeName'
    const invokeAsync = await spawn.invoke('MockUserActor', {
      action,
      async: true,
      system: 'SpawnSysTest'
    })
    const stateChanged = await spawn.invoke('MockUserActor', {
      system: 'SpawnSysTest',
      action: 'get',
      response: UserState
    })

    expect(invokeAsync).toBeNull()
    expect(stateChanged.name).toBe('noreplyNameOk')
  })
})
