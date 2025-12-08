import { apiClient } from '../api/client.js';

// Base API URL
const API_BASE = '';

// ============================================
// AUTH API - Autenticación y Registro
// ============================================
export const authApi = {
  // Registro de nuevo usuario
  register: (userData) => {
    // userData: { email, password, name, dni?, country?, phone?, role? }
    return apiClient.post(`${API_BASE}/auth/register`, userData);
  },

  // Login de usuario
  login: (credentials) => {
    // credentials: { email, password }
    return apiClient.post(`${API_BASE}/auth/login`, credentials);
  },

  // Logout de usuario (limpiar cookie)
  logout: () => {
    return apiClient.post(`${API_BASE}/auth/logout`);
  },

  // Verificar si email está disponible
  checkEmail: (email) => {
    return apiClient.post(`${API_BASE}/auth/check-email`, { email });
  },

  // OAuth - Google Login
  googleLogin: (data) => {
    // data: { token: "google-id-token" }
    return apiClient.post(`${API_BASE}/auth/google`, data);
  },

  // OAuth - Facebook Login
  facebookLogin: (data) => {
    // data: { accessToken: "facebook-access-token", userID: "facebook-user-id" }
    return apiClient.post(`${API_BASE}/auth/facebook`, data);
  },

  // ============================================
  // SISTEMA DE RECUPERACIÓN DE CONTRASEÑA CON CÓDIGOS NUMÉRICOS
  // ============================================
  
  // 1. Solicitar código de recuperación (6 dígitos, expira en 60s)
  requestPasswordReset: (email) => {
    // email: string
    // Response: { success: true, message: string, expiresIn: 60 }
    return apiClient.post(`${API_BASE}/password-reset/request`, { email });
  },

  // 2. Verificar código (opcional - puede verificarse directamente en reset)
  verifyResetCode: (email, code) => {
    // email: string, code: string (6 dígitos)
    // Response: { success: true, message: string, valid: true }
    return apiClient.post(`${API_BASE}/password-reset/verify`, { email, code });
  },

  // 3. Restablecer contraseña con código
  resetPasswordWithCode: (email, code, newPassword) => {
    // email: string, code: string (6 dígitos), newPassword: string
    // Response: { success: true, message: "Contraseña restablecida exitosamente" }
    return apiClient.post(`${API_BASE}/password-reset/reset`, { email, code, newPassword });
  },
  
  // ENDPOINTS DEPRECADOS (mantener por compatibilidad temporal)
  forgotPassword: (email) => {
    console.warn('[DEPRECADO] Usa requestPasswordReset() en su lugar');
    return apiClient.post(`${API_BASE}/password-reset/request`, { email });
  },
  
  resetPassword: (data) => {
    console.warn('[DEPRECADO] Usa resetPasswordWithCode() en su lugar');
    const { email, code, newPassword } = data;
    return apiClient.post(`${API_BASE}/password-reset/reset`, { email, code, newPassword });
  },

  // Verify Reset Token - Verificar si un token es válido (opcional)
  verifyResetToken: (token) => {
    return apiClient.post(`${API_BASE}/auth/verify-reset-token`, { token });
  }
};

// ============================================
// USERS API - Gestión de Usuarios
// ============================================
export const usersApi = {
  // Obtener perfil del usuario autenticado
  getMe: () => {
    return apiClient.get(`${API_BASE}/users/me`);
  },

  // Actualizar perfil del usuario
  updateMe: (userData) => {
    // userData: { name?, phone?, dni?, country? }
    return apiClient.put(`${API_BASE}/users/me`, userData);
  },

  // Cambiar contraseña
  changePassword: (passwords) => {
    // passwords: { currentPassword, newPassword }
    return apiClient.post(`${API_BASE}/users/me/change-password`, passwords);
  },

  // Obtener órdenes del usuario
  getMyOrders: () => {
    return apiClient.get(`${API_BASE}/users/me/orders`);
  },

  // Obtener tickets del usuario
  getMyTickets: () => {
    return apiClient.get(`${API_BASE}/tickets/my-tickets`);
  },

  // Obtener mis reservas temporales (holds)
  getMyHolds: (params = {}) => {
    const { active = 'true' } = params;
    return apiClient.get(`${API_BASE}/users/me/holds`, { active });
  }
};

