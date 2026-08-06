import { describe, it, expect } from 'vitest';
import { sectionErrorCode, sectionErrorLine } from '../sectionErrors';

// Respuesta real del API (errorHandler.js): el código va en `error`, nunca en `code`.
const apiError = (status, code, message) => ({
  message: `Request failed with status code ${status}`,
  response: { status, data: { error: code, message } },
});

describe('sectionErrors', () => {
  it('lee el código desde data.error, que es donde lo manda el API', () => {
    expect(sectionErrorCode(apiError(409, 'VenueCapacityExceeded', 'x'))).toBe('VenueCapacityExceeded');
  });

  it('no inventa un código cuando la respuesta no lo trae', () => {
    expect(sectionErrorCode(new Error('boom'))).toBeUndefined();
    expect(sectionErrorCode(undefined)).toBeUndefined();
  });

  it('muestra el detalle del server en VenueCapacityExceeded, no el código pelado', () => {
    const err = apiError(
      409,
      'VenueCapacityExceeded',
      'No se puede crear la sección. Asientos actuales: 20,000, Intentas agregar: 100, Total: 20,100. Capacidad máxima del venue: 20,000. Excede por: 100 asientos.'
    );

    const line = sectionErrorLine('Campo', err);

    expect(line).toContain('Excede por: 100 asientos');
    expect(line).toContain('Capacidad máxima del venue: 20,000');
    // La regresión que se arregló: se mostraba el código en vez del texto.
    expect(line).not.toBe('"Campo": VenueCapacityExceeded');
  });

  it('reescribe DuplicateSectionName para no repetir el nombre', () => {
    const err = apiError(
      409,
      'DuplicateSectionName',
      'Ya existe una sección llamada "Campo General" en este show. Por favor usa un nombre diferente.'
    );

    expect(sectionErrorLine('Campo General', err)).toBe(
      '"Campo General": ya existe una sección con ese nombre en este show'
    );
  });

  it('cae al message del error cuando no hay respuesta HTTP (red caída)', () => {
    expect(sectionErrorLine('Campo', new Error('Network Error'))).toBe('"Campo": Network Error');
  });

  it('nunca devuelve undefined en la línea', () => {
    expect(sectionErrorLine('Campo', {})).toBe('"Campo": Error desconocido');
  });
});
