import { SpawnSystem } from '..';
import { ActorContext, Value } from '../src/client_actor/actor_context';
import { ActorEntity, Command } from '../src/decorators/actor';
import {
  ChangeUserName,
  ChangeUserNameResponse,
  ChangeUserNameStatus,
  UserState
} from '../test/protos/user_test';
import * as b from 'benny';
import * as crypto from 'crypto';

const randomActorName = crypto.randomBytes(16).toString('hex');
const randomActorName2 = crypto.randomBytes(16).toString('hex');
const randomActorName3 = crypto.randomBytes(16).toString('hex');

@ActorEntity(randomActorName, UserState, {
  persistent: true,
  snapshotTimeout: 10000n,
  deactivatedTimeout: 5000000n
})
export class NewActor {
  @Command('noreply')
  noreplyChangeName(context: any): void {
    context.setState({ ...context.state, name: 'noreply_name_ok' });
  }

  @Command('reply', ChangeUserName)
  setName(
    message: ChangeUserName,
    context: ActorContext<UserState>
  ): Value<ChangeUserNameResponse> {
    context.setState({ ...context.state, name: message.newName });

    return ChangeUserNameResponse.create({
      newName: message.newName,
      status: ChangeUserNameStatus.OK
    });
  }
}

@ActorEntity(randomActorName2, UserState, {
  persistent: true,
  snapshotTimeout: 10000n,
  deactivatedTimeout: 5000000n
})
export class NotRegisteredActor {
  @Command('noreply')
  noreplyChangeName(context: any): void {
    context.setState({ ...context.state, name: 'noreply_name_ok' });
  }

  @Command('reply', ChangeUserName)
  setName(
    message: ChangeUserName,
    context: ActorContext<UserState>
  ): Value<ChangeUserNameResponse> {
    context.setState({ ...context.state, name: message.newName });

    return ChangeUserNameResponse.create({
      newName: message.newName,
      status: ChangeUserNameStatus.OK
    });
  }
}

@ActorEntity(randomActorName3, UserState, {
  persistent: false,
  snapshotTimeout: 10000n,
  deactivatedTimeout: 5000000n
})
export class NonPersistentActor {
  @Command('noreply')
  noreplyChangeName(context: any): void {
    context.setState({ ...context.state, name: 'noreply_name_ok' });
  }

  @Command('reply', ChangeUserName)
  setName(
    message: ChangeUserName,
    context: ActorContext<UserState>
  ): Value<ChangeUserNameResponse> {
    context.setState({ ...context.state, name: message.newName });

    return ChangeUserNameResponse.create({
      newName: message.newName,
      status: ChangeUserNameStatus.OK
    });
  }
}

(async () => {
  await SpawnSystem.init([NewActor, NonPersistentActor], 'actor_system', true);
  // await SpawnSystem.init([NotRegisteredActor], 'another_system', false);

  await b.suite(
    'Invoke',
    b.add('PersistedActor invoke default function', async () => {
      await SpawnSystem.invoke(NewActor.toString(), {
        command: 'get',
        response: UserState
      });
    }),
    b.add('PersistedActor invoke setName function', async () => {
      const message = ChangeUserName.create({ newName: 'new_name' });
      const command = 'setName';

      await SpawnSystem.invoke(NewActor.toString(), {
        command,
        message,
        response: ChangeUserNameResponse
      });
    }),
    b.add('PersistedActor invoke noreply function', async () => {
      const command = 'noreplyChangeName';

      await SpawnSystem.invoke(NewActor.toString(), { command });
    }),
    b.add('NonPersistentActor invoke default function', async () => {
      await SpawnSystem.invoke(NonPersistentActor.toString(), {
        command: 'get',
        response: UserState
      });
    }),
    b.add('NonPersistentActor invoke setName function', async () => {
      const message = ChangeUserName.create({ newName: 'new_name' });
      const command = 'setName';

      await SpawnSystem.invoke(NonPersistentActor.toString(), {
        command,
        message,
        response: ChangeUserNameResponse
      });
    }),
    b.add('NonPersistentActor invoke noreply function', async () => {
      const command = 'noreplyChangeName';

      await SpawnSystem.invoke(NonPersistentActor.toString(), { command });
    }),
    // b.add('NonRegisteredActor invoke non registered actor noreply function', async () => {
    //   const command = 'noreplyChangeName';

    //   await SpawnSystem.invoke(NotRegisteredActor.toString(), { command });
    // }),
    b.cycle(),
    b.complete(),
    b.save({ file: 'invocations', format: 'chart.html', details: true })
  );

  process.exit(0);
})();
