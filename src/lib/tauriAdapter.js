// Adapter de axios para la app desktop (Tauri). En vez de usar XHR/fetch del
// webview (que choca con el CORS del backend y el bloqueo de cookies de
// terceros del WebView2), envía la request al core Rust (`api_fetch`), que la
// hace con reqwest + cookie jar nativo. Para el resto de axios (interceptors,
// transformResponse, validateStatus) el flujo es idéntico.
import { invoke } from '@tauri-apps/api/core';

function buildFullUrl(config) {
  const base = config.baseURL || '';
  let url = config.url || '';
  if (!/^https?:\/\//i.test(url)) {
    url = base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
  }
  // Query params
  if (config.params && typeof config.params === 'object') {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(config.params)) {
      if (v === undefined || v === null) continue;
      usp.append(k, String(v));
    }
    const qs = usp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

function flattenHeaders(config) {
  const out = {};
  const src = config.headers || {};
  // axios v1 headers pueden venir anidados por método (common, get, post...).
  const merge = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'object' && !Array.isArray(v)) continue; // sub-objeto de método
      out[k] = String(v);
    }
  };
  merge(src.common);
  merge(src[(config.method || 'get').toLowerCase()]);
  merge(src);
  return out;
}

export default async function tauriAdapter(config) {
  const url = buildFullUrl(config);
  const method = (config.method || 'get').toUpperCase();
  const headers = flattenHeaders(config);

  let body = config.data;
  if (body != null && typeof body !== 'string') {
    body = JSON.stringify(body);
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  let res;
  try {
    res = await invoke('api_fetch', {
      method,
      url,
      headers,
      body: body ?? null,
    });
  } catch (e) {
    // Fallo de red real (host caído, sin internet, etc.)
    const err = new Error(typeof e === 'string' ? e : 'Network Error');
    err.config = config;
    err.request = {};
    return Promise.reject(err);
  }

  const response = {
    data: res.body,
    status: res.status,
    statusText: '',
    headers: res.headers,
    config,
    request: {},
  };

  const validate = config.validateStatus;
  if (!validate || validate(response.status)) {
    return response;
  }
  const err = new Error(`Request failed with status code ${response.status}`);
  err.config = config;
  err.request = {};
  err.response = response;
  return Promise.reject(err);
}
