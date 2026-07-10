import { describe, it, expect, vi, beforeEach } from 'vitest';
import tauriAdapter from '../tauriAdapter';

// Mock de `@tauri-apps/api/core`: intercepta `invoke` para verificar qué
// comando Rust se llama y con qué payload, sin necesitar el runtime de Tauri.
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args) => invokeMock(...args),
}));

function baseConfig(data, headers = {}) {
  return {
    url: '/admin/ticket-template/logo',
    baseURL: 'https://admin.vibratickets.online/api',
    method: 'post',
    headers,
    data,
  };
}

describe('tauriAdapter - FormData (multipart)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ status: 200, headers: {}, body: '{"ok":true}' });
  });

  it('un FormData usa api_upload (nunca api_fetch) y separa fields/files', async () => {
    const fd = new FormData();
    fd.append('logo', new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' }));
    fd.append('eventId', '42');

    await tauriAdapter(baseConfig(fd, { 'Content-Type': 'multipart/form-data' }));

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [command, payload] = invokeMock.mock.calls[0];
    expect(command).toBe('api_upload');
    expect(command).not.toBe('api_fetch');

    expect(payload.method).toBe('POST');
    expect(payload.fields).toEqual({ eventId: '42' });
    expect(payload.files.logo).toMatchObject({ filename: 'logo.png', mime: 'image/png' });
    expect(typeof payload.files.logo.dataBase64).toBe('string');

    // El Content-Type "multipart/form-data" (sin boundary) que pisa axios/el
    // servicio no debe reenviarse: reqwest arma el suyo con boundary real.
    const headerKeys = Object.keys(payload.headers).map((k) => k.toLowerCase());
    expect(headerKeys).not.toContain('content-type');
  });

  it('el base64 del archivo hace roundtrip exacto (contenido multi-byte)', async () => {
    const original = 'fake-image-bytes-🎫-ñandú';
    const fd = new FormData();
    fd.append('logo', new File([original], 'logo.png', { type: 'image/png' }));

    await tauriAdapter(baseConfig(fd));

    const [, payload] = invokeMock.mock.calls[0];
    const decoded = Buffer.from(payload.files.logo.dataBase64, 'base64').toString('utf8');
    expect(decoded).toBe(original);
  });

  it('base64 de archivos grandes (> 1 chunk) no rompe y decodifica idéntico', async () => {
    // bytesToBase64 procesa en chunks de 32 KiB; 100000 bytes fuerza varias
    // vueltas del loop y ejercita el borde de cada chunk.
    const bytes = new Uint8Array(100000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const fd = new FormData();
    fd.append('logo', new File([bytes], 'logo.png', { type: 'image/png' }));

    await tauriAdapter(baseConfig(fd));

    const [, payload] = invokeMock.mock.calls[0];
    const decoded = Buffer.from(payload.files.logo.dataBase64, 'base64');
    expect(decoded.length).toBe(bytes.length);
    expect(new Uint8Array(decoded)).toEqual(bytes);
  });

  it('un body JSON normal (no FormData) sigue usando api_fetch sin cambios', async () => {
    await tauriAdapter(baseConfig({ foo: 'bar' }));

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [command, payload] = invokeMock.mock.calls[0];
    expect(command).toBe('api_fetch');
    expect(payload.body).toBe('{"foo":"bar"}');
    expect(payload.fields).toBeUndefined();
    expect(payload.files).toBeUndefined();
  });
});
