import { Broadcast, Effect, Forward, Pipe } from './workflows'
import { PayloadRef } from '../integration/parsers'
import { MessageType } from '@protobuf-ts/runtime'
import { SpawnActorError } from '../integration/errors'
import { Noop } from '../protos/eigr/functions/protocol/actors/protocol'
import { payloadFor } from '../spawn'

export class Value<T extends object = object, K extends object = object> {
  private _state?: T
  private _response?: PayloadRef<K> | { [key: string | number]: any }
  private _broadcast?: Broadcast
  private _pipe?: Pipe
  private _forward?: Forward
  private _effects?: Effect[]
  private _tags?: { [key: string]: string }

  static of<T extends object = object, K extends object = object>() {
    return new Value<T, K>()
  }

  state(state: T) {
    this._state = state
    return this
  }

  response(ref: MessageType<K> | PayloadRef<K> | { [key: string | number]: any }, instance?: K) {
    if ((ref as PayloadRef<K>)?.ref === undefined && instance) {
      this._response = payloadFor(ref as MessageType<K>, instance)
    } else if ((ref as PayloadRef<K>).ref && (ref as PayloadRef<K>).instance) {
      this._response = ref as PayloadRef<K>
    } else {
      this._response = ref as { [key: string | number]: any }
    }

    return this
  }

  broadcast(broadcast: Broadcast) {
    this._broadcast = broadcast
    return this
  }

  effects(effects: Effect[]) {
    this._effects = effects
    return this
  }

  pipe(pipe: Pipe) {
    this._pipe = pipe
    return this
  }

  forward(forward: Forward) {
    this._forward = forward
    return this
  }

  tags(tags: { [key: string]: string }) {
    this._tags = tags
    return this
  }

  parse(responseType?: MessageType<any> | 'json') {
    return {
      state: this._state,
      value: this.buildResponse(responseType),
      broadcast: this._broadcast,
      pipe: this._pipe,
      forward: this._forward,
      effects: this._effects,
      tags: this._tags
    }
  }

  private buildResponse(responseType?: MessageType<any> | 'json') {
    if (!this._response) {
      return
    }

    if (Noop.is(this._response)) {
      return this._response
    }

    if ((this._response as PayloadRef<any>).ref !== undefined && (this._response as PayloadRef<any>).instance) {
      return this._response
    }

    if (!responseType) {
      throw new SpawnActorError('You have to define a valid responseType in your actor action and set response with a correct type')
    }
  
    if (responseType === 'json') {
      return this._response
    }

    if (responseType && responseType.is(this._response)) {
      return payloadFor(responseType, this._response)
    }

    throw new SpawnActorError('Specified responseType and response missmatch')
  }
}
