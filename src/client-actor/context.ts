import { ActorId } from '../protos/eigr/functions/protocol/actors/actor'
import { PayloadRef } from '../integration/parsers'

export type ActorContext<T> = {
  state: T
  caller: ActorId
  self: ActorId
  metadata: { [key: string]: string }
}

export type Broadcast = {
  channel: string
  command: string
  payload: PayloadRef<any>
}

export type Effect = {
  actorName: string
  command: string
  payload: PayloadRef<any>
  scheduledTo?: Date | number
}

export type Pipe = {
  actorName: string
  command: string
}

export type Forward = {
  actorName: string
  command: string
}
