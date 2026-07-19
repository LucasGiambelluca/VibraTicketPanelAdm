import { describe, it, expect } from 'vitest';
import { fitTextStyle } from '../textFit';

// Medidor falso: simula una fuente cuyo glifo ocupa 0.6 del em de alto y
// 0.5 del em de ancho por carácter. jsdom no implementa measureText de verdad
// (devuelve ceros), así que el medidor se inyecta y los tests quedan
// deterministas en vez de medir nada.
const fakeMeasurer = {
  heightRatio: 0.6,
  measureWidth: (text, fontSizePx) => text.length * fontSizePx * 0.5,
};

describe('fitTextStyle', () => {
  it('elige un fontSize tal que el alto del glifo sea el alto pedido en dots', () => {
    const s = fitTextStyle({ text: 'HOLA', w: 200, h: 60 }, fakeMeasurer);
    // 60 dots de glifo / 0.6 de ratio = 100px de fontSize
    expect(s.fontSize).toBeCloseTo(100, 5);
  });

  it('escala horizontalmente para que el ancho sea exactamente el pedido', () => {
    const s = fitTextStyle({ text: 'HOLA', w: 200, h: 60 }, fakeMeasurer);
    // medido = 4 chars * 100px * 0.5 = 200px; pedido 200 => escala 1
    expect(s.scaleX).toBeCloseTo(1, 5);
  });

  it('comprime cuando el texto medido es más ancho que la caja', () => {
    const s = fitTextStyle({ text: 'HOLA', w: 100, h: 60 }, fakeMeasurer);
    expect(s.scaleX).toBeCloseTo(0.5, 5);
  });

  it('no divide por cero con texto vacío', () => {
    const s = fitTextStyle({ text: '', w: 100, h: 60 }, fakeMeasurer);
    expect(Number.isFinite(s.scaleX)).toBe(true);
    expect(s.scaleX).toBe(1);
  });

  it('no revienta si el medidor devuelve un ratio absurdo', () => {
    const roto = { heightRatio: 0, measureWidth: () => 0 };
    const s = fitTextStyle({ text: 'HOLA', w: 100, h: 60 }, roto);
    expect(Number.isFinite(s.fontSize)).toBe(true);
    expect(s.fontSize).toBeGreaterThan(0);
  });

  it('no revienta si el medidor devuelve ancho cero para texto no vacío', () => {
    const roto = { heightRatio: 0.6, measureWidth: () => 0 };
    const s = fitTextStyle({ text: 'HOLA', w: 100, h: 60 }, roto);
    expect(Number.isFinite(s.scaleX)).toBe(true);
  });
});
