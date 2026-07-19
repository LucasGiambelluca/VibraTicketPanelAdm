import { describe, it, expect } from 'vitest';
import { screenToDots, applyMove, applyResize, hitsPerforation, CANVAS, MIN_BOX_W } from '../dragMath';

describe('screenToDots', () => {
  it('convierte píxeles de pantalla a dots dividiendo por la escala', () => {
    expect(screenToDots(50, 0.5)).toBe(100);
  });

  it('redondea a dot entero: la impresora no tiene medios dots', () => {
    expect(screenToDots(33, 0.5)).toBe(66);
    expect(screenToDots(10.4, 1)).toBe(10);
  });

  it('devuelve 0 si la escala es 0 en vez de Infinity', () => {
    expect(screenToDots(50, 0)).toBe(0);
  });
});

describe('applyMove', () => {
  const zona = { row: 100, col: 300 };

  it('suma el delta en dots', () => {
    expect(applyMove(zona, { dRow: 10, dCol: -20 })).toEqual({ row: 110, col: 280 });
  });

  it('bloquea el eje vertical cuando lockAxis es horizontal', () => {
    expect(applyMove(zona, { dRow: 10, dCol: -20 }, { lockAxis: 'x' })).toEqual({ row: 100, col: 280 });
  });

  it('bloquea el eje horizontal cuando lockAxis es vertical', () => {
    expect(applyMove(zona, { dRow: 10, dCol: -20 }, { lockAxis: 'y' })).toEqual({ row: 110, col: 300 });
  });

  it('recorta contra los bordes del lienzo', () => {
    expect(applyMove({ row: 5, col: 5 }, { dRow: -100, dCol: -100 })).toEqual({ row: 0, col: 0 });
    expect(applyMove({ row: 370, col: 1100 }, { dRow: 100, dCol: 100 }))
      .toEqual({ row: CANVAS.ROWS - 1, col: CANVAS.COLS - 1 });
  });
});

describe('applyResize', () => {
  it('el handle derecho mueve colEnd', () => {
    expect(applyResize({ col: 300, colEnd: 700 }, 'right', 50)).toEqual({ col: 300, colEnd: 750 });
  });

  it('el handle izquierdo mueve col', () => {
    expect(applyResize({ col: 300, colEnd: 700 }, 'left', 50)).toEqual({ col: 350, colEnd: 700 });
  });

  it('respeta el ancho mínimo que exige el motor', () => {
    expect(applyResize({ col: 300, colEnd: 700 }, 'left', 1000)).toEqual({ col: 700 - MIN_BOX_W, colEnd: 700 });
    expect(applyResize({ col: 300, colEnd: 700 }, 'right', -1000)).toEqual({ col: 300, colEnd: 300 + MIN_BOX_W });
  });

  it('no se sale del lienzo', () => {
    expect(applyResize({ col: 300, colEnd: 1100 }, 'right', 500).colEnd).toBe(CANVAS.COLS - 1);
    expect(applyResize({ col: 100, colEnd: 700 }, 'left', -500).col).toBe(0);
  });
});

describe('hitsPerforation', () => {
  it('detecta una caja que cruza la perforación', () => {
    expect(hitsPerforation({ left: 260, w: 40 }, [280])).toBe(true);
  });

  it('no marca una caja que termina justo antes', () => {
    expect(hitsPerforation({ left: 240, w: 40 }, [280])).toBe(false);
  });

  it('no marca una caja que arranca justo en la perforación', () => {
    expect(hitsPerforation({ left: 280, w: 40 }, [280])).toBe(false);
  });

  it('chequea varias perforaciones', () => {
    expect(hitsPerforation({ left: 820, w: 20 }, [280, 828])).toBe(true);
  });

  it('tolera una lista de perforaciones vacía', () => {
    expect(hitsPerforation({ left: 100, w: 40 }, [])).toBe(false);
  });
});
