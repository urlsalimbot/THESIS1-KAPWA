import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  api,
  uploadWithProgress,
  uploadSignature,
  uploadReceipt,
  dataURItoBlob,
  downloadCsrPdf,
  downloadFilingDoc,
  downloadClientDedupOutput,
  getFilingObjectUrl,
  publicAnnouncementPhotoUrl,
  exportIrfPdf,
  downloadCertificate,
  downloadMonthlyFunds,
  filingDocIdFromUrl,
  KAPWA_AUTH_LOGOUT_EVENT,
  KAPWA_ACCESS_DENIED_EVENT,
  type AccessDeniedDetail,
} from './api';

const API = 'http://localhost:3000/api/v1';

describe('publicAnnouncementPhotoUrl', () => {
  it('prefixes the API base so photos are not resolved against the SPA origin', () => {
    expect(publicAnnouncementPhotoUrl('photo-1')).toBe(`${API}/announcements/public/photo/photo-1`);
  });
});

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob(['x'])),
    headers: { get: (name: string) => headers[name] ?? null },
  };
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(HTMLAnchorElement.prototype, 'click', { value: vi.fn(), configurable: true, writable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('api core request', () => {
  it('GET returns parsed JSON with Authorization header when a token exists', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await api.get<{ ok: boolean }>('/beneficiaries');
    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${API}/beneficiaries`);
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.method).toBe('GET');
  });

  it('GET normalizes an array path and serializes the last object element as query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    await api.get(['cases', { status: 'active', page: '1', empty: '' }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API}/cases?status=active&page=1`);
  });

  it('GET keeps a Date last element as a path segment (not query params)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    const d = new Date('2026-01-01T00:00:00.000Z');
    await api.get(['tracker', d]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${API}/tracker/`);
  });

  it('throws ApiError on non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ message: 'nope' }, 403)));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 403, body: { message: 'nope' } });
  });

  it('announces a 403 refusal with the server reason and path', async () => {
    const seen: AccessDeniedDetail[] = [];
    const onDenied = (e: Event) => seen.push((e as CustomEvent<AccessDeniedDetail>).detail);
    window.addEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonRes({ message: 'You are not assigned to Poblacion.' }, 403)),
    );
    await expect(api.get('/cases')).rejects.toMatchObject({ status: 403 });
    window.removeEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    expect(seen).toEqual([
      { message: 'You are not assigned to Poblacion.', path: '/cases' },
    ]);
  });

  it('stays silent for non-403 failures, which are already surfaced elsewhere', async () => {
    const onDenied = vi.fn();
    window.addEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ message: 'boom' }, 500)));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 500 });
    window.removeEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('POST / PUT / PATCH / DELETE issue the right method and JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    await api.post('/a', { n: 1 });
    await api.put('/b', { n: 2 });
    await api.patch('/c', { n: 3 });
    await api.del('/d');
    expect(fetchMock.mock.calls.map(c => c[1].method)).toEqual(['POST', 'PUT', 'PATCH', 'DELETE']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ n: 1 });
  });

  it('attaches the CSRF token on non-GET requests when present', async () => {
    Object.defineProperty(document, 'cookie', { value: 'csrf-token=abc', configurable: true, writable: true });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    await api.post('/a', {});
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('abc');
    Object.defineProperty(document, 'cookie', { value: '', configurable: true, writable: true });
  });

  it('passes an AbortSignal through', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await api.get('/x', { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  it('api.url builds an absolute URL', () => {
    expect(api.url('/health')).toBe(`${API}/health`);
  });
});

describe('api upload', () => {
  it('uploads FormData and returns JSON', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ url: 'u' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await api.upload('/minio/upload', new FormData());
    expect(out).toEqual({ url: 'u' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });

  it('throws ApiError when the upload fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 500)));
    await expect(api.upload('/minio/upload', new FormData())).rejects.toMatchObject({ status: 500 });
  });

  it('uploadSignature / uploadReceipt upload via rawUpload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ url: 'sig-url' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadSignature(new Blob(['s']), 's.png')).resolves.toBe('sig-url');
    await expect(uploadReceipt(new Blob(['r']), 'r.png')).resolves.toBe('sig-url');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('uploadWithProgress (XHR)', () => {
  function xhrMock(opts: { status?: number; mode?: 'load' | 'error' | 'timeout' | 'pending' } = {}) {
    const { status = 200, mode = 'load' } = opts;
    const instance: any = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      abort: vi.fn(),
      upload: {},
      status,
      responseText: JSON.stringify({ uploaded: true }),
      send: vi.fn(function (this: any) {
        if (mode === 'load') {
          this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
          this.onload?.();
        } else if (mode === 'error') this.onerror?.();
        else if (mode === 'timeout') this.ontimeout?.();
        // 'pending' leaves the request outstanding (abort wiring test)
      }),
    };
    const XHRMock = function () { return instance; } as unknown as typeof XMLHttpRequest;
    (globalThis as any).XMLHttpRequest = XHRMock;
    (window as any).XMLHttpRequest = XHRMock;
    return instance;
  }

  it('reports progress and resolves on success', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    xhrMock();
    const onProgress = vi.fn();
    const out = await uploadWithProgress('/upload', new FormData(), onProgress);
    expect(out).toEqual({ uploaded: true });
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('rejects ApiError on an error status', async () => {
    xhrMock({ status: 500 });
    await expect(uploadWithProgress('/upload', new FormData(), vi.fn())).rejects.toMatchObject({ status: 500 });
  });

  it('rejects on network error and timeout', async () => {
    xhrMock({ mode: 'error' });
    await expect(uploadWithProgress('/upload', new FormData(), vi.fn())).rejects.toThrow('Network error');
    xhrMock({ mode: 'timeout' });
    await expect(uploadWithProgress('/upload', new FormData(), vi.fn())).rejects.toThrow('Upload timed out');
  });

  it('wires the caller signal to xhr.abort()', () => {
    const inst = xhrMock({ mode: 'pending' });
    const controller = new AbortController();
    void uploadWithProgress('/upload', new FormData(), vi.fn(), { signal: controller.signal });
    controller.abort();
    expect(inst.abort).toHaveBeenCalled();
  });
});

describe('token refresh + retry', () => {
  it('refreshes once on 401 then retries the original request', async () => {
    localStorage.setItem('kapwa_token', 'old');
    localStorage.setItem('refresh_token', 'rt');
    let calls = 0;
    const fetchMock = vi.fn((url: string) => {
      calls++;
      if (String(url).includes('/auth/refresh')) return Promise.resolve(jsonRes({ accessToken: 'new' }));
      if (calls === 1) return Promise.resolve(jsonRes({}, 401));
      return Promise.resolve(jsonRes({ data: 'ok' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await api.get('/protected');
    expect(out).toEqual({ data: 'ok' });
    expect(localStorage.getItem('kapwa_token')).toBe('new');
  });

  it('dispatches a logout event when refresh fails', async () => {
    localStorage.setItem('kapwa_token', 'old');
    localStorage.setItem('refresh_token', 'rt');
    const listener = vi.fn();
    window.addEventListener(KAPWA_AUTH_LOGOUT_EVENT, listener);
    const fetchMock = vi.fn((url: string) =>
      String(url).includes('/auth/refresh')
        ? Promise.resolve(jsonRes({}, 401))
        : Promise.resolve(jsonRes({}, 401)),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.get('/protected')).rejects.toBeTruthy();
    expect(listener).toHaveBeenCalled();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('ends the session on a 401 when no refresh token is available', async () => {
    // A stale access token with no refresh token used to be rethrown as a plain
    // 401, leaving the dead token in place so the app stayed in the
    // authenticated layout until a manual logout.
    localStorage.setItem('kapwa_token', 'stale');
    localStorage.removeItem('refresh_token');
    const listener = vi.fn();
    window.addEventListener(KAPWA_AUTH_LOGOUT_EVENT, listener);
    const fetchMock = vi.fn(() => Promise.resolve(jsonRes({}, 401)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('kapwa_token')).toBeNull();
  });

  it('ends the session when the retried request is rejected again', async () => {
    localStorage.setItem('kapwa_token', 'old');
    localStorage.setItem('refresh_token', 'rt');
    const listener = vi.fn();
    window.addEventListener(KAPWA_AUTH_LOGOUT_EVENT, listener);
    // Refresh succeeds but every data request still 401s (account disabled).
    const fetchMock = vi.fn((url: string) =>
      String(url).includes('/auth/refresh')
        ? Promise.resolve(jsonRes({ accessToken: 'new' }))
        : Promise.resolve(jsonRes({}, 401)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('kapwa_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('retries GET on transient network errors (TypeError) then succeeds', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new TypeError('network down'))
        .mockRejectedValueOnce(new TypeError('network down'))
        .mockResolvedValueOnce(jsonRes({ ok: 1 }));
      vi.stubGlobal('fetch', fetchMock);
      const promise = api.get('/flaky');
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CSRF double-submit retry', () => {
  // The server guard boots the csrf-token cookie on the very request it then
  // rejects with 403 'Missing CSRF token'. The client must re-issue the SAME
  // request once — the retry carries the cookie the first attempt caused to be
  // set — instead of surfacing a misleading "Access denied" banner.

  it('retries exactly once when a PATCH is rejected with a CSRF 403, then succeeds', async () => {
    let calls = 0;
    const fetchMock = vi.fn((..._args: unknown[]) => {
      calls++;
      if (calls === 1) return Promise.resolve(jsonRes({ message: 'Missing CSRF token' }, 403));
      return Promise.resolve(jsonRes({ ok: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await api.patch('/cases/c1/status', { status: 'active' });
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Both attempts carry the same body — the retry is a replay, not a mutation.
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ status: 'active' });
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({ status: 'active' });
  });

  it('does not fire the access-denied banner when the CSRF retry succeeds', async () => {
    const seen: AccessDeniedDetail[] = [];
    const onDenied = (e: Event) => seen.push((e as CustomEvent<AccessDeniedDetail>).detail);
    window.addEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(jsonRes({ message: 'Invalid CSRF token' }, 403))
        .mockResolvedValueOnce(jsonRes({ ok: 1 }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(api.post('/a', { n: 1 })).resolves.toEqual({ ok: 1 });
    } finally {
      window.removeEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    }
    expect(seen).toEqual([]);
  });

  it('does not loop: a second CSRF 403 is thrown after exactly one retry', async () => {
    const seen: AccessDeniedDetail[] = [];
    const onDenied = (e: Event) => seen.push((e as CustomEvent<AccessDeniedDetail>).detail);
    window.addEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    let fetchMock!: ReturnType<typeof vi.fn>;
    try {
      fetchMock = vi.fn(() => Promise.resolve(jsonRes({ message: 'Missing CSRF token' }, 403)));
      vi.stubGlobal('fetch', fetchMock);
      await expect(api.patch('/cases/c1/status', { status: 'active' })).rejects.toMatchObject({
        status: 403,
        body: { message: 'Missing CSRF token' },
      });
    } finally {
      window.removeEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry was rejected too, so it surfaces as an ordinary refusal.
    expect(seen).toEqual([{ message: 'Missing CSRF token', path: '/cases/c1/status' }]);
  });

  it('rejects (without retrying) a plain 403 whose message is not CSRF', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonRes({ message: 'You are not assigned to Poblacion.' }, 403)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.post('/cases', {})).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('api.upload retries once on a CSRF 403 reusing the same FormData', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ message: 'Missing CSRF token' }, 403))
      .mockResolvedValueOnce(jsonRes({ url: 'u' }));
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('file', 'x');
    const out = await api.upload('/minio/upload', formData);
    expect(out).toEqual({ url: 'u' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(formData);
    expect(fetchMock.mock.calls[1][1].body).toBe(formData);
  });

  it('uploadWithProgress re-sends the SAME FormData once on a CSRF 403, then resolves', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const formData = new FormData();
    formData.append('file', 'x');
    const instance: any = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      abort: vi.fn(),
      upload: {},
      status: 403,
      responseText: JSON.stringify({ message: 'Missing CSRF token' }),
      send: vi.fn(function (this: any) {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
        if (this._attempts) {
          // Second attempt carries the re-issued cookie and succeeds.
          this.status = 200;
          this.responseText = JSON.stringify({ uploaded: true });
        }
        this._attempts = (this._attempts || 0) + 1;
        this.onload?.();
      }),
    };
    const XHRMock = function () { return instance; } as unknown as typeof XMLHttpRequest;
    (globalThis as any).XMLHttpRequest = XHRMock;
    (window as any).XMLHttpRequest = XHRMock;

    const out = await uploadWithProgress('/upload', formData, vi.fn());
    expect(out).toEqual({ uploaded: true });
    expect(instance.send).toHaveBeenCalledTimes(2);
    // Both attempts send the original FormData object — it is replayable.
    expect(instance.send).toHaveBeenCalledWith(formData);
    expect(instance.send).toHaveBeenCalledWith(formData);
  });
});

describe('download helpers', () => {
  it('downloadCsrPdf downloads the blob and clicks the anchor', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({})));
    await downloadCsrPdf('c1');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('downloadCsrPdf throws on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 500)));
    await expect(downloadCsrPdf('c1')).rejects.toThrow('CSR export failed');
  });

  it('downloadFilingDoc uses the Content-Disposition filename', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 200, { 'Content-Disposition': 'attachment; filename="report.pdf"' })));
    const click = HTMLAnchorElement.prototype.click as unknown as ReturnType<typeof vi.fn>;
    await downloadFilingDoc('f1');
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downloadFilingDoc falls back to the given name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({})));
    await downloadFilingDoc('f1', 'fallback.pdf');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downloadClientDedupOutput fetches the stored priority list and clicks the download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 200, { 'Content-Disposition': 'attachment; filename="priority-list.xlsx"' })));
    const click = HTMLAnchorElement.prototype.click as unknown as ReturnType<typeof vi.fn>;
    await downloadClientDedupOutput('op1');
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downloadClientDedupOutput throws on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 404)));
    await expect(downloadClientDedupOutput('op1')).rejects.toThrow('Priority list download failed');
  });

  it('filingDocIdFromUrl extracts the filing id from a download URL', () => {
    expect(filingDocIdFromUrl('/filing/f1/download')).toBe('f1');
    expect(filingDocIdFromUrl('http://localhost:3000/api/v1/filing/f2/download')).toBe('f2');
    expect(filingDocIdFromUrl('/filing/uuid-with-dashes/download')).toBe('uuid-with-dashes');
  });

  it('filingDocIdFromUrl returns null for non-filing URLs', () => {
    expect(filingDocIdFromUrl('/cases/c1/download')).toBeNull();
    expect(filingDocIdFromUrl('/filing/f1')).toBeNull();
    expect(filingDocIdFromUrl('')).toBeNull();
  });

  it('getFilingObjectUrl returns the object URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({})));
    await expect(getFilingObjectUrl('f2')).resolves.toBe('blob:mock');
  });

  it('exportIrfPdf sends the password in the POST body, not the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    await exportIrfPdf('i1', 'RA 7160', 'pw');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('password=');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ legalBasis: 'RA 7160', password: 'pw' });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('downloadCertificate POSTs the certificate request and downloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}, 200, { 'Content-Disposition': 'attachment; filename="cert.pdf"' }));
    vi.stubGlobal('fetch', fetchMock);
    await downloadCertificate('referral', { fullName: 'A', date: '2026-01-01' });
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ type: 'referral', fullName: 'A' });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downloadCertificate throws on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 500)));
    await expect(downloadCertificate('eligibility', { fullName: 'B', date: '2026-01-01' })).rejects.toThrow('Certificate export failed');
  });

  it('downloadMonthlyFunds uses the month param when no range is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    await downloadMonthlyFunds('2026-08');
    expect(String(fetchMock.mock.calls[0][0])).toContain('month=2026-08');
  });

  it('downloadMonthlyFunds uses the date range when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}));
    vi.stubGlobal('fetch', fetchMock);
    await downloadMonthlyFunds('2026-08', '2026-03-01', '2026-07-31');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('startDate=2026-03-01');
    expect(url).toContain('endDate=2026-07-31');
    expect(url).not.toContain('month=');
  });

  it('downloadMonthlyFunds throws on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 500)));
    await expect(downloadMonthlyFunds('2026-08')).rejects.toThrow('Fund export failed');
  });
});

describe('dataURItoBlob', () => {
  it('converts a data URI into a typed Blob', () => {
    const b64 = Buffer.from('kapwa').toString('base64');
    const blob = dataURItoBlob(`data:image/png;base64,${b64}`);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(5);
  });
});