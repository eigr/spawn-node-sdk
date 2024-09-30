import { ChangeUserNameStatus, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createTaskActor } from './stubs/actors'
import { describe, beforeAll, afterAll, test, expect } from 'bun:test'

describe('testing spawn task actor', () => {
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createTaskActor(system)

    const registered = await system.register()
    if (registered.status?.message != 'Accepted') throw new Error('Failed to register system')
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('calling a function in a task actor', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'JoeTaskCalled'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'Joe' }))
    const action = 'executeTask'

    const newNameResponse = await spawn.invoke('Jose', {
      action,
      payload,
      response: ChangeUserNameResponse,
      system: 'SpawnSysTest'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })
})
