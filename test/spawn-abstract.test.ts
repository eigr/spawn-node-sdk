import { ChangeUserNameStatus, ChangeUserNameResponse, ChangeUserName } from './protos/user_test'
import spawn, { payloadFor, SpawnSystem } from '../src/spawn'
import { createAbstractActor } from './stubs/actors'

describe('testing spawn abstract actor', () => {
  let system: SpawnSystem

  beforeAll(async () => {
    system = spawn.createSystem('spawn_sys_test')

    createAbstractActor(system)

    await system.register()
  })

  afterAll(async () => {
    await system.destroy()
  })

  test('settting new name for a abstract actor', async () => {
    await spawn.spawnActor('abstractActorTest_01', {
      system: 'spawn_sys_test',
      actorRef: 'abstractActorTest'
    })

    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'novo_nome' }))
    const command = 'setName'

    const newNameResponse = await spawn.invoke('abstractActorTest_01', {
      command,
      payload,
      response: ChangeUserNameResponse,
      system: 'spawn_sys_test'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })

  test('settting new name for a abstract actor invoking directly', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    })

    const payload = payloadFor(ChangeUserName, ChangeUserName.create({ newName: 'novo_nome' }))
    const command = 'setName'

    const newNameResponse = await spawn.invoke('abstractActorTest_02', {
      command,
      payload,
      response: ChangeUserNameResponse,
      ref: 'abstractActorTest',
      system: 'spawn_sys_test'
    })

    expect(newNameResponse.newName).toBe(expected.newName)
    expect(newNameResponse.status).toBe(expected.status)
  })
})