// ============================================
// ADMIN USERS API - Gestión de Usuarios (Solo ADMIN)
// ============================================
export const adminUsersApi = {
  // Crear usuario (ORGANIZER, PRODUCER, DOOR, ADMIN)
  createUser: (userData) => {
    // userData: { email, password, name, role, dni?, country?, phone?, isActive? }
    return apiClient.post(`${API_BASE}/admin/users`, userData);
  },

  // Listar usuarios con filtros y paginación
  listUsers: (params = {}) => {
    const { role, isActive, search, page = 1, limit = 20 } = params;
    const query = { page, limit };
    if (role) query.role = role;
    if (typeof isActive !== 'undefined' && isActive !== null && isActive !== '') query.isActive = isActive;
    if (search) query.search = search;
    return apiClient.get(`${API_BASE}/admin/users`, { params: query });
  },

  // Obtener usuario específico con estadísticas
  getUserById: (userId) => {
    return apiClient.get(`${API_BASE}/admin/users/${userId}`);
  },

  // Actualizar usuario
  updateUser: (userId, userData) => {
    // userData: { name?, role?, isActive?, phone?, country? }
    const payload = { ...userData };
    // Compatibilidad con backends que usan snake_case
    if (Object.prototype.hasOwnProperty.call(userData, 'isActive')) {
      payload.is_active = userData.isActive;
    }
    return apiClient.put(`${API_BASE}/admin/users/${userId}`, payload);
  },

  // Eliminar usuario (si el backend lo soporta)
  deleteUser: (userId) => {
    return apiClient.delete(`${API_BASE}/admin/users/${userId}`);
  },

  // Ver reservas de un usuario
  getUserHolds: (userId, params = {}) => {
    const { active = 'true' } = params;
    return apiClient.get(`${API_BASE}/admin/users/${userId}/holds`, { active });
  }
};

// ============================================
// ADMIN PAYMENTS API - Monitor de Pagos (Solo ADMIN)
// ============================================
export const adminPaymentsApi = {
  // Obtener logs de pagos con filtros y paginación
  // RUTA: GET /api/admin/payments/logs
  getPaymentLogs: (params = {}) => {
    const { page = 1, limit = 20, status, orderId, paymentId } = params;
    const query = { page, limit };
    if (status) query.status = status;
    if (orderId) query.orderId = orderId;
    if (paymentId) query.paymentId = paymentId;
    return apiClient.get(`${API_BASE}/admin/payments/logs`, { params: query });
  },

  // Reembolsar pago (total o parcial)
  // RUTA: POST /api/payments/refund/:orderId
  refundPayment: (orderId, refundData = {}) => {
    // refundData: { amount?, reason? }
    return apiClient.post(`${API_BASE}/payments/refund/${orderId}`, refundData);
  }
};

