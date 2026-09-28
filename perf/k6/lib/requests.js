import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config.js';
import { authHeaders } from './auth.js';

function endpointTag(path) {
  return path.split('?')[0];
}

export function get(path, token, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, { headers: authHeaders(token), tags: { endpoint: endpointTag(path), ...tags } });
  check(res, { [`GET ${endpointTag(path)} 2xx`]: r => r.status >= 200 && r.status < 300 });
  return res;
}

export function getAllow422(path, token, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(token),
    tags: { endpoint: endpointTag(path), ...tags },
    responseCallback: http.expectedStatuses(200, 422),
  });
  check(res, { [`GET ${endpointTag(path)} 200/422`]: r => r.status === 200 || r.status === 422 });
  return res;
}

export function postJson(path, token, body, tags = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers: authHeaders(token), tags: { endpoint: endpointTag(path), ...tags } });
}

export function think(min = 0.3, max = 1.2) {
  sleep(min + Math.random() * (max - min));
}
