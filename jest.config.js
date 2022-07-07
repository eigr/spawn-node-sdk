/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@protos/(.*)$': '<rootDir>/src/protos/$1',
    '^@spawn/(.*)$': '<rootDir>/src/$1',
  },
};