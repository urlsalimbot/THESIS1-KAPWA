import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, KAPWA_AUTH_LOGOUT_EVENT, dataURItoBlob } from './api';
import { ApiError } from './api-error';

function okJsonResponse(body: unknown, status = 200) {
  return { ok: true, status, statusText: 'OK', json: () => Promise.resolve(body) };
}
function errJsonResponse(body: unknown, status: number, statusText = '') {
  return { ok: false, status, statusText, json: () => Promise.resolve(body) };
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('kapwa_token', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('bearer header', () => {
    it('attaches Authorization: Bearer <token> when token present', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJsonResponse({ data: 'x' }));
      await api.get('/cases');
      const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(call[0])).toContain('/cases');
      expect(call[1].headers.Authorization).toBe('Bearer test-token');
    });

    it('omits Authorization when no token in localStorage', async () => {
      localStorage.clear();
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJsonResponse({}));
      await api.get('/cases');
      const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers.Authorization).toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('aborts the request when the internal 10s timeout fires', async () => {
      let abortHandlerCalled = false;
      (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: RequestInit) => {
          opts.signal?.addEventListener('abort', () => { abortHandlerCalled = true; });
          return new Promise((_resolve, reject) => {
            opts.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          });
        },
      );
      // Use fake timers and flush all of them so the 10s internal timer + backoff sleeps all complete instantly
      vi.useFakeTimers();
      try {
        const promise = api.get('/cases').catch(() => {/* expected after retries fail */});
        for (let i = 0; i < 10; i++) {
          await vi.runAllTimersAsync();
        }
        await promise;
        expect(abortHandlerCalled).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('composes caller signal — caller abort propagates to fetch', async () => {
      const caller = new AbortController();
      let sawAbort = false;
      (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: RequestInit) => {
          opts.signal?.addEventListener('abort', () => { sawAbort = true; });
          return Promise.resolve(okJsonResponse({}));
        },
      );
      const promise = api.get('/cases', { signal: caller.signal });
      caller.abort();
      await promise;
      expect(sawAbort).toBe(true);
    });
  });

  describe('401 refresh single-flight', () => {
    it('refreshes once and retries the original on 401 then 200', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      localStorage.setItem('refresh_token', 'refresh-1');
      fetchMock
        .mockResolvedValueOnce(errJsonResponse({}, 401, 'Unauthorized'))
        .mockResolvedValueOnce(okJsonResponse({ accessToken: 'new', refreshToken: 'new-refresh', user: {} }))
        .mockResolvedValueOnce(okJsonResponse({ result: 'ok' }));

      const result = await api.get('/cases');
      expect(result).toEqual({ result: 'ok' });
      expect(localStorage.getItem('kapwa_token')).toBe('new');
      expect(fetchMock.mock.calls.length).toBe(3);
      const refreshCall = fetchMock.mock.calls[1];
      expect(String(refreshCall[0])).toContain('/auth/refresh');
    });

    it('shares a single in-flight refresh across concurrent 401s', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      localStorage.setItem('refresh_token', 'refresh-1');
      // 3 concurrent api.get calls: actual order is 3 originals → 1 refresh → 3 retries
      fetchMock
        // 3 original 401s
        .mockResolvedValueOnce(errJsonResponse({}, 401))
        .mockResolvedValueOnce(errJsonResponse({}, 401))
        .mockResolvedValueOnce(errJsonResponse({}, 401))
        // 1 refresh 200
        .mockResolvedValueOnce(okJsonResponse({ accessToken: 'shared', refreshToken: 'r2', user: {} }))
        // 3 retries 200
        .mockResolvedValueOnce(okJsonResponse({ from: 1 }))
        .mockResolvedValueOnce(okJsonResponse({ from: 2 }))
        .mockResolvedValueOnce(okJsonResponse({ from: 3 }));

      const [r1, r2, r3] = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
      // All 3 calls resolve successfully (specific from-value depends on retry microtask order)
      expect([1, 2, 3]).toContain((r1 as { from: number }).from);
      expect([1, 2, 3]).toContain((r2 as { from: number }).from);
      expect([1, 2, 3]).toContain((r3 as { from: number }).from);
      const fromValues = new Set([(r1 as { from: number }).from, (r2 as { from: number }).from, (r3 as { from: number }).from]);
      expect(fromValues.size).toBe(3);
      const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
      expect(refreshCalls.length).toBe(1);
    });

    it('does not loop — when refresh itself 401s, throws ApiError(401) and dispatches logout event', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      localStorage.setItem('refresh_token', 'expired');
      fetchMock
        .mockResolvedValueOnce(errJsonResponse({}, 401))
        .mockResolvedValueOnce(errJsonResponse({}, 401));

      const logoutListener = vi.fn();
      window.addEventListener('kapwa:auth:logout', logoutListener);
      try {
        await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
        expect(fetchMock.mock.calls.length).toBe(2);
        expect(logoutListener).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('kapwa_token')).toBeNull();
      } finally {
        window.removeEventListener('kapwa:auth:logout', logoutListener);
      }
    });
  });

  describe('retry on network failure', () => {
    it('retries up to 3 times on TypeError, then succeeds on the 4th attempt', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(okJsonResponse({ ok: 1 }));

      // Use fake timers so the 500+1500+4500ms backoff sums complete instantly.
      // The 10s internal AbortController timeout also uses setTimeout; flush it
      // together with the backoff delays via runAllTimersAsync.
      vi.useFakeTimers();
      try {
        const resultPromise = api.get('/cases');
        // Flush all pending timers in a loop (each retry schedules another setTimeout)
        for (let i = 0; i < 5; i++) {
          await vi.runAllTimersAsync();
        }
        const result = await resultPromise;
        expect(result).toEqual({ ok: 1 });
        expect(fetchMock.mock.calls.length).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does NOT retry on 4xx', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(errJsonResponse({ msg: 'bad' }, 400, 'Bad Request'));
      await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock.mock.calls.length).toBe(1);
    });

    it('does NOT retry on 5xx', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(errJsonResponse({}, 500, 'Internal'));
      await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock.mock.calls.length).toBe(1);
    });

    it('does NOT retry POST on TypeError', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(api.post('/x', { a: 1 })).rejects.toBeInstanceOf(TypeError);
      expect(fetchMock.mock.calls.length).toBe(1);
    });

    it('does NOT retry PUT on TypeError', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(api.put('/x', { a: 1 })).rejects.toBeInstanceOf(TypeError);
      expect(fetchMock.mock.calls.length).toBe(1);
    });

    it('does NOT retry DELETE on TypeError', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(api.del('/x')).rejects.toBeInstanceOf(TypeError);
      expect(fetchMock.mock.calls.length).toBe(1);
    });
  });

  describe('exponential backoff', () => {
    it('uses ~500ms and ~1500ms (±20%) delays between retries', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(okJsonResponse({ ok: 1 }));

      // Spy on setTimeout; the internal 10s timeout (10000ms) is filtered out by the <5000 bound
      // so we capture only the backoff delays.
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;
      const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: () => void, ms?: number) => {
        if (typeof ms === 'number' && ms >= 100 && ms < 5000) delays.push(ms);
        return originalSetTimeout(cb, 0) as unknown as ReturnType<typeof setTimeout>;
      });

      try {
        await api.get('/cases');
        expect(delays.length).toBe(2);
        expect(delays[0]).toBeGreaterThanOrEqual(400);
        expect(delays[0]).toBeLessThanOrEqual(600);
        expect(delays[1]).toBeGreaterThanOrEqual(1200);
        expect(delays[1]).toBeLessThanOrEqual(1800);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('api object shape', () => {
    it('exports api with get/post/put/del methods', () => {
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
      expect(typeof api.put).toBe('function');
      expect(typeof api.del).toBe('function');
    });

    it('api.post serializes body to JSON', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(okJsonResponse({ id: 1 }));
      await api.post('/cases', { foo: 'bar' });
      const call = fetchMock.mock.calls[0];
      expect(call[1].body).toBe(JSON.stringify({ foo: 'bar' }));
    });
  });

  describe('KAPWA_AUTH_LOGOUT_EVENT', () => {
    it('exports the constant value "kapwa:auth:logout"', () => {
      expect(KAPWA_AUTH_LOGOUT_EVENT).toBe('kapwa:auth:logout');
    });
  });

  describe('refresh_network_error dispatch', () => {
    it('dispatches kapwa:auth:logout with reason "refresh_network_error" when /auth/refresh fetch throws', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      localStorage.setItem('refresh_token', 'r');
      fetchMock
        .mockResolvedValueOnce(errJsonResponse({}, 401, 'Unauthorized'))
        .mockRejectedValueOnce(new TypeError('network failure on refresh'));

      const logoutListener = vi.fn();
      window.addEventListener('kapwa:auth:logout', logoutListener);
      try {
        await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
        expect(logoutListener).toHaveBeenCalledTimes(1);
        const event = logoutListener.mock.calls[0][0] as CustomEvent;
        expect(event.detail?.reason).toBe('refresh_network_error');
        expect(localStorage.getItem('kapwa_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
      } finally {
        window.removeEventListener('kapwa:auth:logout', logoutListener);
      }
    });
  });

  describe('path normalization', () => {
    it('joins array path parts with "/" and drops null/undefined/empty segments', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(okJsonResponse({}));
      await api.get(['cases', '123', null, undefined, ''] as readonly unknown[]);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toMatch(/\/cases\/123$/);
    });
  });

  describe('refresh path edge cases', () => {
    it('throws ApiError(401) without calling /auth/refresh when no refresh_token is stored', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      localStorage.removeItem('refresh_token');
      fetchMock.mockResolvedValueOnce(errJsonResponse({}, 401, 'Unauthorized'));

      const logoutListener = vi.fn();
      window.addEventListener('kapwa:auth:logout', logoutListener);
      try {
        await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(logoutListener).not.toHaveBeenCalled();
        const calledUrl = String(fetchMock.mock.calls[0][0]);
        expect(calledUrl).not.toContain('/auth/refresh');
      } finally {
        window.removeEventListener('kapwa:auth:logout', logoutListener);
      }
    });

    it('parses errBody as null when error response has malformed JSON body', async () => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal',
        json: () => Promise.reject(new SyntaxError('unexpected token')),
      });

      try {
        await api.get('/cases');
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(500);
        expect((err as ApiError).body).toBeNull();
      }
      expect(fetchMock.mock.calls.length).toBe(1);
    });

    it('aborts the backoff sleep when caller signal aborts during a retry', async () => {
      const caller = new AbortController();
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValueOnce(new TypeError('network'));

      vi.useFakeTimers();
      try {
        const promise = api.get('/cases', { signal: caller.signal }).catch((e) => e);
        await vi.advanceTimersByTimeAsync(100);
        caller.abort();
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await promise;
        expect(result).toBeInstanceOf(DOMException);
        expect((result as DOMException).name).toBe('AbortError');
        expect(caller.signal.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('dataURItoBlob', () => {
    it('decodes a base64 data URI into a Blob with the declared MIME type', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const blob = dataURItoBlob(dataUrl);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
    });

    it('falls back to image/png MIME type when header has no media-type match', () => {
      const dataUrl = 'data:;base64,YWJj';
      const blob = dataURItoBlob(dataUrl);
      expect(blob.type).toBe('image/png');
    });
  });
});
