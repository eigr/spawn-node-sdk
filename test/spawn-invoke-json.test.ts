import spawn, { SpawnSystem } from '../src/spawn'
import { createJsonActor } from './stubs/actors'

describe('testing invoke', () => {
  jest.setTimeout(30_000)

  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('SpawnSysTest')

    createJsonActor(system)

    await system.register()
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('using default proxy function "getState" to get the current state in json_actor01', async () => {
    const { sum } = await spawn.invoke('json_actor01', {
      command: 'getState',
      system: 'SpawnSysTest'
    })

    expect(sum).toBeGreaterThanOrEqual(0)
  })

  test('invoking plusOne in json_actor01', async () => {
    const { sum } = await spawn.invoke('json_actor01', {
      command: 'plusOne',
      payload: { value: 1, fwf: 1 },
      system: 'SpawnSysTest'
    })

    expect(sum).toBeGreaterThanOrEqual(1)
  })
})
