import {
  InvocationRequest,
  InvocationResponse,
  RegistrationRequest,
  RegistrationResponse,
  Status,
  RequestStatus,
  SpawnRequest,
  SpawnResponse
} from '../protos/eigr/functions/protocol/actors/protocol'
import { SpawnActorError, SpawnInvocationError, SpawnRegisterError } from './errors'
import fetch from 'node-fetch'

const PROXY_URL = process.env.SPAWN_PROXY_URL || 'http://localhost:9001'

export async function registerRequest(
  registration: RegistrationRequest
): Promise<RegistrationResponse> {
  const body = RegistrationRequest.toBinary(registration)

  const res = await fetch(`${PROXY_URL}/api/v1/system`, {
    method: 'POST',
    headers: {
      Accept: 'application/octet-stream',
      'Content-Type': 'application/octet-stream'
    },
    body
  })

  const response = RegistrationResponse.fromBinary(await res.buffer())
  const responseStatus = response.status as RequestStatus

  if (responseStatus?.status && responseStatus?.status !== Status.OK) {
    throw new SpawnRegisterError(responseStatus.message, responseStatus.status)
  }

  return response
}

export async function invokeRequest(request: InvocationRequest): Promise<InvocationResponse> {
  const body = InvocationRequest.toBinary(request)

  const res = await fetch(
    `${PROXY_URL}/api/v1/system/${request.system?.name}/actors/${request.actor?.id?.name}/invoke`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/octet-stream',
        'Content-Type': 'application/octet-stream'
      },
      body
    }
  )

  const response = InvocationResponse.fromBinary(await res.buffer())
  const responseStatus = response.status as RequestStatus

  if (responseStatus?.status && responseStatus?.status !== Status.OK) {
    throw new SpawnInvocationError(responseStatus.message, responseStatus.status)
  }

  return response
}

export async function spawnActorRequest(request: SpawnRequest): Promise<SpawnResponse> {
  const body = SpawnRequest.toBinary(request)

  const res = await fetch(`${PROXY_URL}/api/v1/system/${request.actors[0]?.system}/actors/spawn`, {
    method: 'POST',
    headers: {
      Accept: 'application/octet-stream',
      'Content-Type': 'application/octet-stream'
    },
    body
  })

  const response = SpawnResponse.fromBinary(await res.buffer())
  const responseStatus = response.status as RequestStatus

  if (responseStatus?.status && responseStatus?.status !== Status.OK) {
    throw new SpawnActorError(responseStatus.message)
  }

  return response
}
