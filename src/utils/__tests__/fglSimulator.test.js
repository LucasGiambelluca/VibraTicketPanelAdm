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

  // Golden real de ApiTickets (test/golden/talon2.fgl, commit 7c3a2ce): copiado
  // byte a byte para que el simulador se testee contra el FGL que efectivamente
  // emite buildTicketFGL con talon2.visible=true, no una aproximación.
  const TALON2_GOLDEN =
    '<NR>\n' +
    '<RC30,45><QR3>{eyJ0aWNrZXROdW1iZXIiOiJUS1QtMTAyNC03NyIsInNpZyI6ImFiYzEyMyJ9}\n' +
    '<RC190,20><F1><HW1,1>TKT-1024-77\n' +
    '<RC215,20><F1>08/07/2026 12:09\n' +
    '<RC10,258><VX364><RC10,258>\n' +
    '<RC25,280><F12><HW1,1>RS FEST 2\n' +
    '<RC130,280><F2>Parque Roca - Av. Coronel Roca 3490, Buenos Aires\n' +
    '<RC160,280><F8>SABADO 21 MARZO 16:00 HS\n' +
    '<RC225,280><F8>SECTOR CAMPO\n' +
    '<RC280,280><F3>$ 25.000,00\n' +
    '<RC280,620><F1>Apto +18 anos\n' +
    '<RC298,620><F1>Entrada valida por unica vez\n' +
    '<RC345,280><F1>TKT-1024-77 - Entrada valida por unica vez. Conserve este ticket.\n' +
    '<RU>\n' +
    '<RC350,1040><F2>RS FEST 2\n' +
    '<RC300,1040><F1>SABADO 21 MARZO 16:...\n' +
    '<RC250,1040><F1>SECTOR CAMPO\n' +
    '<RC200,1040><F1>$ 25.000,00\n' +
    '<RC150,1040><F1>TKT-1024-77\n' +
    '<RC100,1040><F1>08/07/2026 12:09\n' +
    '<NR>\n' +
    '<p>\n';

  it('parsea el golden talon2.fgl (RU) sin avisos de comando desconocido', () => {
    const { warnings } = parseFgl(TALON2_GOLDEN);
    expect(warnings).toEqual([]);
  });

  it('marca rotation:180 solo en los textos del talon derecho (entre <RU> y <NR>)', () => {
    const { elements } = parseFgl(TALON2_GOLDEN);
    const texts = elements.filter((el) => el.type === 'text');

    // Cuerpo principal (antes de <RU>): sin rotation.
    const evento = texts.find((el) => el.row === 25 && el.col === 280);
    expect(evento).toMatchObject({ text: 'RS FEST 2', font: 'F12' });
    expect(evento.rotation).toBeUndefined();

    // Talón derecho (después de <RU>): las 6 líneas quedan marcadas rotadas,
    // ancladas todas en col 1040 (el borde derecho, cheatsheet §4).
    const talon2 = [
      { row: 350, text: 'RS FEST 2', font: 'F2' },
      { row: 300, text: 'SABADO 21 MARZO 16:...', font: 'F1' },
      { row: 250, text: 'SECTOR CAMPO', font: 'F1' },
      { row: 200, text: '$ 25.000,00', font: 'F1' },
      { row: 150, text: 'TKT-1024-77', font: 'F1' },
      { row: 100, text: '08/07/2026 12:09', font: 'F1' },
    ];
    for (const expected of talon2) {
      const el = texts.find((t) => t.row === expected.row && t.col === 1040);
      expect(el).toMatchObject({ ...expected, rotation: 180 });
    }
  });

  it('<NR> despues de <RU> vuelve a rotation 0 (nada aguas abajo hereda la rotacion)', () => {
    const { elements } = parseFgl('<RU><RC10,100><F1>ROTADO<NR><RC10,10><F1>NORMAL');
    expect(elements[0]).toMatchObject({ text: 'ROTADO', rotation: 180 });
    expect(elements[1].rotation).toBeUndefined();
  });

  it('con <RU> el cursor retrocede (col decrece) entre corridas sin RC explicito', () => {
    const { elements } = parseFgl('<RU><RC0,100><F1>AB<F1>CD');
    expect(elements).toHaveLength(2);
    expect(elements[0]).toMatchObject({ row: 0, col: 100, text: 'AB', rotation: 180 });
    // retroceso = text.length(2) * boxWidth F1(7) * w(1) = 14
    expect(elements[1]).toMatchObject({ row: 0, col: 86, text: 'CD', rotation: 180 });
  });
});