// Events API
export const eventsApi = {
  // Lista paginada y filtrada de eventos
  getEvents: (params = {}) => {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'active', 
      sortBy = 'created_at', 
      sortOrder = 'DESC',
      // Filtros adicionales
      category,
      city,
      dateFrom,
      dateTo,
      priceMin,
      priceMax
    } = params;
    
    return apiClient.get(`${API_BASE}/events`, { 
      params: {
        page, 
        limit, 
        search, 
        status, 
        sortBy, 
        sortOrder,
        category,
        city,
        dateFrom,
        dateTo,
        priceMin,
        priceMax
      }
    });
  },

  // Búsqueda rápida (autocomplete)
  searchEvents: (query, limit = 10) => {
    return apiClient.get(`${API_BASE}/events/search`, { params: { q: query, limit } });
  },

  // Obtener evento específico
  getEvent: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}`);
  },

  // Obtener tipos de tickets de un evento
  getEventTicketTypes: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/ticket-types`);
  },

  // Crear evento - manejo inteligente de FormData vs JSON
  createEvent: (eventData) => {
    // Si es FormData, verificar si tiene imagen
    if (eventData instanceof FormData) {
      let hasImage = false;
      let imageFile = null;
      
      // Buscar archivo de imagen
      for (let [key, value] of eventData.entries()) {
        if (key === 'image' && value instanceof File && value.size > 0) {
          hasImage = true;
          imageFile = value;
          break;
        }
      }
      
      if (hasImage) {
        return apiClient.post(`${API_BASE}/events`, eventData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Convertir FormData a objeto JSON si no hay imagen
        const jsonData = {};
        for (let [key, value] of eventData.entries()) {
          if (key !== 'image') { // Excluir campo image vacío
            jsonData[key] = value;
          }
        }

        return apiClient.post(`${API_BASE}/events`, jsonData);
      }
    }
    
    // Si no es FormData, enviar como JSON directamente
    return apiClient.post(`${API_BASE}/events`, eventData);
  },

  // Actualizar evento
  updateEvent: (eventId, eventData) => {
    if (eventData instanceof FormData) {
      return apiClient.put(`${API_BASE}/events/${eventId}`, eventData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.put(`${API_BASE}/events/${eventId}`, eventData);
  },

  // Eliminar evento
  deleteEvent: (eventId) => {
    return apiClient.delete(`${API_BASE}/events/${eventId}`);
  },

  // Event CMS (Imágenes y Estilos)
  uploadEventImage: (eventId, imageType, imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return apiClient.post(`${API_BASE}/events/${eventId}/images/${imageType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getEventStyles: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/styles`);
  },

  updateEventStyles: (eventId, styles) => {
    return apiClient.put(`${API_BASE}/events/${eventId}/styles`, styles);
  }
};

// Banners API
export const bannersApi = {
  // Listar todos los banners
  getAll: () => {
    return apiClient.get(`${API_BASE}/api/homepage/banners/all`);
  },

  // Crear banner
  create: (bannerData) => {
    // bannerData: FormData con title, link, image, priority
    return apiClient.postFormData(`${API_BASE}/api/homepage/banners`, bannerData);
  },

  // Reordenar banners
  reorder: (bannerIds) => {
    return apiClient.put(`${API_BASE}/api/homepage/banners/reorder`, { bannerIds });
  }
};

// Shows API
export const showsApi = {
  // Obtener info de un show
  getShow: (showId) => {
    return apiClient.get(`${API_BASE}/shows/${showId}`);
  },

  // Obtener asientos de un show
  getShowSeats: (showId) => {
    return apiClient.get(`${API_BASE}/shows/${showId}/seats`);
  },

  // Obtener tickets emitidos de un show (para workaround de status)
  getShowTickets: (showId) => {
    return apiClient.get(`${API_BASE}/shows/${showId}/tickets`);
  },

  // Listar secciones (localidades) de un show
  getShowSections: (showId) => {
    return apiClient.get(`${API_BASE}/shows/${showId}/sections`);
  },

  // Crear secciones (admin)
  createSection: (showId, sectionData) => {
    return apiClient.post(`${API_BASE}/shows/${showId}/sections`, sectionData);
  },

  // Actualizar sección (admin)
  updateSection: (showId, sectionId, sectionData) => {
    return apiClient.put(`${API_BASE}/shows/${showId}/sections/${sectionId}`, sectionData);
  },

  // Eliminar sección (admin)
  deleteSection: (showId, sectionId) => {
    return apiClient.delete(`${API_BASE}/shows/${showId}/sections/${sectionId}`);
  },

  // Listar shows con filtros (admin) – soporta eventId
  listShows: (params = {}) => {
    return apiClient.get(`${API_BASE}/shows`, { params });
  },

  // Crear show (admin) – Backend solo espera eventId y startsAt
  createShow: ({ eventId, startsAt }) => {
    return apiClient.post(`${API_BASE}/shows`, { eventId, startsAt });
  },

  // Actualizar show (admin)
  updateShow: (showId, showData) => {
    return apiClient.put(`${API_BASE}/shows/${showId}`, showData);
  },

  // Eliminar show (admin)
  deleteShow: (showId) => {
    return apiClient.delete(`${API_BASE}/shows/${showId}`);
  },

  // Backward compatibility: listar shows por evento (si existiera esa ruta)
  getEventShows: (eventId) => apiClient.get(`${API_BASE}/events/${eventId}/shows`)
};

// ============================================
// QUEUE API - Sistema de Cola Virtual
// ============================================
export const queueApi = {
  // Unirse a la cola de un show
  joinQueue: (showId, customerEmail) =>
    apiClient.post(`${API_BASE}/queue/${showId}/join`, {
      showId,
      customerEmail
    }),

  // Obtener posición actual en la cola
  getPosition: (showId) =>
    apiClient.get(`${API_BASE}/queue/${showId}/position`),

  // Obtener estado general de la cola (público)
  getStatus: (showId) =>
    apiClient.get(`${API_BASE}/queue/${showId}/status`),

  // Reclamar acceso cuando estás primero
  claimAccess: (showId) =>
    apiClient.post(`${API_BASE}/queue/${showId}/claim-access`, {}),

  // Salir de la cola
  leaveQueue: (showId) =>
    apiClient.delete(`${API_BASE}/queue/${showId}/leave`),

  // Verificar si un token de acceso es válido
  verifyAccess: (showId, accessToken) =>
    apiClient.post(`${API_BASE}/queue/${showId}/verify-access`, {
      accessToken
    }),

  // Procesar siguiente (admin)
  processNext: (showId) =>
    apiClient.post(`${API_BASE}/queue/${showId}/process-next`),

  // Estadísticas (admin)
  getQueueStats: (showId) =>
    apiClient.get(`${API_BASE}/queue/${showId}/stats`)
};

// ⚠️ DEPRECADO: holdsApi y ordersApi antiguos eliminados
// Ver nuevas implementaciones más abajo con soporte para Idempotency-Key

// Reservations API - Sistema de reservas (Compatible con backend actual)
export const reservationsApi = {
  // Crear reservas para un show y sección
  createReservations: (showId, reservationData) => {
    // reservationData: { sectionId, quantity, seats?, customerInfo? }
    return apiClient.post(`${API_BASE}/shows/${showId}/reservations`, reservationData);
  },

  // Obtener reservas del usuario
  getMyReservations: () => {
    return apiClient.get(`${API_BASE}/reservations/me`);
  },

  // Cancelar reserva
  cancelReservation: (reservationId) => {
    return apiClient.delete(`${API_BASE}/reservations/${reservationId}`);
  }
};

// ============================================
// HOLDS API - Sistema de reservas temporales (15 min)
// ============================================
// Generar Idempotency-Key única para cada hold
// Función helper para generar idempotency key
function generateIdempotencyKey(prefix = 'hold') {
  // Usar crypto.randomUUID si está disponible, sino fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${random}`;
}

// Función para obtener o crear idempotency key persistente
function getOrCreateIdempotencyKey(kind) {
  const keyName = `idem-${kind}`;
  let key = localStorage.getItem(keyName);
  if (!key) {
    key = generateIdempotencyKey(kind);
    localStorage.setItem(keyName, key);
  }
  return key;
}

export const holdsApi = {
  // Crear HOLD (reserva temporal de 15 minutos)
  // RUTA: POST /api/holds
  createHold: (holdData, usePersistedKey = false) => {
    // holdData: { showId, seatIds, customerEmail?, customerName? }
    // IMPORTANTE: Requiere header 'Idempotency-Key' con UUID único
    const idempotencyKey = usePersistedKey 
      ? getOrCreateIdempotencyKey('hold')
      : `hold-${crypto.randomUUID?.() ?? Date.now()}`;
    
    // Limpiar la clave persistente después de usar
    if (usePersistedKey) {
      setTimeout(() => localStorage.removeItem('idem-hold'), 100);
    }
    
    // TEMPORAL: Header comentado hasta que backend configure CORS
    return apiClient.post(`${API_BASE}/holds`, holdData /*, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    }*/);
  },

  // Consultar HOLD específico
  // RUTA: GET /api/holds/:holdId
  getHold: (holdId) => {
    return apiClient.get(`${API_BASE}/holds/${holdId}`);
  },

  // Cancelar HOLD
  // RUTA: DELETE /api/holds/:holdId
  cancelHold: (holdId) => {
    return apiClient.delete(`${API_BASE}/holds/${holdId}`);
  }
};

// ============================================
// ORDERS API - Sistema de órdenes de compra
// ============================================
export const ordersApi = {
  // Crear ORDER desde un HOLD
  // RUTA: POST /api/orders
  createOrder: (orderData, usePersistedKey = false) => {
    // orderData: { holdId }
    // IMPORTANTE: Requiere header 'Idempotency-Key' con UUID único
    const idempotencyKey = usePersistedKey 
      ? getOrCreateIdempotencyKey('order')
      : `order-${crypto.randomUUID?.() ?? Date.now()}`;
    
    // Limpiar la clave persistente después de usar
    if (usePersistedKey) {
      setTimeout(() => localStorage.removeItem('idem-order'), 100);
    }
    
    return apiClient.post(`${API_BASE}/orders`, orderData, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });
  },

  // Consultar ORDER específica
  // RUTA: GET /api/orders/:orderId
  getOrder: (orderId) => {
    return apiClient.get(`${API_BASE}/orders/${orderId}`);
  },

  // Obtener tickets de una orden
  // RUTA: GET /api/tickets/order/:orderId
  getOrderTickets: (orderId) => {
    return apiClient.get(`${API_BASE}/tickets/order/${orderId}`);
  }
};

// ============================================
// MANAGE ORDERS API - Gestión de Órdenes
// ============================================
export const manageOrdersApi = {
  // ===== ENDPOINTS PÚBLICOS =====
  
  // Obtener una orden específica
  // RUTA: GET /api/orders/:orderId
  getOrder: (orderId) => {
    return apiClient.get(`${API_BASE}/orders/${orderId}`);
  },

  // Listar órdenes con paginación y filtros
  // RUTA: GET /api/orders
  // Query params: page, limit, status, customerEmail
  listOrders: (params = {}) => {
    return apiClient.get(`${API_BASE}/orders`, { params });
  },

  // ===== ENDPOINTS ADMINISTRATIVOS =====
  
  // Obtener todas las órdenes pendientes (Admin)
  // RUTA: GET /api/admin/orders/pending
  getPendingOrders: () => {
    return apiClient.get(`${API_BASE}/admin/orders/pending`);
  },

  // Obtener estado de una orden específica (Admin)
  // RUTA: GET /api/admin/orders/:orderId/status
  getOrderStatus: (orderId) => {
    return apiClient.get(`${API_BASE}/admin/orders/${orderId}/status`);
  },

  // Cancelar una orden pendiente (Admin)
  // RUTA: POST /api/admin/orders/:orderId/cancel
  cancelOrder: (orderId) => {
    return apiClient.post(`${API_BASE}/admin/orders/${orderId}/cancel`);
  },

  // Verificar conflictos de asientos (Admin - Debugging)
  // RUTA: GET /api/orders/check-seat-conflicts
  checkSeatConflicts: () => {
    return apiClient.get(`${API_BASE}/orders/check-seat-conflicts`);
  },

  // Limpiar órdenes expiradas (Admin)
  // RUTA: POST /api/orders/cleanup-expired
  // Limpia órdenes en PENDING con más de 30 minutos de antigüedad
  cleanupExpired: () => {
    return apiClient.post(`${API_BASE}/orders/cleanup-expired`);
  }
};

// Tickets API - Sistema de reservas de tickets (Backend V2 - OFICIAL)
// ✅ Endpoints implementados y funcionales según TESTING_GUIDE_STEP_BY_STEP.md
export const ticketsApi = {
  // Crear reservas de tickets (BACKEND V2 - ✅ DISPONIBLE)
  // RUTA CORREGIDA: POST /api/tickets/reserve
  createReservation: (reservationData) => {
    // reservationData: { eventId, tickets: [{ typeId, quantity }], customerInfo }
    return apiClient.post(`${API_BASE}/tickets/reserve`, reservationData);
  },

  // Obtener tipos de tickets de un evento
  // RUTA: GET /api/events/:eventId/ticket-types
  getEventTicketTypes: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/ticket-types`);
  },

  // Obtener reserva específica
  // RUTA: GET /api/tickets/reservations/:id
  getReservation: (reservationId) => {
    return apiClient.get(`${API_BASE}/tickets/reservations/${reservationId}`);
  },

  // Obtener reservas del usuario
  // RUTA: GET /api/tickets/reservations/me
  getMyReservations: () => {
    return apiClient.get(`${API_BASE}/tickets/reservations/me`);
  },

  // Cancelar reserva
  // RUTA: DELETE /api/tickets/reservations/:id
  cancelReservation: (reservationId) => {
    return apiClient.delete(`${API_BASE}/tickets/reservations/${reservationId}`);
  },

  // Consultar disponibilidad de tickets para un evento
  // RUTA: GET /api/tickets/available/:eventId
  // Requiere autenticación - Retorna cuántos boletos puede comprar el usuario
  getAvailability: (eventId) => {
    return apiClient.get(`${API_BASE}/tickets/available/${eventId}`);
  },

  // Obtener QR dinámico (TOTP)
  // RUTA: GET /api/tickets/:ticketId/dynamic-qr
  getDynamicQR: (ticketId) => {
    return apiClient.get(`${API_BASE}/tickets/${ticketId}/dynamic-qr`);
  }
};

// Payments API - Integración completa con Mercado Pago
export const paymentsApi = {
  // ⭐ NUEVO SISTEMA: Crear preferencia de pago con reservas
  createPreferenceReservation: (paymentData) => {
    // paymentData: { reservationIds, payer, backUrls }
    return apiClient.post(`${API_BASE}/payments/create-preference-reservation`, paymentData);
  },

  // Sistema anterior: Crear preferencia de pago con orden
  createPaymentPreference: (paymentData, usePersistedKey = false) => {
    // paymentData: { orderId, payer, backUrls }
    // IMPORTANTE: Requiere header 'Authorization: Bearer <TOKEN>' (agregado automáticamente por apiClient)
    // Sugerido: enviar 'Idempotency-Key' para reintentos seguros
    const idempotencyKey = usePersistedKey
      ? getOrCreateIdempotencyKey('payment')
      : `payment-${crypto.randomUUID?.() ?? Date.now()}`;

    // Si usamos clave persistente, limpiarla poco después para no reusar accidentalmente
    if (usePersistedKey) {
      setTimeout(() => localStorage.removeItem('idem-payment'), 100);
    }

    return apiClient.post(`${API_BASE}/payments/create-preference`, paymentData, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });
  },

  // Obtener estado de pago por orderId
  getPaymentStatus: (orderId) => {
    return apiClient.get(`${API_BASE}/payments/status/${orderId}`);
  },

  // Reembolso (admin) - por orderId
  refundPayment: (orderId, refundData) => {
    // refundData: { amount?, reason? }
    return apiClient.post(`${API_BASE}/payments/refund/${orderId}`, refundData);
  },

  // 🧪 TESTING: Simular pago completo (marca orden como PAID) - DEV ONLY
  // ENDPOINT REAL DEL BACKEND: POST /api/test-payments/simulate-payment
  simulatePayment: (paymentData) => {
    // paymentData: { orderId, customerEmail, customerName }
    // ENDPOINT: POST /api/test-payments/simulate-payment
    return apiClient.post(`${API_BASE}/test-payments/simulate-payment`, paymentData);
  },

  // 🧪 LEGACY: Endpoints antiguos (mantener por compatibilidad)
  simulateWebhook: (webhookData) => {
    return apiClient.post(`${API_BASE}/payments/simulate-webhook`, webhookData);
  },
  
  completeOrderDirectly: (orderId) => {
    return apiClient.post(`${API_BASE}/payments/complete-order/${orderId}`);
  }
};

// Ticket Validation API - Sistema de validación en puerta
export const ticketValidationApi = {
  // Validar ticket con QR code
  // RUTA: POST /api/tickets/validate
  validateTicket: (validationData) => {
    // validationData: { qrCode, entryPoint?, notes? }
    return apiClient.post(`${API_BASE}/tickets/validate`, validationData);
  },

  // Obtener estadísticas de validación de un evento
  // RUTA: GET /api/events/:eventId/validation-stats
  getValidationStats: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/validation-stats`);
  }
};

