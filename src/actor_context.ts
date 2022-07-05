export class ActorContext<T> {
    state: T;
    
    constructor(state: T) {
        this.state = state
    }
}