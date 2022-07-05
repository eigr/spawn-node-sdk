import { ActorEntity, Command } from "decorators/actor";
import { ActorOpts } from "actor_opts";
import { Person, ChangePersonNameMessage } from "@protos/person";
import { ActorContext } from 'actor_context'

@ActorEntity("test_actor_01", Person, {persistent: true, snapshotTimeout: 10000n, deactivatedTimeout: 50000n} as ActorOpts)
export class PersonActor {
    context: ActorContext<Person> | null = null

    @Command()
    get(context: ActorContext<Person>): Person {
        return context.state
    }

    @Command(ChangePersonNameMessage)
    setName(message: ChangePersonNameMessage, context: ActorContext<Person>): Person {
        return {...context.state, name: message.name}
    }

    static toString() {
        return 'test_actor_01'
    }
}

