import 'reflect-metadata';

import SpawnSystem from 'spawn_system'


// export { SpawnSystem }


// testing purposess only
import { PersonActor } from 'person_actor';
import { ChangePersonNameMessage } from '@protos/person'

SpawnSystem.init([PersonActor], 'spawn_system');

(async () => {
    for (var i = 0; i < 10; i++) {
        console.time(`test${i}`);

        const newNameMessage = ChangePersonNameMessage.create({ name: `name_${i}` })

        const invocation = await SpawnSystem.invoke(PersonActor.toString(), 'setName', newNameMessage)

        // console.log('........... final val ..............')
        console.log('change to: ' + JSON.stringify(invocation))
        // console.log('...........-----------..............')

        console.timeEnd(`test${i}`);

        console.log('==========================')
    }
    
})()