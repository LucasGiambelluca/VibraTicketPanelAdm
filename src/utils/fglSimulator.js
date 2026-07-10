// src/utils/fglSimulator.js
// Simulador puro de FGL (lenguaje de la impresora BOCA) para el preview del
// diseñador de tickets. SOLO dibuja: nunca genera FGL. La fuente de verdad
// del FGL es buildTicketFGL en el backend (ApiTickets, feature/fgl-layout).
//
// parseFgl(fgl) recorre el string de comandos y texto plano y devuelve una
// lista de elementos gráficos ({ type, row, col, ... }) listos para que un
// componente React los renderice sobre un lienzo, más una lista de avisos
// para comandos que no se simulan (rotaciones, comandos desconocidos, etc).

// Métricas de fuentes en dots de impresora: [boxWidth, charHeight]
export const FONTS = {
  F1: [7, 7],
  F2: [10, 16],
  F3: [20, 31],
  F4: [7, 9],
  F6: [33, 52],
  F7: [18, 29],
  F8: [22, 40],
  F9: [15, 20],
  F10: [28, 41],
  F11: [28, 49],
  F12: [50, 91],
  F13: [22, 40],
};

// Módulos de QR según versión seleccionada con <QRV#>
const QR_MODULES = { 2: 25, 7: 45, 11: 61, 15: 77 };
const DEFAULT_QR_MODULES = 45;

/**
 * Parsea un string FGL y devuelve los elementos a dibujar en el preview.
 * @param {string} fgl
 * @returns {{ elements: Array<object>, warnings: string[] }}
 */
