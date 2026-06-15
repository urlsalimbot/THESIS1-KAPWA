export {};

beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random(),
      subtle: {
        importKey: vi.fn(),
        sign: vi.fn()
      }
    }
  });
});

beforeEach(() => {
  vi.stubGlobal('navigator', {
    onLine: true,
    geolocation: {
      getCurrentPosition: vi.fn()
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});