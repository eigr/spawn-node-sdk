import { ChangeUserNameStatus, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createUnnamedActor } from './stubs/actors'
import { describe, beforeAll, afterAll, test, expect } from 'bun:test'

describe('testing spawn unnamed actor', () => {
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createUnnamedActor(system)

    const registered = await system.register()
    if (registered.status?.message != 'Accepted') throw new Error('Failed to register system')
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('settting new name for a named actor', async () => {
    await spawn.spawnActor('namedActorTest_01', {
      system: 'SpawnSysTest',
      actorRef: 'unnamedActorTest'
    })

    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'novo_nome' }))
    const action = 'setName'

    const newNameResponse = await spawn.invoke('namedActorTest_01', {
      action,
      payload,
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })

  test('settting new name for a named actor invoking directly', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'novo_nome' }))
    const action = 'setName'

    const newNameResponse = await spawn.invoke('namedActorTest_02', {
      action,
      payload,
      response: ChangeUserNameResponse,
      ref: 'unnamedActorTest',
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })
})
