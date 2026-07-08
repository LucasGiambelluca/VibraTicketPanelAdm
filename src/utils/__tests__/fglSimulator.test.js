import { describe, it, expect } from 'vitest';
import { parseFgl } from '../fglSimulator';

describe('fglSimulator', () => {
  it('posiciona texto con RC y fuente', () => {
    const { elements } = parseFgl('<RC10,20><F3>HOLA');
    expect(elements).toEqual([expect.objectContaining({ type: 'text', row: 10, col: 20, font: 'F3', text: 'HOLA' })]);
  });

  it('detecta QR con payload y version', () => {
    const { elements } = parseFgl('<RC30,45><QRV11><QR3>{ABC}');
    expect(elements[0]).toMatchObject({ type: 'qr', row: 30, col: 45, pointSize: 3, modules: 61, payload: 'ABC' });
  });

  it('linea vertical con grosor LT', () => {
    const { elements } = parseFgl('<RC10,258><LT2><VX364>');
    expect(elements[0]).toMatchObject({ type: 'line', vertical: true, length: 364, thickness: 2 });
  });

  it('graficos g# hex', () => {
    const { elements } = parseFgl('<RC5,10><g8>FFFF0000');
    expect(elements[0]).toMatchObject({ type: 'graphic', row: 5, col: 10, hex: 'FFFF0000' });
  });

  it('avisa comandos desconocidos', () => {
    expect(parseFgl('<XX9>').warnings.length).toBe(1);
  });

  it('parsea un ticket real de backend de punta a punta', () => {
    const fgl =
      '<NR>\n<RC30,45><QR3>{PAYLOAD}\n<RC190,20><F1><HW1,1>TKT-1\n<RC10,258><VX364><RC10,258>\n<RC25,280><F12><HW1,1>RS FEST 2\n<p>\n';
    const { elements, warnings } = parseFgl(fgl);

    // 4 elementos: QR, texto TKT-1, línea vertical, texto RS FEST 2
    // (NR, los saltos de línea y p son no-ops/separadores y no generan elementos)
    expect(elements).toHaveLength(4);
    expect(warnings).toEqual([]);

    expect(elements[0]).toMatchObject({ type: 'qr', row: 30, col: 45, pointSize: 3, payload: 'PAYLOAD' });
    expect(elements[1]).toMatchObject({ type: 'text', row: 190, col: 20, font: 'F1', text: 'TKT-1' });
    expect(elements[2]).toMatchObject({ type: 'line', vertical: true, row: 10, col: 258, length: 364, thickness: 1 });
    expect(elements[3]).toMatchObject({ type: 'text', row: 25, col: 280, font: 'F12', text: 'RS FEST 2' });
  });

  it('avanza la columna del texto cuando no hay RC explicito entre corridas', () => {
    // F3 repetido para cortar la corrida de texto en dos elementos, sin RC intermedio.
    const { elements } = parseFgl('<RC0,0><F3>AB<F3>CD');
    expect(elements).toHaveLength(2);
    expect(elements[0]).toMatchObject({ row: 0, col: 0, text: 'AB' });
    // avance = text.length(2) * boxWidth F3(20) * w(1) = 40
    expect(elements[1]).toMatchObject({ row: 0, col: 40, text: 'CD' });
  });

  it('LT se resetea a 1 despues de aplicarse a una linea', () => {
    const { elements } = parseFgl('<LT3><VX10><VX10>');
    expect(elements).toHaveLength(2);
    expect(elements[0]).toMatchObject({ thickness: 3 });
    expect(elements[1]).toMatchObject({ thickness: 1 });
  });
});
