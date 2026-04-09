export class BitacoraAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: string,
    message?: string,
  ) {
    super(message ?? problem);
    this.name = 'BitacoraAuthError';
  }
}
