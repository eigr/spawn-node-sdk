# Invocations

You can invoke actor functions defining:

```TS
import spawn, { payloadFor } from '@eigr/spawn-sdk'

/**
 * InvokeOpts fields:
 * - command - The command to be executed
 * - system - (optional, defaults to current registered system) The system that the actor belongs to
 * - response - (optional) The expected response type
 * - payload - (optional) The payload to be passed to the command
 * - async - (optional) Whether the command should be executed asynchronously
 * - pooled - (optional) Whether the command should be executed in a pooled actor
 * - metadata - (optional) Additional metadata to be passed to the command
 * - ref - (optional) A reference to the abstract actor if you want to also spawn it during invocation, not needing to call spawnActor previously
 * - scheduledTo - (optional) The scheduled date to be executed
 * - delay - (optional) The delay in ms this will be invoked
 */
spawn.invoke('pooledActorExample', {
  command: 'handleSomething', // The command to be executed
  system: 'systemName', // (optional, defaults to current registered system) The system that the actor belongs to
  async: true, // you dont care about the response
  pooled: true, // you are invoking in a Kind.POOLED actor
  ref: "registeredActorName", // you are invoking a Kind.ABSTRACT actor and spawning a instance based on the ActorName of the first arg
  scheduledTo: new Date(new Date().setMinutes(new Date().getMinutes() + 10)), // you are delaying this invoke to 10 minutes
  delay: 10_000, // you are delaying this to 10s in the future
  payload: payloadFor(SomethingActionPayload, { something: 'Something you will be using inside handler' }),
  response: SomethingActionResponse // if you care about the response you have to infer its type to the invoke
})
.then(response => console.log(response))
```
