# [Spawn](https://github.com/eigr/spawn)

**Actor model framework for Node/Bun**

## **Installation**

```
yarn add @eigr/spawn-sdk
```

_This package depends on `@protobuf-ts/plugin` to work with protobufs_

# **Getting Started**

_We recommend you to use Typescript for better usage overall._

This lib supports both Bun and NodeJS runtimes, Bun performs invocations ~2x faster, we recommend using Bun.

## Basic Usage

```TS
import spawn, { ActorContext, Value } from '@eigr/spawn-sdk'
import { UserState, ChangeUserNamePayload, ChangeUserNameStatus } from 'src/protos/examples/user_example'

const system = spawn.createSystem('spawn-system')

// You can register multiple actors with different options
const actor = system.buildActor({
  name: 'exampleActor',
  stateType: UserState,
  stateful: true,
  snapshotTimeout: 10_000n,
  deactivatedTimeout: 60_000n
})

// This can be defined in a separate file
const setNameHandler = async (context: ActorContext<UserState>, payload: ChangeUserNamePayload) => {
  return Value.of<UserState, ChangeUserNameResponse>()
    .state({ name: payload.newName })
    .response({ status: ChangeUserNameStatus.OK })
}

// This is similar to a Route definition in REST
actor.addAction({ name: 'SetName', payloadType: ChangeUserNamePayload, responseType: ChangeUserNameResponse }, setNameHandler)

system.register()
  .then(() => console.log('Spawn System registered'))
```

With this configured, you can invoke this actor anywhere you want with:

```TS
import spawn, { payloadFor } from '@eigr/spawn-sdk'
import { UserState, ChangeUserNamePayload, ChangeUserNameResponse } from 'src/protos/examples/user_example'

(async () => {
  const payload = { newName: 'changedName' } as ChangeUserNamePayload
  const response: ChangeUserNameResponse = await spawn.invoke('exampleActor', {
    action: 'setName',
    response: ChangeUserNameResponse,
    payload: payloadFor(ChangeUserNamePayload, payload),
    system: 'spawn-system'
  })

  const state: UserState = await spawn.invoke('exampleActor', {
    action: 'getState',
    response: UserState,
    system: 'spawn-system'
  })

  console.log(state) // { name: 'changedName' }
})()
```

## Using protobufs

> **_NOTE:_** _Its recommended to use Protobufs to ensure your contracts will always be what you expect and also for performance improvements_

Define a protobuf file (lets save this at `protos/examples/user_example.proto`), if you want to skip this part, you can use 'json' type actors.

```proto
syntax = "proto3";

message UserState {
  string name = 1;
}

message ChangeUserNamePayload {
  string new_name = 1;
}

enum ChangeUserNameStatus {
  NAME_ALREADY_TAKEN = 0;
  OK = 1;
}

message ChangeUserNameResponse {
  ChangeUserNameStatus status = 1;
}
```

Compile proto with protoc using [ts-protoc-gen](https://github.com/improbable-eng/ts-protoc-gen):

```BASH
protoc --ts_out ./src/protos/ --proto_path protos protos/**/*.proto
```

With this, it should generate a file at `src/protos/examples/user_example.ts`, we will use this generated module for Actor definitions and invocations.

## Running the Proxy

You'll need to make sure Spawn Proxy service is up and running.
With `docker-compose` you can define:

> **_NOTE:_** _you can start the proxy using the `spawn cli`, see [spawn deploy](https://github.com/eigr/spawn#getting-started) for production examples._

```YML
version: "3.8"

services:
  spawn-proxy:
    image: eigr/spawn-proxy:1.1.0
    restart: always
    environment:
      PROXY_ACTOR_SYSTEM_NAME: "spawn-system" # change this to the system you've registered
      PROXY_APP_NAME: spawn-typescript
      PROXY_HTTP_PORT: 9001
      PROXY_DATABASE_TYPE: postgres
      PROXY_DATABASE_NAME: eigr-functions-db
      PROXY_DATABASE_USERNAME: postgres
      PROXY_DATABASE_SECRET: password
      PROXY_DATABASE_HOST: localhost
      PROXY_DATABASE_PORT: 5432
      SPAWN_STATESTORE_KEY: 3Jnb0hZiHIzHTOih7t2cTEPEpY98Tu1wvQkPfq/XwqE=
      USER_FUNCTION_HOST: 0.0.0.0 # Your NodeJS runtime host
      USER_FUNCTION_PORT: 8090 # Your NodeJS runtime exposed port
    network_mode: host
    ports:
      - "9001:9001"
```

> **NOTE:** `Windows w/ WSL2` - If you want to use docker for spawn-proxy and local host for your NodeJS check this article https://www.beyondjava.net/docker-wsl-network

Set the following ENV variables for your NodeJS runtime (following .env.example)

```bash
PROXY_HTTP_PORT=9001
PROXY_HTTP_HOST=localhost
USER_FUNCTION_PORT=8090
```

## **Documentation**

- [Actor options](./documentation/actor-options.md)
  - [Unnamed](./documentation/actor-options.md#unnamed-actor)
  - [Named](./documentation/actor-options.md#named-actor)
  - [Default Actions](./documentation/actor-options.md#default-actions)
- [Actor workflows](./documentation/actor-workflows.md)
- [Invocations](./documentation/invocations.md)

## **Examples**

You can check [test folder](./test) to see some examples

## **Environment variables:** (you don't need to worry if you are using spawn proxy)

- `PROXY_HTTP_PORT` This is the port of spawn proxy service
- `PROXY_HTTP_HOST` This is the host of spawn proxy service
- `USER_FUNCTION_PORT` This is the port that your service will expose to communicate with Spawn
