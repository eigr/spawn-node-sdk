# Actor options

This is an example of what kind of Actors you can create with Spawn

## Unamed Actor

In this example we are creating an actor in a Unamed way, that is, it is a known actor at compile time.

```TS
import spawn, { ActorContext, Kind, Value } from '@eigr/spawn-sdk'
import { UserState, ChangeUserNamePayload, ChangeUserNameResponse, ChangeUserNameStatus } from 'src/protos/examples/user_example'

const system = spawn.createSystem()

// You can register multiple actors with different options
const actor = system.buildActor({
  name: 'unamedActorExample',
  stateType: UserState,
  kind: Kind.UNAMED,
  stateful: true,
  snapshotTimeout: 10_000n,
  deactivatedTimeout: 60_000n
})

// This can be defined in a separate file
const setNameHandler = async (context: ActorContext<UserState>, payload: ChangeUserNamePayload) => {
  return Value.of<UserState, ChangeUserNameResponse>()
    .state({ name: payload.newName })
    .response(ChangeUserNameResponse, { status: ChangeUserNameStatus.OK })
}

// This is similar to a Route definition in REST
actor.addAction({ name: 'setName', payloadType: ChangeUserNamePayload }, setNameHandler)

system.register()
  .then(() => console.log('Spawn System registered'))
```

It can be invoked with:

```TS
import spawn, { payloadFor } from '@eigr/spawn-sdk'
import { ChangeUserNamePayload, ChangeUserNameResponse } from 'src/protos/examples/user_example'

spawn.invoke('unamedActorExample', {
  action: 'setName',
  response: ChangeUserNameResponse,
  payload: payloadFor(ChangeUserNamePayload, { newName: 'newName for actor' })
})
.then(response => console.log(response)) // { status: 1 }
```

## Named Actor

We can also create Unnamed Dynamic/Lazy actors, that is, despite having its Named behavior defined at compile time, a Lazy actor will only have a concrete instance when it is associated with an identifier/name at runtime. Below follows the same previous actor being defined as Named.

```TS
import spawn, { ActorContext, Kind, Value } from '@eigr/spawn-sdk'
import { UserState, ChangeUserNamePayload, ChangeUserNameResponse, ChangeUserNameStatus } from 'src/protos/examples/user_example'

const system = spawn.createSystem()

const actor = system.buildActor({
  name: 'namedActorExample',
  stateType: UserState,
  kind: Kind.NAMED,
  stateful: true,
  snapshotTimeout: 10_000n,
  deactivatedTimeout: 60_000n
})

const setNameHandler = async (context: ActorContext<UserState>, payload: ChangeUserNamePayload) => {
  return Value.of<UserState, ChangeUserNameResponse>()
    .state({ name: payload.newName })
    .response(ChangeUserNameResponse, { status: ChangeUserNameStatus.OK })
}

actor.addAction({ name: 'setName', payloadType: ChangeUserNamePayload }, setNameHandler)

system.register()
  .then(() => console.log('Spawn System registered'))
```

It can be invoked with:

```TS
import spawn, { payloadFor } from '@eigr/spawn-sdk'
import { ChangeUserNamePayload, ChangeUserNameResponse } from 'src/protos/examples/user_example'

spawn.invoke('some-user-id-01', {
  action: 'setName',
  ref: 'namedActorExample',
  response: ChangeUserNameResponse,
  payload: payloadFor(ChangeUserNamePayload, { newName: 'newName for actor some-user-id-01' })
})
.then(response => console.log(response)) // { status: 1 }
```

Notice that the only thing that has changed is the the kind of actor, in this case the kind is set to `Kind.NAMED`
And we need to reference the original name in the invocation or instantiate it before using `spawn.spawnActor`

## Pooled Actor

Sometimes we want a particular actor to be able to serve requests concurrently, however actors will always serve one request at a time using buffering mechanisms to receive requests in their mailbox and serve each request one by one. So to get around this behaviour you can configure your Actor as a Pooled Actor, this way the system will generate a pool of actors to meet certain requests. See an example below:

```TS
import spawn, { ActorContext, Kind, Value, Noop } from '@eigr/spawn-sdk'

const system = spawn.createSystem()

const actor = system.buildActor({
  name: 'pooledActorExample',
  kind: Kind.POOLED,
  minPoolSize: 1,
  maxPoolSize: 5
})

const somethingHandler = async (context: ActorContext<Noop>, payload: SomethingActionPayload) => {
  // you could do anything here with input
  // payload = something

  return Value.of<any, SomethingActionResponse>()
    .response(SomethingActionResponse, { something: true })
}

actor.addAction({ name: 'handleSomething', payloadType: SomethingActionPayload }, somethingHandler)

system.register()
  .then(() => console.log('Spawn System registered'))
```

It can be invoked with:

```TS
import spawn, { payloadFor } from '@eigr/spawn-sdk'

spawn.invoke('pooledActorExample', {
  action: 'handleSomething',
  pooled: true,
  payload: payloadFor(SomethingActionPayload, { something: 'Something you will be using inside handler' })
})
.then(response => console.log(response))
```

## Default Actions

Actors also have some standard actions that are not implemented by the user and that can be used as a way to get the state of an actor without the invocation requiring an extra trip to the host functions. You can think of them as a cache of their state, every time you invoke a default action on an actor it will return the value directly from the Sidecar process without this target process needing to invoke its equivalent host function.

Let's take an example. Suppose Actor Joe wants to know the current state of Actor Robert. What Joe can do is invoke Actor Robert's default action called get_state. This will make Actor Joe's sidecar find Actor Robert's sidecar somewhere in the cluster and Actor Robert's sidecar will return its own state directly to Joe without having to resort to your host function, this in turn will save you a called over the network and therefore this type of invocation is faster than invocations of user-defined actions usually are.

Any invocations to actions with the following names will follow this rule: "get", "Get", "get_state", "getState", "GetState"

> **_NOTE_**: You can override this behavior by defining your actor as an action with the same name as the default actions. In this case it will be the Action defined by you that will be called, implying perhaps another network roundtrip
