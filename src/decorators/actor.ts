import { ActorOpts } from 'actor_opts'
import { MessageType } from "@protobuf-ts/runtime";

export interface ActorMetadata {
    name: string;
    actorType: any;
    instance: object;
    opts: ActorOpts;
}

export function ActorEntity(name: string, actorType: MessageType<object>, opts: ActorOpts) {
    return function(target: any) {        
        const instance = actorType.create();
        const properties = { name, actorType, opts, instance } as ActorMetadata;

        Reflect.defineMetadata('actor:metadata', properties, target)
    };
}

export function Command(responseType: 'reply' | 'noreply' = 'reply', inputMessage: MessageType<object> | null = null) {
    return function (target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
        Reflect.defineMetadata(`actor:command:${propertyKey}`, {function: descriptor.value, message: inputMessage, responseType }, target.constructor)
    };
}