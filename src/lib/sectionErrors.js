// Formateo de los errores que devuelve POST /api/shows/:id/sections.
//
// El errorHandler del API (middlewares/errorHandler.js) responde:
//   { error: <código>, message: <texto para el humano> }
//
// No manda ningún campo `code`. El panel lo leía de `data.code` (siempre
// undefined), así que las ramas por código eran código muerto y terminaba
// mostrando `data.error` — el código pelado, "VenueCapacityExceeded" — en vez
// del texto del server, que trae los números concretos (cuántos asientos hay,
// cuántos se intentan agregar y por cuánto se pasa).

/** Código de error del API, o undefined si la respuesta no lo trae. */
export function sectionErrorCode(err) {
  return err?.response?.data?.error;
}

/**
 * Línea a mostrar para una sección que falló.
 * `DuplicateSectionName` se reescribe porque el texto del server repite el
 * nombre, que acá ya va como prefijo. El resto (incluido VenueCapacityExceeded)
 * se muestra tal cual: el detalle del server es más útil que cualquier resumen.
 */
export function sectionErrorLine(sectionName, err) {
  const data = err?.response?.data || {};
  const message = data.message || err?.message || 'Error desconocido';

  if (data.error === 'DuplicateSectionName') {
    return `"${sectionName}": ya existe una sección con ese nombre en este show`;
  }
  return `"${sectionName}": ${message}`;
}
