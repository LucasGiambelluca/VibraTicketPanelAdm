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

// Codifica bytes a base64 sin reventar el call stack: NO hacemos
// String.fromCharCode(...bytes) de una con arrays grandes (el spread/apply
// de más de ~65k elementos tira "Maximum call stack size exceeded" en varios
// motores JS). Se procesa en chunks chicos y se concatena.
function bytesToBase64(bytes) {
  const CHUNK_SIZE = 0x8000; // 32 KiB
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

// Lee un Blob/File como ArrayBuffer vía FileReader en vez de `Blob#arrayBuffer()`:
// el método nativo no está en todos los entornos (ej. el shim de jsdom usado
// en los tests solo implementa `.slice()`), mientras que FileReader es
// soportado de forma universal, incluido el WebView2 real de la app desktop.
function readAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(blob);
  });
}

// Descompone un FormData en el shape que espera el comando Rust `api_upload`:
// campos de texto (name -> string) y archivos (name -> {filename, mime,
// dataBase64}). `invoke` viaja por IPC como JSON, así que los bytes del
// archivo van codificados en base64 (no hay forma de mandar binario crudo).
async function formDataToPayload(formData) {
  const fields = {};
  const files = {};
  for (const [name, value] of formData.entries()) {
    if (value instanceof Blob) {
      const buf = await readAsArrayBuffer(value);
      const filename = value instanceof File ? value.name : name;
      files[name] = {
        filename,
        mime: value.type || 'application/octet-stream',
        dataBase64: bytesToBase64(new Uint8Array(buf)),
      };
    } else {
      fields[name] = String(value);
    }
  }
  return { fields, files };
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

  // FormData (ej. subida de logo del diseñador de tickets) no puede ir por
  // `api_fetch`: su `body` es un string y un FormData stringificado da "{}".
  // Se manda por un comando dedicado (`api_upload`) que arma el multipart del
  // lado Rust con boundary real. El resto del flujo (respuesta, validateStatus,
  // manejo de errores) es idéntico para ambos casos.
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

  let res;
  try {
    if (isFormData) {
      const { fields, files } = await formDataToPayload(config.data);
      // El Content-Type con boundary lo genera reqwest al armar el multipart;
      // uno "multipart/form-data" sin boundary (como el que pisa axios acá)
      // lo rompería si se reenviara tal cual.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'content-type') delete headers[k];
      }
      res = await invoke('api_upload', {
        method,
        url,
        headers,
        fields,
        files,
      });
    } else {
      let body = config.data;
      if (body != null && typeof body !== 'string') {
        body = JSON.stringify(body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
      res = await invoke('api_fetch', {
        method,
        url,
        headers,
        body: body ?? null,
      });
    }
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
