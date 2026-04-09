export class UpstreamFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UpstreamFetchError';
  }
}

export class UpstreamNormalizeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UpstreamNormalizeError';
  }
}
