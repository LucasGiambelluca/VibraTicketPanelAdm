// src/components/admin/TicketCanvas.jsx
// Lienzo del diseñador de tickets: dibuja los elementos resueltos por el motor
// de layout del backend sobre 1113 x 380 dots, escalados con transform para
// entrar en el ancho disponible.
//
// No genera FGL ni calcula posiciones: solo dibuja lo que vino del preview.
// La fuente de verdad del layout es el backend (ApiTickets, resolveLayout) —
// duplicar acá la lógica de posicionamiento haría que el preview y la
// impresión se separen, que es exactamente el bug que este diseñador existe
// para evitar.
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'antd';
import { FONTS } from '../../utils/fglSimulator';
import { fitTextStyle, createMeasurer } from '../../utils/textFit';

const FONT_FAMILY = '"Courier New", Courier, monospace';

// Dimensiones físicas calibradas (CAL VIBRA 2026-07-10, ticket "1113x380"):
// PRINT LENGTH 1113 dots, área imprimible de filas 0–380. Deben coincidir con
// STOCK en ApiTickets/services/fglConstants.js.
const DOTS_W = 1113;
const DOTS_H = 380;

// ---------------------------------------------------------------------------
// TicketCanvas: dibuja los elementos resueltos sobre un lienzo de DOTS_W x
// DOTS_H "dots" (1 dot = 1px) escalado con transform para caber en el ancho
// disponible. Puramente presentacional, sin llamadas a la API.
//
// `metrics` y `boxes` son las métricas efectivas y las cajas resueltas que
// devuelve /preview. Hoy el dibujo del texto no las necesita (cada elemento ya
// trae su boxW/boxH), pero se reciben acá porque son el contrato del preview y
// las consumen los overlays de zona.
// ---------------------------------------------------------------------------
export default function TicketCanvas({ elements, stubEndCol, talon2StartCol, metrics, boxes }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const k = width > 0 ? width / DOTS_W : 0;
  const heightPx = DOTS_H * k;

  // Si el navegador no da contexto 2D no se puede medir la tipografía y el
  // texto se dibuja con proporciones nominales. Se avisa en vez de callarlo:
  // un preview que aproxima sin decirlo es el mismo pecado que este archivo
  // existe para arreglar.
  const approximate = createMeasurer(FONT_FAMILY).approximate === true;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {approximate && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="El navegador no permite medir la tipografía: el preview dibuja con proporciones aproximadas."
        />
      )}
      <div style={{ width: '100%', height: heightPx, overflow: 'hidden' }}>
        <div
          style={{
            width: DOTS_W,
            height: DOTS_H,
            transform: `scale(${k})`,
            transformOrigin: '0 0',
            position: 'relative',
            background: '#FBFAF6',
            borderRadius: 3,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            color: '#191919',
          }}
        >
          {elements.map((el, idx) => (
            <TicketElement key={idx} el={el} />
          ))}

          {/* Línea de perforación del talón */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: stubEndCol,
              width: 0,
              height: DOTS_H,
              borderLeft: '2px dashed #E4574B',
              pointerEvents: 'none',
            }}
          />
          {/* Línea de perforación 2 (talón de control derecho, si está activo) */}
          {Number.isFinite(talon2StartCol) && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: talon2StartCol,
                width: 0,
                height: DOTS_H,
                borderLeft: '2px dashed #E4574B',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Tinte del área del talón */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: stubEndCol,
              height: DOTS_H,
              background: 'rgba(0,122,255,0.05)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TicketElement({ el }) {
  switch (el.type) {
    case 'text': {
      // El backend manda la caja YA resuelta (boxW/boxH en dots). El preview no
      // recalcula tamaños: pinta exactamente el rectángulo que se va a imprimir.
      //
      // Respaldo: un backend viejo (camino parseFgl) no manda boxW/boxH. Ahí se
      // deriva la caja de la tabla local FONTS — aproximada y sin calibrar,
      // pero infinitamente mejor que fontSize 0, o sea texto invisible.
      const fb = FONTS[el.font] || FONTS.F1;
      const hw = el.hw || [1, 1];
      // OJO con boxW/boxH en los elementos rotados 90°/270°: el backend los
      // reporta en ejes de PANTALLA, no del texto. El serial vertical vuelve
      // como boxW:9 / boxH:224 — 9 es el alto del glifo (F1) y 224 el largo de
      // la corrida. Verificado contra /preview local, no asumido. Si se pasara
      // boxW/boxH directo a fitTextStyle, el serial saldría con fontSize
      // 224/0.62 ≈ 361px aplastado por un scaleX diminuto. Por eso se traduce a
      // ejes del texto: `along` (largo de la corrida) y `cross` (alto del
      // glifo). En 0° y 180° los ejes ya coinciden.
      const rotated = el.rotation === 90 || el.rotation === 270;
      const fbAlong = (el.text || '').length * fb[0] * hw[1];
      const fbCross = fb[1] * hw[0];
      const along = (rotated ? el.boxH : el.boxW) ?? fbAlong;
      const cross = (rotated ? el.boxW : el.boxH) ?? fbCross;
      const measurer = createMeasurer(FONT_FAMILY);
      const { fontSize, scaleX } = fitTextStyle({ text: el.text, w: along, h: cross }, measurer);

      const style = {
        position: 'absolute',
        fontFamily: FONT_FAMILY,
        fontWeight: 600,
        whiteSpace: 'pre',
        fontSize,
        lineHeight: `${fontSize}px`,
        color: '#191919',
        transformOrigin: '0 0',
      };

      let transform = `scaleX(${scaleX})`;
      if (el.rotation === 180) {
        // Talón derecho (<RU>, fglSimulator.js): (el.row, el.col) es el punto
        // de anclaje del comando FGL, que para RU es el extremo DERECHO/ABAJO
        // de la corrida en el sistema de coordenadas SIN rotar (el texto
        // "construye hacia arriba", cheatsheet §4) — o sea, la esquina
        // inferior-derecha de la caja, no la superior-izquierda como en NR.
        //
        // OJO con el orden y el origen: la caja del <div> es shrink-to-fit, o
        // sea el ancho MEDIDO sin escalar, que no es `w`. Con
        // transformOrigin:'center' (lo que hacía el código viejo, cuando el
        // ancho del div sí era el final) el scaleX mueve el bounding box medio
        // (medido - w) y el talón queda corrido. Por eso acá se ancla en 0 0 y
        // se compone translate(w,h) ∘ rotate(180°) ∘ scaleX: scaleX lleva la
        // tinta a [0,w], rotate la manda a [-w,0]×[-lineH,0] y el translate la
        // reubica en [col-along, col] × [row-lineH, row] — el mismo rectángulo
        // que ocupaba antes, ahora con el ancho real de la impresión.
        style.top = el.row - cross;
        style.left = el.col - along;
        transform = `translate(${along}px, ${cross}px) rotate(180deg) scaleX(${scaleX})`;
      } else if (el.rotation === 90 || el.rotation === 270) {
        // <RR> (90°: texto corre hacia abajo) / <RL> (270°: hacia arriba,
        // emisión vertical del talón). Se dibuja la corrida horizontal y se
        // rota alrededor del punto de anclaje (top-left = el <RC> del FGL):
        // con -90° el texto queda extendiéndose hacia arriba desde el
        // anclaje, con +90° hacia abajo — misma geometría que la impresora.
        // El scaleX va a la derecha de la rotación: se aplica ANTES, sobre el
        // eje largo del texto sin rotar, que es lo que hay que ajustar.
        style.top = el.row;
        style.left = el.col;
        transform = `${el.rotation === 90 ? 'rotate(90deg)' : 'rotate(-90deg)'} scaleX(${scaleX})`;
      } else {
        style.top = el.row;
        style.left = el.col;
      }
      style.transform = transform;

      return <div style={style}>{el.text}</div>;
    }
    case 'line': {
      const size = el.vertical
        ? { width: el.thickness, height: el.length }
        : { width: el.length, height: el.thickness };
      return (
        <div
          style={{
            position: 'absolute',
            top: el.row,
            left: el.col,
            background: '#191919',
            ...size,
          }}
        />
      );
    }
    case 'box':
      return (
        <div
          style={{
            position: 'absolute',
            top: el.row,
            left: el.col,
            width: el.width,
            height: el.height,
            border: `${el.thickness}px solid #191919`,
            boxSizing: 'border-box',
          }}
        />
      );
    case 'qr':
      return <QrCanvas el={el} />;
    case 'graphic':
      return <GraphicCanvas el={el} />;
    default:
      return null;
  }
}

