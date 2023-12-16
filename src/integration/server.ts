import { ActorInvocationResponse } from '../protos/eigr/functions/protocol/actors/protocol'
import http, { ServerResponse, IncomingMessage } from 'http'
import {
  registerControllerHandlerNode,
  registerControllerHandlerBun
} from './controller/invoke-actions-controller'
import { ActorCallbackConnector } from '../spawn'

export function sendResponse(
  status: number,
  res: ServerResponse | null,
  resp: any = null
): Response | void {
  // this is Bun
  if (res === null) {
    if (resp && status === 200) {
      return new Response(ActorInvocationResponse.toBinary(resp), {
        status,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-disposition': 'attachment; filename=data.json'
        }
      })
    }

    return new Response('', {
      status
    })
  }

  if (status !== 200 || !resp) {
    res.writeHead(status, {})
    res.write('')
    res.end()

    return
  }

  const buf = ActorInvocationResponse.toBinary(resp)

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-disposition': 'attachment; filename=data.json'
  })
  res.write(buf)
  res.end()
}

const getActionPort = (): number | string => process.env.USER_FUNCTION_PORT || 8090

export function startServer(actorCallbacks: Map<string, ActorCallbackConnector>) {
  let server: any = null

  if (typeof Bun !== 'undefined' && typeof Bun.serve === 'function') {
    server = Bun.serve({
      port: getActionPort(),
      fetch(req: Request): Promise<Response> | Response {
        const url = new URL(req.url)
        if (url.pathname === '/api/v1/actors/actions') {
          return registerControllerHandlerBun(req, actorCallbacks)
        }

        return new Response('404!', { status: 404 })
      }
    })
    console.log(`[SpawnSystem] Server listening on :${getActionPort()}`)
  } else {
    const stoppable = require('stoppable')

    server = stoppable(
      http.createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.url === '/api/v1/actors/actions') {
          registerControllerHandlerNode(req, res, actorCallbacks)

          return
        }

        sendResponse(404, res)
      }),
      process.env.NODE_ENV === 'prod' ? 30_000 : 1_000
    )
    server.listen(getActionPort(), () => {
      console.log(`[SpawnSystem] Server listening on :${getActionPort()}`)
    })
  }

  return server
}

export async function stopServer(server: any) {
  if (typeof Bun !== 'undefined' && typeof Bun.serve === 'function') {
    server.stop(true)

    return true
  }

  return new Promise((resolve, reject) => {
    server.stop((err: any) => {
      if (err) return reject()

      resolve(true)
    })
  })
}
