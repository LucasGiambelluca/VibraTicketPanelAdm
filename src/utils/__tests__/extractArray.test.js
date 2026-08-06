import { describe, it, expect } from 'vitest';
import { extractArray } from '../extractArray';

// Las cuatro formas son las que realmente devuelve el backend, verificadas
// endpoint por endpoint. Si alguna cambia, este test es el que avisa.
describe('extractArray: formas reales del backend', () => {
  it('desenvuelve la respuesta de axios (todo vive en .data)', () => {
    const res = { data: { gates: [{ id: 1 }] } };
    expect(extractArray(res, 'gates')).toEqual([{ id: 1 }]);
  });

  it('{ gates: [] } de los endpoints nuevos de access', () => {
    expect(extractArray({ gates: [{ id: 7 }] }, 'gates')).toEqual([{ id: 7 }]);
  });

  it('{ event, ticketTypes: [] } de los tipos de entrada', () => {
    const res = { event: { id: 3 }, ticketTypes: [{ id: 9 }] };
    expect(extractArray(res, 'ticketTypes')).toEqual([{ id: 9 }]);
  });

  it('un array pelado, como GET /shows', () => {
    const shows = [{ id: 1, event_id: 3, starts_at: '2026-08-05T22:00:00Z' }];
    expect(extractArray({ data: shows }, 'shows')).toBe(shows);
  });

  it('{ success, data: { users } } de GET /admin/users', () => {
    const res = { data: { success: true, data: { users: [{ id: 2 }], pagination: {} } } };
    expect(extractArray(res, 'users')).toEqual([{ id: 2 }]);
  });
});

// OJO al armar los inputs de acá: la primera línea de extractArray desenvuelve
// `.data` como sobre de axios. Un input sin sobre entra a la función ya
// desenvuelto y sale por una rama distinta de la que dice el nombre del test.
// Por eso todos los casos de abajo van envueltos en `{ data: ... }`.
describe('extractArray: formas genéricas', () => {
  it('usa payload.data cuando es el array (así viene /admin/payments/logs)', () => {
    const res = { data: { success: true, data: [1, 2], pagination: {} } };
    expect(extractArray(res, 'gates')).toEqual([1, 2]);
  });

  it('usa payload.rows', () => {
    expect(extractArray({ rows: [1] }, 'gates')).toEqual([1]);
  });

  it('usa payload.data.rows', () => {
    const res = { data: { data: { rows: [1] } } };
    expect(extractArray(res, 'gates')).toEqual([1]);
  });

  it('prioriza la key sobre payload.data', () => {
    const res = { data: { gates: [1], data: [2, 3] } };
    expect(extractArray(res, 'gates')).toEqual([1]);
  });

  it('prioriza la key sobre payload.rows', () => {
    const res = { data: { gates: [1], rows: [2, 3] } };
    expect(extractArray(res, 'gates')).toEqual([1]);
  });

  // `.data` se desenvuelve primero porque es el sobre de axios, así que gana
  // sobre la key cuando el objeto de afuera tiene las dos. No pasa con ningún
  // endpoint real; queda anotado para que nadie lo lea al revés.
  it('desenvuelve .data antes de mirar la key', () => {
    expect(extractArray({ gates: [1], data: [2, 3] }, 'gates')).toEqual([2, 3]);
  });
});

describe('extractArray: nunca devuelve algo que no sea array', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['objeto vacío', {}],
    ['respuesta sin data', { data: null }],
    ['la key no es array', { gates: 'nope' }],
    ['data es objeto sin key ni rows', { data: { total: 0 } }],
  ])('%s → []', (_name, input) => {
    expect(extractArray(input, 'gates')).toEqual([]);
  });

  it('no explota si no se pasa key', () => {
    expect(extractArray({ gates: [1] })).toEqual([]);
  });
});
