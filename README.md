# [Spawn](https://github.com/eigr/spawn) 

**Actor model framework for NodeJS**

## **Installation**

Currently, this framework has a direct dependency of [@protobuf-ts](https://github.com/timostamm/protobuf-ts)

```
npm install spawn-sdk
```

## **Getting Started**

We recommend you to use typescript for better usage overall.

You'll need to make sure Spawn Proxy service is up and running.
With `docker-compose` you can do define: (this is recommended for dev only, see [spawn deploy]() for production examples):

```YML
version: "3.8"

services:
  spawn-proxy:
    image: eigr/spawn-proxy:0.5.0-rc.7
    restart: always
    environment:
      PROXY_APP_NAME: spawn
      PROXY_HTTP_PORT: 9001
      PROXY_DATABASE_TYPE: postgres
      PROXY_DATABASE_NAME: eigr-functions-db
      PROXY_DATABASE_USERNAME: postgres
      PROXY_DATABASE_SECRET: password
      PROXY_DATABASE_HOST: localhost
      PROXY_DATABASE_PORT: 5432
      SPAWN_STATESTORE_KEY: 3Jnb0hZiHIzHTOih7t2cTEPEpY98Tu1wvQkPfq/XwqE=
      USER_FUNCTION_HOST: 0.0.0.0 # Your NodeJS runtime host
      USER_FUNCTION_PORT: 8090 # Your NodeJS runtime exposed port
    ports:
      - "9001:9001"
```

Set two env variables for your NodeJS runtime: 

```bash
SPAWN_PROXY_URL=http://localhost:9001 # This is the actual address of the spawn proxy service

SPAWN_ACTION_PORT=8090 # This is the port that your service will expose to communicate with Spawn
```

## **Documentation**

Run `yarn test`

## **Environment variables:**

- `SPAWN_PROXY_URL` This is the actual address of the spawn proxy service
- `SPAWN_ACTION_PORT` This is the port that your service will expose to communicate with Spawn
