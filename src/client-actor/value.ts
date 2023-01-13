import { Broadcast, Effect, Forward, Pipe } from './context'
import { PayloadRef } from '../integration/parsers'

export class Value<T extends object = object, K extends object = object> {
  private _state?: T
  private _response?: PayloadRef<K>
  private _broadcast?: Broadcast
  private _pipe?: Pipe
  private _forward?: Forward
  private _effects?: Effect[]
  private _metadata?: { [key: string]: string }

  static of<T extends object = object, K extends object = object>() {
    return new Value<T, K>()
  }

  state(state: T) {
    this._state = state
    return this
  }

  response(response: PayloadRef<K>) {
    this._response = response
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

  metadata(metadata: { [key: string]: string }) {
    this._metadata = metadata
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
      metadata: this._metadata
    }
  }
}
