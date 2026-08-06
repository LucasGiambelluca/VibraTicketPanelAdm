/**
 * Saca el array de una respuesta de la API, sin importar cómo venga envuelto.
 *
 * Existe porque los endpoints de este backend no son consistentes: unos
 * devuelven `{ gates: [...] }`, otros `{ success, data: { users: [...] } }`, y
 * `GET /shows` devuelve un array pelado. Verificado uno por uno.
 *
 * Esta función está copiada a mano en NUEVE archivos del panel: AdminDashboard,
 * AdminUsersPanel, AdminBanners, DiscountCodes, FinancialReports, ManageOrders,
 * PaymentMonitor, hooks/useEvents y hooks/useVenues. Acá se saca a un módulo
 * para que el código nuevo no haga la décima. Las nueve se dejan como están: no
 * hace falta tocarlas para esta función, y cambiarlas arriesga nueve pantallas
 * que hoy andan y que esta tarea no prueba.
 */
export function extractArray(response, key) {
  const payload = response?.data || response;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload[key])) return payload[key];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data[key])) return payload.data[key];
    if (Array.isArray(payload.data.rows)) return payload.data.rows;
  }
  return [];
}
