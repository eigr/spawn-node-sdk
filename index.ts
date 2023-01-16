import { Value } from './src/client-actor/value'
import { Noop } from './src/protos/eigr/functions/protocol/actors/protocol'
import { ActorContext, Broadcast, Effect, Pipe, Forward } from './src/client-actor/workflows'
import { ActorOpts, IActorOpts } from './src/client-actor/definitions'
import { PayloadRef } from './src/integration/parsers'
import { Kind } from './src/protos/eigr/functions/protocol/actors/actor'
import spawn, {
  ActorActionCallback,
  InvokeOpts,
  ActorCallbackConnector,
  payloadFor,
  ActorActionOpts,
  SpawnSystem
} from './src/spawn'

export {
  payloadFor,
  ActorContext,
  PayloadRef,
  ActorActionCallback,
  InvokeOpts,
  ActorCallbackConnector,
  ActorActionOpts,
  Noop,
  Kind,
  Value,
  Broadcast,
  Effect,
  Pipe,
  Forward,
  ActorOpts,
  IActorOpts,
  SpawnSystem
}
export default spawn
