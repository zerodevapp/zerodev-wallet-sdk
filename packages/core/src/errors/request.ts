export class RestRequestError extends Error {
  constructor(
    public url: string,
    public status?: number,
    public body?: unknown,
    public override cause?: unknown,
  ) {
    // Extract error message from backend response format
    // Backend format: { error: "error_code", message: "human readable message" }
    let errorMessage = `Request failed (${status || 'unknown'}): `

    if (body && typeof body === 'object') {
      const errorBody = body as any

      // Prefer message (detailed), fallback to error (code)
      if (errorBody.message && errorBody.error) {
        // Both present: show error code + message
        errorMessage += `${errorBody.error} - ${errorBody.message}`
      } else if (errorBody.message) {
        errorMessage += `${errorBody.message}`
      } else if (errorBody.error) {
        errorMessage += `${errorBody.error}`
      }
    }

    super(errorMessage)
    this.name = 'RestRequestError'
  }
}

export class RestTimeoutError extends Error {
  constructor(public url: string) {
    super(`Request timed out: ${url}`)
    this.name = 'RestTimeoutError'
  }
}