// Hash determinístico (FNV-1a + mezcla estilo xorshift) para generar un
// patrón "falso" de módulos de QR a partir del payload, solo para el
// preview visual — nunca se usa para generar el QR real (eso lo hace la
// impresora con el comando <QR#>{payload}).
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashCell(seed, r, c) {
  let h = seed ^ Math.imul(r + 1, 374761393) ^ Math.imul(c + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function QrCanvas({ el }) {
  const { row, col, pointSize, modules, payload } = el;
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = modules;
    canvas.height = modules;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, modules, modules);
    ctx.fillStyle = '#FBFAF6';
    ctx.fillRect(0, 0, modules, modules);
    ctx.fillStyle = '#191919';

    const seed = fnv1a(payload || '');
    // Los 3 "ojos" (finder patterns) de un QR real: anillo 7x7 con centro 3x3,
    // rodeados de un margen blanco de 1 módulo.
    const finders = [
      [0, 0],
      [0, modules - 7],
      [modules - 7, 0],
    ];

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        let dark = null;
        for (const [fr, fc] of finders) {
          const rr = r - fr;
          const cc = c - fc;
          if (rr >= -1 && rr <= 7 && cc >= -1 && cc <= 7) {
            if (rr < 0 || rr > 6 || cc < 0 || cc > 6) {
              dark = false; // margen de aclarado alrededor del ojo
            } else {
              const isBorder = rr === 0 || rr === 6 || cc === 0 || cc === 6;
              const isCenter = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
              dark = isBorder || isCenter;
            }
            break;
          }
        }
        if (dark === null) {
          dark = hashCell(seed, r, c) > 0.52;
        }
        if (dark) ctx.fillRect(c, r, 1, 1);
      }
    }
  }, [modules, payload]);

  const sizePx = modules * pointSize;
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        top: row,
        left: col,
        width: sizePx,
        height: sizePx,
        imageRendering: 'pixelated',
      }}
    />
  );
}

// Un <canvas> por elemento `graphic`: cada elemento es UNA fila del logo
// (altura 1 dot). Cada par de caracteres hex = 1 byte = 8 dots horizontales,
// bit más significativo primero (igual que el formato <g#>HEX de BOCA).
function GraphicCanvas({ el }) {
  const { row, col, hex } = el;
  const ref = useRef(null);
  const width = Math.max(1, hex.length * 4);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = 1;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, width, 1);
    ctx.fillStyle = '#191919';
    const nBytes = Math.floor(hex.length / 2);
    for (let b = 0; b < nBytes; b++) {
      const byte = parseInt(hex.substr(b * 2, 2), 16);
      if (Number.isNaN(byte)) continue;
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (0x80 >> bit)) ctx.fillRect(b * 8 + bit, 0, 1, 1);
      }
    }
  }, [hex, width]);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        top: row,
        left: col,
        width,
        height: 1,
        imageRendering: 'pixelated',
      }}
    />
  );
}
