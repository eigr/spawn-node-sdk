import { Value } from './src/client-actor/value'
import { Noop } from './src/protos/eigr/functions/protocol/actors/protocol'
import { ActorContext, Broadcast, Effect, Pipe, Forward } from './src/client-actor/context'
import { ActorOpts, IActorOpts } from './src/client-actor/definitions'
import { PayloadRef } from './src/integration/parsers'
import spawn, {
  ActorActionCallback,
  InvokeOpts,
  ActorCallbackConnector,
  payloadFor,
  ActorActionOpts
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
  Value,
  Broadcast,
  Effect,
  Pipe,
  Forward,
  ActorOpts,
  IActorOpts
}
export default spawn

// (async () => {
//     const system = spawn.createSystem('systest4')

//     const actor = system.buildActor({ name: 'ggg', stateType: UserState })

//     const TestActionHandler: ActorActionCallback<UserState, ChangeUserNameResponse> = async (ctx, payload: ChangeUserName) => {
//       const response = ChangeUserNameResponse.create({ newName: payload.newName, status: ChangeUserNameStatus.OK })

//       return Value.of<UserState, ChangeUserNameResponse>()
//         .state({ name: 'aqui é state', nickname: 'jao' })
//         .response(payloadFor(ChangeUserNameResponse, response))
//     }

//     actor.addAction({ name: 'tesh', payloadType: ChangeUserName }, TestActionHandler)

//     await system.register()

//     var opts = { command: 'tesh', response: ChangeUserNameResponse, payload: payloadFor(ChangeUserName, { newName: "ué" })}
//     var invokeResp = await spawn.invoke('ggg', opts)

//     var opts2 = { command: 'GetState', response: UserState }
//     var invokeResp2 = await spawn.invoke('ggg', opts2)
// })();
