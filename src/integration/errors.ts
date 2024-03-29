export class SpawnInvocationError extends Error {
  name: string = 'SpawnInvocationError'
  message: string = ''
  status?: number

  constructor(message: string, status: number) {
    super(message)

    this.message = message
    this.status = status
  }
}

export class SpawnActorError extends Error {
  name: string = 'SpawnActorError'
}

export class SpawnInvocationWrongOutput extends Error {
  name: string = 'SpawnInvocationWrongOutput'
}

export class SpawnInvocationMissingResponse extends Error {
  name: string = 'SpawnInvocationMissingResponse'
}

export class SpawnSystemRegisteredError extends Error {
  name: string = 'SpawnSystemRegisteredError'
}

export class SpawnRegisterError extends Error {
  name: string = 'SpawnRegisterError'
  message: string = ''
  status?: number

  constructor(message: string, status: number) {
    super(message)

    this.message = message
    this.status = status
  }
}