// Ticket Transfer API - Sistema de transferencias entre usuarios
export const ticketTransferApi = {
  // Iniciar transferencia de ticket
  // RUTA: POST /api/tickets/transfer
  initiateTransfer: (transferData) => {
    // transferData: { ticketId, recipientEmail, recipientName, notes? }
    return apiClient.post(`${API_BASE}/tickets/transfer`, transferData);
  },

  // Aceptar transferencia con código
  // RUTA: POST /api/tickets/transfer/accept/:code
  acceptTransfer: (transferCode) => {
    return apiClient.post(`${API_BASE}/tickets/transfer/accept/${transferCode}`);
  },

  // Obtener mis transferencias
  // RUTA: GET /api/tickets/transfers
  getMyTransfers: (type = 'all') => {
    // type: 'all', 'sent', 'received'
    return apiClient.get(`${API_BASE}/tickets/transfers`, { type });
  }
};

// Reports API - Sistema de reportes para admin
export const reportsApi = {
  // 1. Reporte Detallado de Evento
  // RUTA: GET /api/reports/event/:eventId
  // Permisos: Admin, Organizer (del evento)
  // Métricas completas: ventas por tipo, ocupación, ingresos, timeline, top compradores
  getEventReport: (eventId) => {
    return apiClient.get(`${API_BASE}/reports/event/${eventId}`);
  },

  // 2. Dashboard General de Eventos
  // RUTA: GET /api/reports/events
  // Permisos: Admin
  // Query params: page, limit, sortBy (revenue|tickets_sold|occupancy|created_at), dateFrom, dateTo
  getEventsReport: (params = {}) => {
    return apiClient.get(`${API_BASE}/reports/events`, { params });
  },

  // 3. Reporte de Ventas por Período
  // RUTA: GET /api/reports/sales
  // Permisos: Admin, Organizer
  // Query params: period (daily|weekly|monthly|hourly), dateFrom, dateTo, eventId
  getSalesReport: (params = {}) => {
    return apiClient.get(`${API_BASE}/reports/sales`, { params });
  },

  // 4. Reporte Financiero (Admin only)
  // RUTA: GET /api/reports/financial
  // Permisos: Admin
  // Query params: dateFrom, dateTo, eventId
  // Desglose: ingresos brutos, descuentos, fees, net sales
  getFinancialReport: (params = {}) => {
    return apiClient.get(`${API_BASE}/reports/financial`, { params });
  }
};

