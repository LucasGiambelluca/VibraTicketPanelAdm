// src/services/ticketTemplateService.js
// API del diseñador de tickets impresos (plantilla global y por evento).
import { apiClient } from '../api/client.js';

// apiClient ya trae baseURL = `${VITE_API_URL}/api` (ver src/api/client.js),
// por eso las rutas acá NO llevan el prefijo /api (mismo patrón que el resto
// de src/services/*.js, ej. discountService.js con BASE_URL = '/discount-codes').
const base = '/admin/ticket-template';

export const getTemplate = (eventId) =>
  apiClient.get(eventId ? `${base}/events/${eventId}` : base).then(r => r.data);

export const saveTemplate = (eventId, config) =>
  apiClient.put(eventId ? `${base}/events/${eventId}` : base, { config }).then(r => r.data);

export const deleteTemplate = (eventId) =>
  apiClient.delete(`${base}/events/${eventId}`).then(r => r.data);

// eventId (opcional, "preview con datos reales del evento" — feature
// 2026-07-10): el body solo lo lleva si es un entero positivo. El backend
// (Joi eventIdSchema en ticketTemplate.controller.js) distingue "ausente"
// (preview con fixture puro) de "presente pero inválido" (400 BadEventId);
// enviar `eventId: null` cuando el diseñador es la plantilla global (prop
// default) rompería esa distinción — JSON.stringify SÍ serializa `null`
// (a diferencia de `undefined`), así que hay que omitir la clave a mano.
export const previewTemplate = (config, fixture, logoFilename, eventId) =>
  apiClient
    .post(`${base}/preview`, { config, fixture, logoFilename, ...(eventId ? { eventId } : {}) })
    .then(r => r.data);

// Calibración física global de la impresora (Fase 5 del motor de cajas):
// ticket de calibración (FGL para imprimir via el agente) + valores medidos.
export const getCalibration = () =>
  apiClient.get(`${base}/calibration`).then(r => r.data);

export const saveCalibration = (calibration) =>
  apiClient.put(`${base}/calibration`, calibration).then(r => r.data);

export const getCalibrationTicket = () =>
  apiClient.get(`${base}/calibration/ticket`).then(r => r.data);

export const uploadLogo = (eventId, file) => {
  const fd = new FormData();
  fd.append('logo', file);
  // apiClient define 'Content-Type': 'application/json' por defecto (ver client.js),
  // así que hay que pisarlo con multipart/form-data explícitamente — mismo patrón
  // usado en apiService.js (eventsApi.createEvent, homepageBannersApi.createBanner, etc.)
  return apiClient
    .post(eventId ? `${base}/events/${eventId}/logo` : `${base}/logo`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data);
};
