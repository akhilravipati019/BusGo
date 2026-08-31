import { supabase } from './supabase.js';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function getToken(forceRefresh = false) {
  let { data } = await supabase.auth.getSession();
  let session = data?.session;
  const expiresSoon = session && session.expires_at * 1000 - Date.now() < 60_000;

  if (session && (forceRefresh || expiresSoon)) {
    const { data: r } = await supabase.auth.refreshSession();
    if (r?.session) session = r.session;
  }
  return session?.access_token || null;
}

async function authHeader(forceRefresh = false) {
  const token = await getToken(forceRefresh);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  }
  if (!res.ok) throw new Error('Request failed');
  return res;
}

async function withRetry(makeInit, path) {
  let res = await fetch(BASE + path, await makeInit(false));
  if (res.status === 401) {
    res = await fetch(BASE + path, await makeInit(true));
  }
  return res;
}

const jsonInit = (method, body) => async (forceRefresh) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(await authHeader(forceRefresh)) },
  body: JSON.stringify(body || {}),
});

const plainInit = (method) => async (forceRefresh) => ({
  method,
  headers: { ...(await authHeader(forceRefresh)) },
});

export const api = {
  get: async (path) => handle(await withRetry(plainInit('GET'), path)),
  post: async (path, body) => handle(await withRetry(jsonInit('POST', body), path)),
  put: async (path, body) => handle(await withRetry(jsonInit('PUT', body), path)),
  del: async (path) => handle(await withRetry(plainInit('DELETE'), path)),

  raw: async (path) => withRetry(plainInit('GET'), path),
};
