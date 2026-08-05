/**
 * Saca el array de una respuesta de la API, sin importar cómo venga envuelto.
 *
 * Existe porque los endpoints de este backend no son consistentes: unos
 * devuelven `{ gates: [...] }`, otros `{ success, data: { users: [...] } }`, y
 * `GET /shows` devuelve un array pelado. Verificado uno por uno.
 *
 * Esta función ya estaba copiada a mano en AdminDashboard.jsx y en
 * AdminUsersPanel.jsx. Acá se saca a un módulo para no hacer una tercera copia.
 * Las dos existentes se dejan como están: no hace falta tocarlas para esta
 * función, y cambiarlas arriesga pantallas que hoy andan.
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