// WhatsApp API
export const whatsappApi = {
  // Enviar tickets por WhatsApp (requiere backend con WhatsApp Cloud API)
  // Si el backend soporta generar el PDF, basta con orderId y phone.
  // Opcionalmente se puede enviar pdfBase64 si se genera en el cliente.
  sendTicket: ({ orderId, phone = '+17869785842', message = '¡Aquí están tus entradas!!', pdfBase64 } = {}) => {
    return apiClient.post(`${API_BASE}/whatsapp/send-ticket`, { orderId, phone, message, pdfBase64 });
  }
};

// Admin API
export const adminApi = {
  // Configuración de tarifa fija
  getFixedFee: () => {
    return apiClient.get(`${API_BASE}/admin/settings/fixed-fee`);
  },

  setFixedFee: (fixedFeeCents) => {
    return apiClient.put(`${API_BASE}/admin/settings/fixed-fee`, { fixedFeeCents });
  },

  // Configuración MercadoPago
  getMercadoPagoConfig: () => {
    return apiClient.get(`${API_BASE}/admin/mercadopago/settings`);
  },

  setMercadoPagoConfig: (config) => {
    return apiClient.post(`${API_BASE}/admin/mercadopago/settings`, config);
  },

  toggleMercadoPago: (isActive) => {
    return apiClient.patch(`${API_BASE}/admin/mercadopago/settings/toggle`, { isActive });
  },

  testMercadoPagoConnection: () => {
    return apiClient.post(`${API_BASE}/admin/mercadopago/settings/test`);
  }
};

