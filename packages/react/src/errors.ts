/**
 * Thrown when an operation requires a signed-in user but no session exists.
 *
 * Consumers (e.g. `@zerodev/react-wallet-ui`) can `instanceof` this to react
 * with auth UI instead of surfacing the error to the end user.
 */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'NotAuthenticatedError'
  }
}
