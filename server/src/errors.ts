// Typed HTTP error -> { error, code } JSON body.
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (msg: string, code = 'BAD_REQUEST') => new HttpError(400, code, msg);
export const upstream = (msg: string, code = 'UPSTREAM_ERROR') => new HttpError(502, code, msg);