// Producers API
export const producersApi = {
  // Listar productores
  getProducers: () => {
    return apiClient.get(`${API_BASE}/producers`);
  },

  // Crear productor
  createProducer: (producerData) => {
    return apiClient.post(`${API_BASE}/producers`, producerData);
  },

  // Obtener productor por ID
  getProducer: (producerId) => {
    return apiClient.get(`${API_BASE}/producers/${producerId}`);
  },

  // Actualizar productor
  updateProducer: (producerId, producerData) => {
    return apiClient.put(`${API_BASE}/producers/${producerId}`, producerData);
  },

  // Eliminar productor
  deleteProducer: (producerId) => {
    return apiClient.delete(`${API_BASE}/producers/${producerId}`);
  }
};

// Venues API
export const venuesApi = {
  // Lista paginada y filtrada de venues
  getVenues: (params = {}) => {
    const { page = 1, limit = 20, search, city, sortBy = 'name', sortOrder = 'ASC' } = params;
    // Construir params solo con valores definidos (no enviar search='' vacío)
    const queryParams = { page, limit, sortBy, sortOrder };
    if (search) queryParams.search = search;
    if (city) queryParams.city = city;
    
    return apiClient.get(`${API_BASE}/venues`, queryParams);
  },

  // Búsqueda rápida de venues
  searchVenues: (query, limit = 10) => {
    return apiClient.get(`${API_BASE}/venues/search`, { q: query, limit });
  },

  // Obtener venue específico
  getVenue: (venueId) => {
    return apiClient.get(`${API_BASE}/venues/${venueId}`);
  },

  // Crear venue - manejo inteligente de FormData vs JSON
  createVenue: (venueData) => {
    if (venueData instanceof FormData) {
      // Convertir FormData a JSON para venues (normalmente no tienen imágenes)
      const jsonData = {};
      for (let [key, value] of venueData.entries()) {
        jsonData[key] = value;
      }
      return apiClient.post(`${API_BASE}/venues`, jsonData);
    }
    
    return apiClient.post(`${API_BASE}/venues`, venueData);
  },

  // Actualizar venue
  updateVenue: (venueId, venueData) => {
    if (venueData instanceof FormData) {
      const jsonData = {};
      for (let [key, value] of venueData.entries()) {
        jsonData[key] = value;
      }
      return apiClient.put(`${API_BASE}/venues/${venueId}`, jsonData);
    }
    return apiClient.put(`${API_BASE}/venues/${venueId}`, venueData);
  },

  // Eliminar venue
  deleteVenue: (venueId) => {
    return apiClient.delete(`${API_BASE}/venues/${venueId}`);
  }
};

