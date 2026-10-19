/**
 * The HTTP client the demo seeds share.
 *
 * Double-submit CSRF: the guard sets a readable `csrf-token` cookie on any
 * request that lacks one and refuses unsafe methods without a matching
 * `X-CSRF-Token` header. Node's fetch has no cookie jar, so this script keeps
 * its own — without it every write 403s with "Missing CSRF token".
 */

export const API = process.env.API_BASE || 'http://localhost:3000/api/v1';

let csrfToken: string | null = null;

function captureCsrf(res: Response): void {
  const cookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const m = /^csrf-token=([^;]+)/.exec(cookie);
    if (m) csrfToken = m[1];
  }
}

function csrfHeaders(): Record<string, string> {
  return csrfToken ? { 'X-CSRF-Token': csrfToken, Cookie: `csrf-token=${csrfToken}` } : {};
}

export async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ email, password }),
  });
  captureCsrf(r);
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).accessToken;
}

export async function call(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  label = '',
): Promise<{ status: number; json: any }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...csrfHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  captureCsrf(r);
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (r.status >= 400) console.warn(`  WARN ${label || method} ${path} -> ${r.status}: ${String(text).slice(0, 400)}`);
  return { status: r.status, json };
}

/** Multipart POST; returns the status so the caller can act on a refusal. */
export async function uploadFile(
  token: string,
  path: string,
  fields: Record<string, string>,
  fileName: string,
  bytes: Uint8Array,
  mime = 'application/pdf',
): Promise<number> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  // Buffer is a Uint8Array; TS's BlobPart does not see it through the ArrayBufferLike generic.
  fd.append('file', new Blob([bytes as unknown as BlobPart], { type: mime }), fileName);
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...csrfHeaders() },
    body: fd,
  });
  captureCsrf(r);
  if (r.status >= 400) console.warn(`  WARN upload ${path} -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status;
}
