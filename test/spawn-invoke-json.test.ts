import spawn, { SpawnSystem } from '../src/spawn'
import { createJsonActor } from './stubs/actors'
import { describe, beforeAll, afterAll, test, expect } from 'bun:test'

describe('testing invoke', () => {
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createJsonActor(system)

    const registered = await system.register()
    if (registered.status?.message != 'Accepted') throw new Error('Failed to register system')
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('using default proxy function "getState" to get the current state in json_actor01', async () => {
    const { sum } = await spawn.invoke('json_actor01', {
      action: 'getState',
      system: 'SpawnSysTest'
    })

    expect(sum).toBeGreaterThanOrEqual(0)
  })

  test('invoking plusOne in json_actor01', async () => {
    const { sum } = await spawn.invoke('json_actor01', {
      action: 'plusOne',
      payload: { value: 1, fwf: 1 },
      system: 'SpawnSysTest'
    })

    expect(sum).toBeGreaterThanOrEqual(1)
  })
})