// Banners API
// Banners API
export const homepageBannersApi = {
  getAllBanners: () => {
    return apiClient.get(`${API_BASE}/homepage/banners/all`);
  },
  getActiveBanners: () => {
    return apiClient.get(`${API_BASE}/homepage/banners`);
  },
  createBanner: (data) => {
    // data puede ser FormData
    if (data instanceof FormData) {
      return apiClient.post(`${API_BASE}/homepage/banners`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.post(`${API_BASE}/homepage/banners`, data);
  },
  updateBanner: (id, data) => {
    if (data instanceof FormData) {
      return apiClient.put(`${API_BASE}/homepage/banners/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.put(`${API_BASE}/homepage/banners/${id}`, data);
  },
  deleteBanner: (id) => {
    return apiClient.delete(`${API_BASE}/homepage/banners/${id}`);
  },
  toggleBanner: (id) => {
    return apiClient.patch(`${API_BASE}/homepage/banners/${id}/toggle`);
  },
  reorderBanners: (items) => {
    return apiClient.post(`${API_BASE}/homepage/banners/reorder`, { items });
  }
};

// ============================================
// EVENT IMAGES API - Sistema de Imágenes de Eventos
// ============================================
// Soporte para 4 tipos de imágenes según especificaciones UX/UI:
// - cover_square (300x300px) - Para listados en grilla
// - cover_horizontal (626x300px) - Para tarjetas horizontales
// - banner_main (1620x720px) - Banner principal
// - banner_alt (1620x700px) - Banner alternativo
export const eventImagesApi = {
  // Obtener información sobre tipos de imágenes soportados
  getImageTypes: () => {
    return apiClient.get(`${API_BASE}/events/images/types`);
  },

  // Obtener todas las imágenes de un evento
  getEventImages: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/images`);
  },

  // Subir múltiples imágenes a la vez
  uploadEventImages: (eventId, imagesFormData) => {
    // imagesFormData debe ser FormData con los campos:
    // - cover_square (File)
    // - cover_horizontal (File)
    // - banner_main (File)
    // - banner_alt (File)
    return apiClient.post(`${API_BASE}/events/${eventId}/images`, imagesFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Subir una imagen específica
  uploadSingleImage: (eventId, imageType, imageFormData) => {
    // imageType: 'cover_square' | 'cover_horizontal' | 'banner_main' | 'banner_alt'
    // imageFormData debe ser FormData con el campo del tipo específico
    return apiClient.post(`${API_BASE}/events/${eventId}/images/${imageType}`, imageFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Eliminar una imagen específica
  deleteEventImage: (eventId, imageType) => {
    return apiClient.delete(`${API_BASE}/events/${eventId}/images/${imageType}`);
  },

  // Eliminar todas las imágenes de un evento (solo ADMIN)
  deleteAllEventImages: (eventId) => {
    return apiClient.delete(`${API_BASE}/events/${eventId}/images`);
  }
};

// ============================================
// EVENT STYLES API - Personalización Visual de Eventos
// ============================================
// Sistema de personalización con colores, fuentes y descripción
// Incluye 10 paletas predefinidas por categoría
export const eventStylesApi = {
  // Obtener paletas predefinidas (público)
  getPalettes: (category = null) => {
    const url = category 
      ? `${API_BASE}/events/styles/palettes?category=${category}`
      : `${API_BASE}/events/styles/palettes`;
    return apiClient.get(url);
  },

  // Ver estilos de un evento (público)
  getEventStyles: (eventId) => {
    return apiClient.get(`${API_BASE}/events/${eventId}/styles`);
  },

  // Actualizar estilos de un evento (ORGANIZER/ADMIN)
  updateEventStyles: (eventId, styles) => {
    // styles: { description?, primary_color?, secondary_color?, text_color?, font_family? }
    return apiClient.put(`${API_BASE}/events/${eventId}/styles`, styles);
  },

  // Aplicar paleta predefinida (ORGANIZER/ADMIN)
  applyPalette: (eventId, paletteId) => {
    return apiClient.post(`${API_BASE}/events/${eventId}/styles/apply-palette`, { paletteId });
  }
};

// Health API
export const healthApi = {
  // Health check
  getHealth: () => {
    return apiClient.get('/health');
  },
  
  // Alias para health check
  check: () => {
    return apiClient.get('/health');
  }
};

// Utility functions for common operations
export const apiUtils = {
  // Manejo de errores común
  handleApiError: (error) => {
    if (error.response) {
      const { status, data } = error.response;
      return {
        status,
        message: data.message || data.error || 'Error en la API',
        details: data
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'Error de conexión con el servidor',
        details: error.message
      };
    } else {
      return {
        status: -1,
        message: 'Error inesperado',
        details: error.message
      };
    }
  },

  // Formatear parámetros de paginación
  formatPaginationParams: (page = 1, limit = 10, filters = {}) => {
    return {
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters
    };
  }
};

// Payment Config API - Configuración de MercadoPago (ADMIN)
export const paymentConfigApi = {
  // Obtener configuración actual de MercadoPago
  // RUTA: GET /api/admin/mercadopago/settings
  getMercadoPagoConfig: () => {
    return apiClient.get(`${API_BASE}/admin/mercadopago/settings`);
  },

  // Configurar/Actualizar credenciales de MercadoPago
  // RUTA: POST /api/admin/mercadopago/settings
  saveMercadoPagoConfig: (configData) => {
    // configData: { accessToken, publicKey?, isSandbox?, isActive?, config? }
    return apiClient.post(`${API_BASE}/admin/mercadopago/settings`, configData);
  },

  // Activar/Desactivar MercadoPago
  // RUTA: PATCH /api/admin/mercadopago/settings/toggle
  toggleMercadoPago: (isActive) => {
    return apiClient.patch(`${API_BASE}/admin/mercadopago/settings/toggle`, { isActive });
  },

  // Probar conexión con MercadoPago
  // RUTA: POST /api/admin/mercadopago/settings/test
  testMercadoPagoConnection: () => {
    return apiClient.post(`${API_BASE}/admin/mercadopago/settings/test`);
  },

  // Eliminar credenciales de MercadoPago
  // RUTA: DELETE /api/admin/mercadopago/settings
  deleteMercadoPagoConfig: () => {
    return apiClient.delete(`${API_BASE}/admin/mercadopago/settings`);
  }
};

// Test Payments API - Testing de pagos (SOLO DESARROLLO)
export const testPaymentsApi = {
  // Simular pago exitoso (genera tickets automáticamente)
  // RUTA: POST /api/test-payments/simulate-payment
  simulatePayment: (paymentData) => {
    // paymentData: { orderId, customerEmail?, customerName? }
    return apiClient.post(`${API_BASE}/test-payments/simulate-payment`, paymentData);
  },

  // Ver mis tickets (autenticado o por email)
  // RUTA: GET /api/test-payments/my-tickets?email=xxx
  getMyTickets: (email = null) => {
    const params = email ? { email } : {};
    return apiClient.get(`${API_BASE}/test-payments/my-tickets`, params);
  },

  // Ver detalle de un ticket específico
  // RUTA: GET /api/test-payments/ticket/:ticketNumber
  getTicketDetail: (ticketNumber) => {
    return apiClient.get(`${API_BASE}/test-payments/ticket/${ticketNumber}`);
  }
};

// Export default con todas las APIs
export default {
  auth: authApi,
  users: usersApi,
  adminUsers: adminUsersApi,
  adminPayments: adminPaymentsApi,
  events: eventsApi,
  eventImages: eventImagesApi,
  eventStyles: eventStylesApi,
  shows: showsApi,
  queue: queueApi,
  holds: holdsApi,
  orders: ordersApi,
  manageOrders: manageOrdersApi,
  reservations: reservationsApi,
  tickets: ticketsApi,
  payments: paymentsApi,
  ticketValidation: ticketValidationApi,
  ticketTransfer: ticketTransferApi,
  reports: reportsApi,
  whatsapp: whatsappApi,
  admin: adminApi,
  producers: producersApi,
  venues: venuesApi,
  health: healthApi,
  paymentConfig: paymentConfigApi,
  testPayments: testPaymentsApi,
  homepageBanners: homepageBannersApi,
  utils: apiUtils
};
