import { SpawnSystem } from '../index'
import { UserState, ChangeUserNameStatus, ChangeUserNameResponse, ChangeUserName } from './protos/user_test';
import { UserActor } from './stubs/user_actor'

beforeAll(async () => {
    await SpawnSystem.init([UserActor], 'spawn_sys_test')
});

describe('testing invoke', () => {
    test('settting new name and getting it after', async () => {
        const expected = ChangeUserNameResponse.create({status: ChangeUserNameStatus.OK, newName: 'novo_nome'})

        const message = {newName: 'novo_nome'} as ChangeUserName
        const newNameResponse = await SpawnSystem.invoke(UserActor.toString(), 'setName', ChangeUserNameResponse, message)

        expect(newNameResponse.newName).toBe(expected.newName);
        expect(newNameResponse.status).toBe(expected.status);

        const userState = await SpawnSystem.invoke(UserActor.toString(), 'get', UserState)

        expect(userState.name).toBe('novo_nome');
    });
});