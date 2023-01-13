import { ActorInvocationResponse } from '../protos/eigr/functions/protocol/actors/protocol';
import http, { ServerResponse, IncomingMessage } from 'node:http';
import { registerControllerHandler } from './controller/invoke-actions-controller';
import { ActorCallbackConnector } from '../spawn';

export function sendResponse(status: number, res: ServerResponse, resp: any = null) {
  if (status !== 200 || !resp) {
    res.writeHead(status, {});
    res.write([]);
    res.end();

    return;
  }

  const buf = ActorInvocationResponse.toBinary(resp);

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-disposition': 'attachment; filename=data.json'
  });
  res.write(buf);
  res.end();
}

export function startServer(actorCallbacks: Map<string, ActorCallbackConnector>, port = process.env.SPAWN_ACTION_PORT || 8090) {
  return http
    .createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/api/v1/actors/actions') {
        registerControllerHandler(req, res, actorCallbacks);

        return;
      }

      sendResponse(404, res);
    })
    .listen(port, () => {
      console.log(`[SpawnSystem] Server listening on :${port}`);
    });
}
