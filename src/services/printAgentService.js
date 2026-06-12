// src/services/printAgentService.js
// Cliente del agente local de impresión (boca-print-agent) en la PC de boletería.
// fetch nativo (NO apiClient: distinto origen, sin cookies ni auth).
const DEFAULT_AGENT_URL = 'http://127.0.0.1:9613';

export function getAgentUrl() {
  return localStorage.getItem('printAgentUrl') || DEFAULT_AGENT_URL;
}

export function setAgentUrl(url) {
  localStorage.setItem('printAgentUrl', url);
}

export async function agentStatus() {
  const res = await fetch(`${getAgentUrl()}/status`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Agente respondió ${res.status}`);
  return res.json(); // { ok, transport, printerReachable, version }
}

export async function agentPrint(fglBase64) {
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
  const res = await fetch(`${getAgentUrl()}/test`, { method: 'POST', signal: AbortSignal.timeout(15000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || 'Error en ticket de prueba');
  return body;
}
