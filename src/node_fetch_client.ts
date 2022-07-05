import { InvocationRequest, InvocationResponse, RegistrationRequest, RegistrationResponse } from "@protos/eigr/functions/protocol/actors/protocol";
import fetch from 'node-fetch'

export async function register(registration: RegistrationRequest): Promise<RegistrationResponse> {
    const body = RegistrationRequest.toBinary(registration)

    const res = await fetch('http://localhost:4000/api/v1/system', {
        method: 'POST',
        headers: {
            'Accept': 'application/octet-stream',
            'Content-Type': 'application/octet-stream'
        },
        body
    })

    return RegistrationResponse.fromBinary(await res.buffer())
}

export async function invoke(request: InvocationRequest): Promise<InvocationResponse> {
    const body = InvocationRequest.toBinary(request)

    const res = await fetch(`http://localhost:4000/api/v1/system/${request.system?.name}/actors/${request.actor?.name}/invoke`, {
        method: 'POST',
        headers: {
            'Accept': 'application/octet-stream',
            'Content-Type': 'application/octet-stream'
        },
        body
    })

    return InvocationResponse.fromBinary(await res.buffer())
}
