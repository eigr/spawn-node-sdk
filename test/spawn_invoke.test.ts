import { SpawnSystem } from '../index';
import {
  UserState,
  ChangeUserNameStatus,
  ChangeUserNameResponse,
  ChangeUserName
} from './protos/user_test';
import { UserActor } from './stubs/user_actor';
import * as crypto from 'crypto';
import { ActorEntity } from '../src/decorators/actor';
import { ActorContext } from '../src/client-actor/context';

const randomActorName = crypto.randomBytes(16).toString('hex');

@ActorEntity(randomActorName, UserState, {
  persistent: false,
  snapshotTimeout: 60_000n,
  deactivatedTimeout: 60_000n
})
class RandomActor {
  context: ActorContext<UserState> | null = null;
}

beforeAll(async () => {
  await SpawnSystem.init([UserActor, RandomActor], 'spawn_sys_test');
});

describe('testing invoke', () => {
  test('using default proxy function "getState" to get the current state in a random actor', async () => {
    const userState = await SpawnSystem.invoke(randomActorName, {
      command: 'getState',
      response: UserState
    });

    expect(userState.name).toBe('');
  });

  test('invoking non existing function returns null', async () => {
    const invocationResponse = await SpawnSystem.invoke(randomActorName, {
      command: 'unknown',
      response: UserState
    });

    expect(invocationResponse).toBeNull();
  });

  test('settting new name and getting it correctly after', async () => {
    const expected = ChangeUserNameResponse.create({
      status: ChangeUserNameStatus.OK,
      newName: 'novo_nome'
    });

    const message = ChangeUserName.create({ newName: 'novo_nome' });
    const command = 'setName';

    const newNameResponse = await SpawnSystem.invoke(UserActor.toString(), {
      command,
      message,
      response: ChangeUserNameResponse
    });

    expect(newNameResponse.newName).toBe(expected.newName);
    expect(newNameResponse.status).toBe(expected.status);

    const userState = await SpawnSystem.invoke(`${UserActor}`, {
      command: 'getState',
      response: UserState
    });

    expect(userState.name).toBe('novo_nome');
  });

  test('invoking noreply async function and changing internal state with it', async () => {
    const command = 'noreplyChangeName';
    const invokeAsync = await SpawnSystem.invoke(UserActor.toString(), { command });
    const stateChanged = await SpawnSystem.invoke(UserActor.toString(), {
      command: 'get',
      response: UserState
    });

    expect(invokeAsync).toBeUndefined();
    expect(stateChanged.name).toBe('noreply_name_ok');
  });
});
