import 'reflect-metadata';

import SpawnSystem from './src/spawn_system'

export { ActorEntity, Command } from './src/decorators/actor'
export * from './src/integration/errors'
export { ActorContext, Value } from './src/client_actor/actor_context'
export { ActorOpts } from './src/client_actor/actor_opts'

export { SpawnSystem }
