// Contract (verified before api.ts was coded):
// /auth/refresh takes body { refreshToken: string } and returns
// { accessToken, refreshToken, user }, with 401 on invalid (auth.controller.ts:33-37).
// Bearer header from localStorage.kapwa_token is the only auth path for /api/*.
export class ApiError extends Error {
  status: number;
  body: unknown;
  cause?: unknown;

  constructor(status: number, body: unknown, message?: string, cause?: unknown) {
    super(message ?? `API error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.cause = cause;
  }
}
