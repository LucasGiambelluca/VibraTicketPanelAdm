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

export const previewTemplate = (config, fixture, logoFilename) =>
  apiClient.post(`${base}/preview`, { config, fixture, logoFilename }).then(r => r.data);

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
