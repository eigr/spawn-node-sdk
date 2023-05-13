import { Broadcast, Effect, Forward, Pipe } from './workflows'
import { PayloadRef } from '../integration/parsers'
import { MessageType } from '@protobuf-ts/runtime'
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

  parse() {
    return {
      state: this._state,
      value: this._response,
      broadcast: this._broadcast,
      pipe: this._pipe,
      forward: this._forward,
      effects: this._effects,
      tags: this._tags
    }
  }
}