export function parseFgl(fgl) {
  const elements = [];
  const warnings = [];
  const input = String(fgl || '');
  const len = input.length;

  // Estado del "cursor" de impresión, persiste entre comandos.
  let row = 0;
  let col = 0;
  let font = 'F1';
  let hw = [1, 1]; // [h, w] — multiplicadores de escala, persisten hasta que cambian
  let lt = 1; // grosor de línea: solo aplica al próximo VX/HX/BX, luego vuelve a 1
  let qrModules = DEFAULT_QR_MODULES; // vuelve al default después de cada QR
  // Rotación vigente (cheatsheet §4): 0 = <NR> (default, izquierda→derecha),
  // 180 = <RU>. Solo estos dos estados se simulan (talón derecho, feature
  // 2026-07-10); <RR>/<RL> siguen sin simular (avisan y no se usan hoy).
  let rotation = 0;

  // Vuelca un tramo de texto plano como elemento 'text' (si no queda vacío
  // tras sacarle los saltos de línea, que son separadores, no contenido) y
  // avanza el cursor para que el próximo texto sin RC explícito quede pegado
  // a continuación. Con <NR> el texto corre izquierda→derecha (col avanza);
  // con <RU> corre derecha→izquierda "construye hacia arriba" (cheatsheet
  // §4): el punto (row,col) es el extremo DERECHO de la corrida y el cursor
  // retrocede para la próxima (mismo patrón que NR, eje invertido).
  const flushText = (raw) => {
    const text = raw.replace(/\r?\n/g, '');
    if (!text) return;
    const [boxWidth] = FONTS[font] || FONTS.F1;
    const width = text.length * boxWidth * hw[1];
    const el = { type: 'text', row, col, font, text, hw: [...hw] };
    if (rotation === 180) el.rotation = 180;
    elements.push(el);
    col += rotation === 180 ? -width : width;
  };

  let i = 0;
  while (i < len) {
    if (input[i] === '<') {
      const closeIdx = input.indexOf('>', i);
      if (closeIdx === -1) {
        // '<' sin cierre: no debería pasar en FGL válido; tratamos el resto como texto.
        flushText(input.slice(i));
        break;
      }
      const cmd = input.slice(i + 1, closeIdx);
      i = closeIdx + 1;

      let m;

      // <RCr,c> — mueve el cursor
      if ((m = /^RC(\d+),(\d+)$/.exec(cmd))) {
        row = parseInt(m[1], 10);
        col = parseInt(m[2], 10);
        continue;
      }

      // <F#> — selección de fuente
      if ((m = /^F(\d+)$/.exec(cmd))) {
        font = `F${m[1]}`;
        continue;
      }

      // <HWh,w> — multiplicadores de escala, persisten
      if ((m = /^HW(\d+),(\d+)$/.exec(cmd))) {
        hw = [parseInt(m[1], 10), parseInt(m[2], 10)];
        continue;
      }

      // <LT#> — grosor de línea para el próximo elemento de línea/caja
      if ((m = /^LT(\d+)$/.exec(cmd))) {
        lt = parseInt(m[1], 10);
        continue;
      }

      // <VX n> — línea vertical
      if ((m = /^VX(\d+)$/.exec(cmd))) {
        elements.push({ type: 'line', vertical: true, row, col, length: parseInt(m[1], 10), thickness: lt });
        lt = 1;
        continue;
      }

      // <HX n> — línea horizontal
      if ((m = /^HX(\d+)$/.exec(cmd))) {
        elements.push({ type: 'line', vertical: false, row, col, length: parseInt(m[1], 10), thickness: lt });
        lt = 1;
        continue;
      }

      // <BXr,c> — caja (rectángulo)
      if ((m = /^BX(\d+),(\d+)$/.exec(cmd))) {
        elements.push({
          type: 'box',
          row,
          col,
          height: parseInt(m[1], 10),
          width: parseInt(m[2], 10),
          thickness: lt,
        });
        lt = 1;
        continue;
      }

      // <QRV#> — versión/módulos del próximo QR
      if ((m = /^QRV(\d+)$/.exec(cmd))) {
        qrModules = QR_MODULES[parseInt(m[1], 10)] ?? DEFAULT_QR_MODULES;
        continue;
      }

      // <QR#> o <QR#,#,#,#> seguido inmediatamente de {payload}
      if ((m = /^QR(\d+)(?:,\d+,\d+,\d+)?$/.exec(cmd))) {
        const pointSize = parseInt(m[1], 10);
        let payload = '';
        if (input[i] === '{') {
          const payloadEnd = input.indexOf('}', i);
          if (payloadEnd !== -1) {
            payload = input.slice(i + 1, payloadEnd);
            i = payloadEnd + 1;
          } else {
            warnings.push('QR sin payload cerrado con }');
          }
        } else {
          warnings.push('QR sin payload {...} inmediato');
        }
        elements.push({ type: 'qr', row, col, pointSize, modules: qrModules, payload });
        qrModules = DEFAULT_QR_MODULES;
        continue;
      }

      // <g#>HEX — gráfico: HEX son exactamente los # caracteres siguientes (sin < >)
      if ((m = /^g(\d+)$/.exec(cmd))) {
        const n = parseInt(m[1], 10);
        const hex = input.slice(i, i + n);
        i += n;
        elements.push({ type: 'graphic', row, col, hex });
        continue;
      }

      // <NR> — rotación base (sin rotar); <p>/<q> — fin de ticket, no-ops.
      if (cmd === 'NR' || cmd === 'p' || cmd === 'q') {
        rotation = 0;
        continue;
      }

      // <RU> — rotación +180° (talón derecho, cheatsheet §4): simulada
      // marcando `rotation: 180` en los elementos de texto que siguen (ver
      // flushText); el resto de comandos (RC/F#/HW) funciona igual.
      if (cmd === 'RU') {
        rotation = 180;
        continue;
      }

      // <RR>/<RL> (+90°/+270°): no simuladas, solo se avisa.
      if (cmd === 'RR' || cmd === 'RL') {
        warnings.push(`Rotación ${cmd} no simulada`);
        continue;
      }

      // Cualquier otro comando: no simulado
      warnings.push(`Comando ${cmd} no simulado`);
      continue;
    }

    // Texto plano hasta el próximo comando (o fin del string)
    const next = input.indexOf('<', i);
    const raw = next === -1 ? input.slice(i) : input.slice(i, next);
    i = next === -1 ? len : next;
    flushText(raw);
  }

  return { elements, warnings };
}
