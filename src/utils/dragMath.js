// Aritmética pura del arrastre en el diseñador de tickets. Sin React y sin DOM:
// todo lo que se pueda testear sin montar un componente vive acá.
//
// El lienzo son 1113 x 380 dots de impresora (calibración física del stock
// FGL). En pantalla se dibuja escalado por un factor k, así que todo lo que
// llega del mouse hay que dividirlo por k antes de escribirlo en la config.

// Debe coincidir con CANVAS en ApiTickets/services/ticketLayout.js y con STOCK
// en ApiTickets/services/fglConstants.js.
export const CANVAS = { COLS: 1113, ROWS: 380 };

// Ancho mínimo útil de una caja de texto, en dots. Coincide con MIN_BOX_W del
// motor (ApiTickets/services/ticketLayout.js): por debajo de eso el backend
// descarta el override y la caja vuelve al default, que se siente como si el
// arrastre "rebotara" sin motivo. Recortando acá el usuario nunca lo dispara.
export const MIN_BOX_W = 40;

/** Píxeles de pantalla -> dots de impresora, redondeado al dot entero. */
export function screenToDots(px, k) {
  if (!k) return 0;
  return Math.round(px / k);
}

// Con un rango invertido (max < min) el clamp normal devolvería el max, o sea
// un valor FUERA del rango pedido: basura silenciosa. Devolver el min es la
// única respuesta sana, y evita que una caja mal formada de la config se
// convierta en coordenadas negativas.
const clamp = (v, min, max) => (max < min ? min : Math.min(max, Math.max(min, v)));

/**
 * Mueve una zona por un delta en dots, recortando contra el lienzo.
 * @param {{row: number, col: number}} zona
 * @param {{dRow: number, dCol: number}} delta
 * @param {{lockAxis?: 'x'|'y'}} [opts] 'x' = solo horizontal, 'y' = solo vertical
 */
export function applyMove(zona, delta, opts = {}) {
  const dRow = opts.lockAxis === 'x' ? 0 : delta.dRow;
  const dCol = opts.lockAxis === 'y' ? 0 : delta.dCol;
  return {
    row: clamp(zona.row + dRow, 0, CANVAS.ROWS - 1),
    col: clamp(zona.col + dCol, 0, CANVAS.COLS - 1),
  };
}

/**
 * Redimensiona la caja tirando de un handle lateral. El borde opuesto queda
 * fijo y el que se arrastra nunca lo cruza: se frena a MIN_BOX_W de distancia.
 * @param {{col: number, colEnd: number}} caja
 * @param {'left'|'right'} handle
 * @param {number} dCol desplazamiento en dots
 */
export function applyResize(caja, handle, dCol) {
  if (handle === 'right') {
    return { col: caja.col, colEnd: clamp(caja.colEnd + dCol, caja.col + MIN_BOX_W, CANVAS.COLS - 1) };
  }
  return { col: clamp(caja.col + dCol, 0, caja.colEnd - MIN_BOX_W), colEnd: caja.colEnd };
}

/**
 * ¿La caja cruza alguna perforación? Es una versión simplificada del chequeo
 * que hace verifyLayout en el backend; acá solo sirve para pintar el elemento
 * en rojo EN VIVO durante el arrastre. La autoridad sigue siendo el backend
 * cuando se suelta.
 * @param {{left: number, w: number}} bbox
 * @param {number[]} perforaciones columnas de las perforaciones activas
 */
export function hitsPerforation(bbox, perforaciones) {
  return perforaciones.some(p => bbox.left < p && bbox.left + bbox.w > p);
}
