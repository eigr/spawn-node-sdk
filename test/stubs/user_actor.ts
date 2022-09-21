import { ActorEntity, Command } from '../../src/decorators/actor';
import { ActorOpts } from '../../src/client_actor/actor_opts';
import {
  UserState,
  ChangeUserName,
  ChangeUserNameResponse,
  ChangeUserNameStatus
} from '../protos/user_test';
import { ActorContext, Value } from '../../src/client_actor/actor_context';

@ActorEntity('user_actor_01', UserState, {
  persistent: true,
  snapshotTimeout: 10000n,
  deactivatedTimeout: 5000000n
} as ActorOpts)
export class UserActor {
  context: ActorContext<UserState> | null = null;

  @Command('noreply')
  noreplyChangeName(context: ActorContext<UserState>): void {
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
