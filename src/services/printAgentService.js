// src/services/printAgentService.js
// Cliente de impresión BOCA con doble backend:
//   - En el NAVEGADOR: pega por fetch al agente local `boca-print-agent`
//     (http://127.0.0.1:9613), como siempre.
//   - En la APP DESKTOP (Tauri): imprime NATIVO vía comandos Rust (boca_*),
//     sin agente externo. No usa fetch, así el CSP estricto no lo bloquea.
// La firma de las funciones es idéntica en ambos casos: BoxOffice/ManageOrders
// no necesitan cambios.
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/tauri';

const DEFAULT_AGENT_URL = 'http://127.0.0.1:9613';

// --- Config del agente HTTP (navegador) ---
export function getAgentUrl() {
  return localStorage.getItem('printAgentUrl') || DEFAULT_AGENT_URL;
}

export function setAgentUrl(url) {
  localStorage.setItem('printAgentUrl', url);
}

// --- Config BOCA nativa (desktop) ---
// transport: "windows" (USB/spooler) | "tcp" (Ethernet 9100)
const DEFAULT_BOCA_CONFIG = {
  transport: 'windows',
  printer_share: '\\\\localhost\\BOCA',
  host: '',
  port: 9100,
};

export function getBocaConfig() {
  try {
    const raw = localStorage.getItem('bocaConfig');
    return raw ? { ...DEFAULT_BOCA_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_BOCA_CONFIG };
  } catch {
    return { ...DEFAULT_BOCA_CONFIG };
  }
}

export function setBocaConfig(cfg) {
  localStorage.setItem('bocaConfig', JSON.stringify({ ...getBocaConfig(), ...cfg }));
}

// --- API pública (misma firma en ambos backends) ---

export async function agentStatus() {
  if (isTauri()) {
    const r = await invoke('boca_status', { config: getBocaConfig() });
    // Normalizo a la forma que espera la UI (printerReachable camelCase).
    return {
      ok: r.ok,
      transport: r.transport,
      printerReachable: r.printer_reachable,
      version: r.version,
    };
  }
  const res = await fetch(`${getAgentUrl()}/status`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Agente respondió ${res.status}`);
  return res.json(); // { ok, transport, printerReachable, version }
}

export async function agentPrint(fglBase64) {
  if (isTauri()) {
    await invoke('boca_print', { fglBase64: fglBase64, config: getBocaConfig() });
    return { ok: true };
  }
  const res = await fetch(`${getAgentUrl()}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fgl: fglBase64 }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || `Error de impresión (${res.status})`);
  return body;
}

export async function agentTestTicket() {
  if (isTauri()) {
    await invoke('boca_test', { config: getBocaConfig() });
    return { ok: true };
  }
  const res = await fetch(`${getAgentUrl()}/test`, { method: 'POST', signal: AbortSignal.timeout(15000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || 'Error en ticket de prueba');
  return body;
}
