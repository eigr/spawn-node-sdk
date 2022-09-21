import {
  ActorInvocation,
  ActorInvocationResponse
} from '../../protos/eigr/functions/protocol/actors/protocol';
import { Any } from '../../protos/google/protobuf/any';
import GlobalEmitter from '../global_event_emitter';
import { ActorContext } from '../../client_actor/actor_context';
import { MessageType } from '@protobuf-ts/runtime';
import { ServerResponse, IncomingMessage } from 'node:http';
import { sendResponse } from '../server';

function findCommandMetadata(registeredActors: Function[], commandName: string): any | null {
  for (const actorClass of registeredActors) {
    const commandMetadata = Reflect.getMetadata(`actor:command:${commandName}`, actorClass);

    if (commandMetadata) {
      const { actorType } = Reflect.getMetadata('actor:metadata', actorClass);

      return {
        actorType,
        commandFunc: commandMetadata.function,
        messageType: commandMetadata.message,
        responseType: commandMetadata.responseType
      };
    }
  }

  return null;
}

export class InvokeActionsController {
  static registerControllerHandler(req: IncomingMessage, res: ServerResponse, metadata: any = {}) {
    const systemClass = metadata.systemClass;

    req.on('data', (buffer: Buffer) => {
      const { currentContext, actorName, actorSystem, commandName, value } =
        ActorInvocation.fromBinary(buffer);

      const registeredActors: Function[] = Reflect.getMetadata(
        `actor:collection:${actorSystem}`,
        systemClass
      );
      const metadata = findCommandMetadata(registeredActors, commandName);
      const outputType = Reflect.getMetadata(
        `actor:invoke:output:${actorSystem}:${actorName}:${commandName}`,
        systemClass
      ) as MessageType<object>;

      if (!metadata) {
        const resp: ActorInvocationResponse = {
          actorName,
          actorSystem,
          updatedContext: currentContext,
          value
        };

        GlobalEmitter.emit(`actor:command:${actorSystem}:${actorName}:${commandName}`, null);

        return sendResponse(200, res, resp);
      }

      const { actorType, messageType, commandFunc } = metadata;

      const commandValue = actorType.fromBinary(Any.create(currentContext?.state).value);
      const commandMessage = value && messageType?.fromBinary(Any.create(value).value);

      const commandContext = new ActorContext<typeof commandValue>(commandValue);

      const returnValue = commandFunc(...[commandMessage].filter((v) => v), commandContext);

      if (metadata.responseType === 'reply') {
        GlobalEmitter.emit(`actor:command:${actorSystem}:${actorName}:${commandName}`, returnValue);

        console.debug(`Emitting actor:command:${actorSystem}:${actorName}:${commandName}`);
      }

      let resp: ActorInvocationResponse = {
        actorName,
        actorSystem,
        updatedContext: {
          state: Any.pack(commandContext.getState(), actorType)
        }
      };

      if (returnValue && outputType.is(returnValue)) {
        resp.value = Any.pack(returnValue, outputType);
      }

      sendResponse(200, res, resp);
    });
  }
}
