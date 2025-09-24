export class RestRequestError extends Error {
  constructor(
    public url: string,
    public status?: number,
    public body?: unknown,
    public override cause?: unknown
  ) {
    super(`Request failed${status ? ` (${status})` : ""}: ${url}`);
    this.name = "RestRequestError";
  }
}

export class RestTimeoutError extends Error {
  constructor(public url: string) {
    super(`Request timed out: ${url}`);
    this.name = "RestTimeoutError";
  }
}
