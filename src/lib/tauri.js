// Puente con el core de Tauri. Todo acá degrada con gracia en el navegador:
// si la app NO corre dentro de Tauri, `isTauri()` es false y los wrappers
// tiran un error claro en vez de romper el bundle web.

import { invoke } from '@tauri-apps/api/core';

/** True si el frontend corre embebido en la app desktop Tauri. */
export function isTauri() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

function ensureTauri() {
  if (!isTauri()) {
    throw new Error('Esta acción solo está disponible en la app de escritorio.');
  }
}

/** Lista las impresoras del sistema. -> [{ name, system_name, is_default }] */
export async function listPrinters() {
  ensureTauri();
  return invoke('list_printers');
}

/** Imprime un ticket de prueba en la impresora indicada. */
export async function printTest(printer) {
  ensureTauri();
  return invoke('print_test', { printer });
}

/**
 * Imprime un ticket real.
 * @param {{printer:string,title:string,lines?:Array,qr_data?:string,total_cents?:number,footer?:string}} ticket
 * Los montos van en CENTAVOS (entero), nunca float.
 */
export async function printTicket(ticket) {
  ensureTauri();
  return invoke('print_ticket', { ticket });
}

// --- Secure storage (Credential Manager / Keychain) ---

export async function secureSet(key, value) {
  ensureTauri();
  return invoke('secure_set', { key, value });
}

export async function secureGet(key) {
  ensureTauri();
  return invoke('secure_get', { key });
}

export async function secureDelete(key) {
  ensureTauri();
  return invoke('secure_delete', { key });
}
