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
  const readsQuick = { executor: 'constant-vus', vus: 5, duration: '20s', startTime: '1s', exec: 'reads' };
  const writesQuick = { executor: 'constant-vus', vus: 1, duration: '20s', startTime: '1s', exec: 'writes' };
  const readsFull = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '30s', target: 0 },
    ],
    startTime: '5s',
    exec: 'reads',
  };
  const writesFull = { executor: 'constant-vus', vus: 2, duration: '4m', startTime: '5s', exec: 'writes' };
  switch (profile) {
    case 'smoke':
      return { smoke };
    case 'reads':
      return { smoke, reads: readsQuick };
    case 'writes':
      return { smoke, writes: writesQuick };
    case 'quick':
      return { smoke, reads: readsQuick, writes: writesQuick };
    case 'full':
      return { smoke, reads: readsFull, writes: writesFull };
    default:
      if (profile !== 'full') console.warn(`unknown PROFILE "${profile}", falling back to full`);
      return { smoke, reads: readsFull, writes: writesFull };
  }
}
