export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3100/api/v1';
export const PROFILE = __ENV.PROFILE || 'smoke';
export const RESULTS_DIR = __ENV.RESULTS_DIR || './results';
export const UPLOAD = __ENV.UPLOAD === '1';

export const ACCOUNTS = {
  admin: { email: 'admin@mswdo.test', password: 'admin123' },
  worker: { email: 'worker1@mswdo.test', password: 'worker123' },
};

export function profileConfig(profile) {
  const smoke = { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'smoke' };
  const reads = { executor: 'constant-vus', vus: 5, duration: '20s', startTime: '1s', exec: 'reads' };
  switch (profile) {
    case 'smoke':
      return { smoke };
    case 'reads':
      return { smoke, reads };
    default:
      return { smoke, reads };
  }
}
