# [Spawn](https://github.com/eigr/spawn)

**Actor model framework for Node/Bun**

## **Installation**

### Install Spawn CLI

```SH
curl -sSL https://github.com/eigr/spawn/releases/download/v1.4.2/install.sh | sh
```

# **Getting Started**

_We recommend you to use Typescript for better usage overall._

This lib supports both Bun and NodeJS runtimes, Bun performs invocations ~2x faster, we recommend using Bun.

### Create a new project with

```SH
spawn new node hello_world
```

### Run the new project with your preferred package manager

```SH
# with yarn
yarn start

# or with pnpm
pnpm start

# or if you want to use bun instead of NodeJS use:
yarn start-bun
```

### Run the Spawn Proxy using the CLI for dev purposes

```SH
spawn dev run -p ./protos -s spawn-system -W
```

### Invoking the actor

Thats it! You can test invoking the hello world actor with our pre configured HTTP activator.

```SH
curl -vvv -H 'Accept: application/json' http://localhost:9980/v1/hello_world?message=World
```

## **Documentation**
- [Basic usage](./documentation/basic-usage.md)
- [Actor options](./documentation/actor-options.md)
  - [Unnamed](./documentation/actor-options.md#unnamed-actor)
  - [Named](./documentation/actor-options.md#named-actor)
  - [Default Actions](./documentation/actor-options.md#default-actions)
- [Actor workflows](./documentation/actor-workflows.md)
- [Invocations](./documentation/invocations.md)

## **Examples**

You can check [test folder](./test) to see some examples

## **Environment variables:** (you don't need to worry if you are using spawn proxy)

- `PROXY_HTTP_PORT` This is the port of spawn proxy service
- `PROXY_HTTP_HOST` This is the host of spawn proxy service
- `USER_FUNCTION_PORT` This is the port that your service will expose to communicate with Spawn
