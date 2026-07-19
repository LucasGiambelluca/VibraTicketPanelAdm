// Traduce la caja de un elemento de texto del motor de layout (ancho y alto en
// dots de impresora) al estilo CSS que hace que el texto ocupe EXACTAMENTE ese
// rectángulo en el preview del diseñador.
//
// Por qué existe: antes el preview hacía `fontSize = charH` y calculaba un
// letterSpacing a mano. Los glifos de una fuente CSS no llenan el em (Courier
// New ronda el 60%), así que el texto salía visiblemente más chico que lo
// impreso y el preview mentía. Acá se mide la fuente real una vez y se fuerza
// la geometría con un scale, que es exacto para cualquier tipografía.

const FALLBACK_HEIGHT_RATIO = 0.62; // Courier New aproximado, red de seguridad

// Un medidor por familia tipográfica. measureText es barato pero no gratis y el
// preview redibuja en cada frame del arrastre, así que se cachea.
const measurerCache = new Map();

export function createMeasurer(fontFamily, fontWeight = 600) {
  const cacheKey = `${fontWeight} ${fontFamily}`;
  if (measurerCache.has(cacheKey)) return measurerCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext && canvas.getContext('2d');
  // Sin contexto 2D (jsdom sin el paquete `canvas`, o un navegador que lo
  // niega) se cae a métricas nominales en vez de tirar: el preview dibuja el
  // texto con una proporción aproximada, que es mucho mejor que un diseñador
  // que revienta al renderizar.
  if (!ctx) {
    const fallback = {
      heightRatio: FALLBACK_HEIGHT_RATIO,
      // 0.6 es el avance por carácter aproximado de una monoespaciada. Es una
      // estimación grosera y sólo se usa en este camino degradado; con
      // contexto real se mide la fuente de verdad.
      measureWidth: (text, fontSizePx) => text.length * fontSizePx * 0.6,
    };
    measurerCache.set(cacheKey, fallback);
    return fallback;
  }

  const PROBE = 100;
  ctx.font = `${fontWeight} ${PROBE}px ${fontFamily}`;

  const m = ctx.measureText('ABCXYZ0123');
  // fontBoundingBox* da el alto real del glifo. Si el navegador no lo soporta,
  // se cae al ratio nominal en vez de dibujar cualquier cosa.
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  const heightRatio = Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0
    ? (ascent + descent) / PROBE
    : FALLBACK_HEIGHT_RATIO;

  const measurer = {
    heightRatio,
    measureWidth: (text, fontSizePx) => {
      ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
      return ctx.measureText(text).width;
    },
  };
  measurerCache.set(cacheKey, measurer);
  return measurer;
}

/**
 * @param {{text: string, w: number, h: number}} box caja del elemento en dots
 * @param {{heightRatio: number, measureWidth: (t: string, px: number) => number}} measurer
 * @returns {{fontSize: number, scaleX: number}}
 */
export function fitTextStyle({ text, w, h }, measurer) {
  const ratio = measurer.heightRatio > 0 ? measurer.heightRatio : FALLBACK_HEIGHT_RATIO;
  const fontSize = h / ratio;

  if (!text || !text.length) return { fontSize, scaleX: 1 };

  const measured = measurer.measureWidth(text, fontSize);
  const scaleX = measured > 0 ? w / measured : 1;

  return { fontSize, scaleX };
}
