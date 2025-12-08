import { apiClient } from '../api/client';

const BASE_URL = '/discount-codes';

export const discountService = {
  // Listar códigos (alias para getAll)
  listCodes: async (params = {}) => {
    const response = await apiClient.get(BASE_URL, { params });
    return response.data || response;
  },

  // Listar códigos
  getAll: async (params = {}) => {
    const response = await apiClient.get(BASE_URL, { params });
    return response.data || response;
  },

  // Crear código
  createCode: async (data) => {
    const response = await apiClient.post(BASE_URL, data);
    return response.data || response;
  },

  // Crear código (alias)
  create: async (data) => {
    const response = await apiClient.post(BASE_URL, data);
    return response.data || response;
  },

  // Actualizar código
  updateCode: async (id, data) => {
    const response = await apiClient.put(`${BASE_URL}/${id}`, data);
    return response.data || response;
  },

  // Actualizar código (activar/desactivar)
  updateStatus: async (id, isActive) => {
    const action = isActive ? 'activate' : 'deactivate';
    const response = await apiClient.patch(`${BASE_URL}/${id}/${action}`);
    return response.data || response;
  },

  // Activar código
  activateCode: async (id) => {
    const response = await apiClient.patch(`${BASE_URL}/${id}/activate`);
    return response.data || response;
  },

  // Suspender código
  suspendCode: async (id) => {
    const response = await apiClient.patch(`${BASE_URL}/${id}/deactivate`);
    return response.data || response;
  },

  // Eliminar código
  deleteCode: async (id) => {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  // Eliminar código (alias)
  delete: async (id) => {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  // Obtener estadísticas
  getStatistics: async (id) => {
    const response = await apiClient.get(`${BASE_URL}/${id}/statistics`);
    return response.data || response;
  },

  // Validar código (para el frontend de compra)
  validate: async (code, cartTotal) => {
    const response = await apiClient.post(`${BASE_URL}/validate`, { code, cartTotal });
    return response.data || response;
  }
};

