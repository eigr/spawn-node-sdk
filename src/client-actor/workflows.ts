import { ActorId } from '../protos/eigr/functions/protocol/actors/actor'
import { PayloadRef } from '../integration/parsers'

export type ActorContext<T> = {
  state: T
  caller: ActorId
  self: ActorId
  metadata: { [key: string]: string }
  tags: { [key: string]: string }
}

export type Broadcast = {
  channel: string
  action?: string
  payload: PayloadRef<any> | { [key: number | string]: any }
}

export type Effect = {
  actorName: string
  action: string
  payload: PayloadRef<any> | { [key: number | string]: any }
  scheduledTo?: Date | number
}

export type Pipe = {
  actorName: string
  action: string
}

export type Forward = {
  actorName: string
  action: string
}
