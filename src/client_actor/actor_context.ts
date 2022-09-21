export class ActorContext<T> {
  state: T;

  constructor(state: T) {
    this.state = state;
  }

  getState(): T {
    return this.state;
  }

  setState(state: T): void {
    this.state = state;
  }
}

export type Value<T> = T | void | null;
