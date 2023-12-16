import { ChangeUserNameStatus, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createPooledActor } from './stubs/actors'
import { describe, beforeAll, afterAll, test, expect } from 'bun:test'

describe('testing spawn pooled actor', () => {
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createPooledActor(system)

    const registered = await system.register()
    if (registered.status?.message != 'Accepted') throw new Error('Failed to register system')
  })

  afterAll(async () => {
    await system.destroy()
  })

  test.skip('calling a stateless function in a pooled actor', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'namePooledCall-set'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'namePooledCall' }))
    const action = 'setName'

    const newNameResponse = await spawn.invoke('pooledActorExample', {
      action,
      payload,
      pooled: true,
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })
})
