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
import { screenToDots, applyMove, applyResize, hitsPerforation, CANVAS } from '../../utils/dragMath';

const FONT_FAMILY = '"Courier New", Courier, monospace';

// Dimensiones físicas calibradas (CAL VIBRA 2026-07-10, ticket "1113x380"):
// PRINT LENGTH 1113 dots, área imprimible de filas 0–380. Deben coincidir con
// STOCK en ApiTickets/services/fglConstants.js.
const DOTS_W = 1113;
const DOTS_H = 380;

// Área segura del MOTOR (SAFE en ApiTickets/services/ticketLayout.js): todo lo
// que se salga de acá lo rechaza verifyLayout al soltar. Ojo: NO es el lienzo
// entero — el clamp de dragMath (0..1112) es más flojo a propósito, porque es
// aritmética pura y no conoce el margen físico del cartón. Si el resaltado en
// vivo usara el lienzo, el usuario podría soltar en una zona que el cliente
// pintó de verde y el backend rechaza acto seguido, que es exactamente el tipo
// de mentira que este preview existe para no cometer.
const SAFE = { rowMin: 5, rowMax: 375, colMin: 5, colMax: 1105 };

// Rectángulo en pantalla de un elemento del preview, en dots del lienzo.
// Devuelve null si el elemento no trae suficiente geometría (backend viejo por
// parseFgl, o una fila suelta del bitmap del logo): sin caja no hay arrastre ni
// resaltado, que es preferible a inventar un rectángulo.
//
// OJO con la rotación. `row`/`col` es el punto de ANCLAJE FGL, que cambia con
// la rotación (ticketTemplate.controller.js:toPreviewElements):
//   0°   -> ancla arriba-izquierda   (box.top, box.left)
//   180° -> ancla abajo-derecha      (box.top + box.h, box.left + box.w)
//   270° -> ancla abajo-izquierda    (box.top + box.h, box.left)
// En cambio boxW/boxH YA vienen en ejes de PANTALLA para toda rotación (son
// el.box.w/h del motor, ver el mismo archivo), así que acá NO se intercambian:
// un elemento a 270° mide boxW de ancho y boxH de alto en pantalla. Invertirlos
// haría que el resaltado de colisión se dispare sobre los elementos equivocados.
// Lo único que corrige la rotación es de dónde se despeja el borde superior
// izquierdo a partir del ancla.
function bboxOfElement(el) {
  if (el.type === 'text') {
    if (!Number.isFinite(el.boxW) || !Number.isFinite(el.boxH)) return null;
    const w = el.boxW;
    const h = el.boxH;
    if (el.rotation === 180) return { top: el.row - h, left: el.col - w, w, h };
    if (el.rotation === 270) return { top: el.row - h, left: el.col, w, h };
    return { top: el.row, left: el.col, w, h };
  }
  if (el.type === 'qr') {
    const side = el.modules * el.pointSize;
    return { top: el.row, left: el.col, w: side, h: side };
  }
  if (el.type === 'graphic') {
    // Solo la PRIMERA fila del logo trae la caja completa (boxTop/boxLeft/
    // boxW/boxH). Las demás son tiras de 1 dot de alto: darles caja propia
    // pondría 100 rectángulos de arrastre superpuestos sobre el mismo logo.
    if (!Number.isFinite(el.boxW) || !Number.isFinite(el.boxH)) return null;
    return { top: el.boxTop, left: el.boxLeft, w: el.boxW, h: el.boxH };
  }
  if (el.type === 'box') {
    return { top: el.row, left: el.col, w: el.width, h: el.height };
  }
  return null;
}

// Delta efectivo del arrastre: el eje bloqueado con Shift no se aplica ni al
// dibujo optimista ni al valor que se escribe, así ambos cuentan la misma
// historia.
const deltaOf = (drag) => ({
  dRow: drag.lockAxis === 'x' ? 0 : drag.dRow,
  dCol: drag.lockAxis === 'y' ? 0 : drag.dCol,
});

/**
 * Config a escribir para trasladar una zona por un delta.
 *
 * Mover = trasladar la caja entera. Escribir solo `col` mueve el borde
 * izquierdo y deja el derecho quieto, o sea ACHICA la caja — y el alineado
 * entonces redistribuye el texto adentro, que es por qué las zonas centradas
 * se movían la mitad del arrastre y las alineadas a la derecha se pasaban.
 * Redimensionar bordes por separado es el trabajo de los handles (Task 11).
 *
 * Efecto lateral asumido: la plantilla guardada pasa a tener el ancho
 * EXPLÍCITO en vez de heredarlo del default. Es lo más honesto: los defaults se
 * calculan a partir de las columnas de perforación, así que una recalibración
 * de la impresora redimensionaría en silencio una caja que el admin creía haber
 * dejado ubicada. Si alguien quiere volver a seguir el default, los handles de
 * resize se lo permiten.
 *
 * @param {{row:number, col:number, ancho?:number}} origen posición actual de la zona
 * @param {{dRow:number, dCol:number}} delta
 */
export function moveZoneConfig(origen, delta) {
  const movido = applyMove(origen, delta);
  // Zonas sin ancho propio (QR, logo): son puntos, {row, col} ya es la
  // traslación completa. Escribirles un colEnd inventado sería peor que nada.
  if (!Number.isFinite(origen.ancho)) return movido;
  // El par se recorta JUNTO. Si se recortara cada borde por su cuenta, empujar
  // una caja contra el borde derecho dejaría el izquierdo avanzando y el
  // derecho clavado en el tope: la caja se achicaría sola, que es el mismo bug
  // con otro disfraz. Topeando `col` a COLS-1-ancho, la caja se frena entera.
  const colMax = Math.max(0, CANVAS.COLS - 1 - origen.ancho);
  const col = Math.min(movido.col, colMax);
  return { row: movido.row, col, colEnd: col + origen.ancho };
}

/**
 * Config a escribir para redimensionar una caja tirando de un handle lateral.
 *
 * Asimetría deliberada con `moveZoneConfig`: mover traslada los DOS bordes,
 * redimensionar mueve UNO y deja el opuesto clavado. Esa es toda la gracia de
 * los handles — y es también el arreglo de fondo del "el selector de fuente no
 * hace nada": las cajas tenían ancho heredado del default, así que pedir una
 * fuente grande solo lograba que el motor la degradara de vuelta para entrar.
 * Ensanchar la caja ES elegir la fuente.
 *
 * `applyResize` ya recorta a MIN_BOX_W (40 dots) y al lienzo, así que el
 * cliente nunca puede emitir una caja que el Joi del backend rechace con 400
 * (colEnd - col < 40) ni que el motor descarte volviendo al default.
 *
 * @param {{col:number, ancho:number}} origen posición/ancho actual de la caja
 * @param {'left'|'right'} handle
 * @param {number} dCol desplazamiento horizontal en dots
 */
export function resizeZoneConfig(origen, handle, dCol) {
  return applyResize({ col: origen.col, colEnd: origen.col + origen.ancho }, handle, dCol);
}

// Ancho del agarre de los handles, en dots del lienzo. El lienzo entero está
// escalado por k (habitualmente ~0.5 o menos, según el ancho disponible), así
// que una barra de 8 dots puede terminar midiendo 4 px reales de pantalla:
// imposible de agarrar. Se compensa dividiendo por k para que el blanco de
// mouse mida al menos HANDLE_MIN_PX de pantalla, sea cual sea el zoom.
const HANDLE_DOTS = 8;
const HANDLE_MIN_PX = 14;

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
export default function TicketCanvas({
  elements,
  stubEndCol,
  talon2StartCol,
  metrics,
  boxes,
  zoneOrigins,
  onZoneChange,
  selectedZone = null,
  onSelectZone,
}) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  // Arrastre optimista: mientras el puntero está abajo el elemento se mueve
  // local a 60fps, sin ida y vuelta al servidor. Al soltar se escribe la config
  // y el backend re-resuelve: el elemento salta a donde el MOTOR lo puso, que
  // puede no ser donde lo soltó el mouse (centrado, colisión, degradación de
  // fuente). Ese salto es la señal honesta de que la autoridad es el motor.
  const [drag, setDrag] = useState(null);

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

  // Perforaciones ACTIVAS. `talon2StartCol` llega en null cuando el talón
  // derecho está oculto, y entonces su perforación no existe: pasarla igual
  // pintaría de rojo elementos que no chocan con nada. Misma regla que el
  // backend (talon2Visible ? [perf1, perf2] : [perf1]).
  const perforaciones = Number.isFinite(talon2StartCol) ? [stubEndCol, talon2StartCol] : [stubEndCol];

  const puedeArrastrar = (zoneId) => !!(zoneId && onZoneChange && zoneOrigins?.[zoneId]);

  const iniciarDrag = (zoneId, mode) => (e) => {
    if (!puedeArrastrar(zoneId)) return;
    e.preventDefault();
    e.stopPropagation();
    // Seleccionar en el pointerdown (y no en un click aparte) para que agarrar
    // un elemento y ver aparecer sus handles sea el mismo gesto.
    onSelectZone?.(zoneId);
    // Captura: el arrastre sobrevive a que el cursor se vaya del elemento (que
    // con elementos de 20 dots de alto pasa apenas se mueve el mouse).
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ zoneId, mode, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dRow: 0, dCol: 0, lockAxis: null });
  };

  const handlePointerDown = (zoneId) => iniciarDrag(zoneId, 'move');

  // Click en el fondo del lienzo (no sobre un elemento: esos hacen
  // stopPropagation) => deseleccionar. Sin esta salida la selección sería un
  // modo pegajoso: los handles quedan dibujados y el lienzo se queda las
  // flechas del teclado para siempre, sin forma obvia de soltarlo.
  const handleBackgroundPointerDown = (e) => {
    if (e.target !== e.currentTarget) return;
    onSelectZone?.(null);
  };

  const handlePointerMove = (e) => {
    if (!drag) return;
    const dCol = screenToDots(e.clientX - drag.startX, k);
    const dRow = screenToDots(e.clientY - drag.startY, k);
    // Shift = bloquear al eje dominante. 'x' en dragMath significa "solo
    // horizontal" (anula dRow), así que manda el eje con más recorrido.
    const lockAxis = e.shiftKey ? (Math.abs(dCol) >= Math.abs(dRow) ? 'x' : 'y') : null;
    setDrag((prev) => (prev ? { ...prev, dRow, dCol, lockAxis } : prev));
  };

  const handlePointerUp = () => {
    if (!drag) return;
    setDrag(null);
    const origen = zoneOrigins?.[drag.zoneId];
    if (!origen) return;
    if (drag.mode === 'left' || drag.mode === 'right') {
      // Resize: solo cuenta el eje horizontal, y solo se mueve el borde
      // agarrado. El vertical se ignora a propósito — los handles laterales no
      // cambian la fila.
      if (!drag.dCol || !Number.isFinite(origen.ancho)) return;
      onZoneChange?.(drag.zoneId, resizeZoneConfig(origen, drag.mode, drag.dCol));
      return;
    }
    const d = deltaOf(drag);
    // Un click sin desplazamiento no es un movimiento: escribir la config
    // igual dispararía un preview entero para dejar todo donde estaba.
    if (!d.dRow && !d.dCol) return;
    onZoneChange?.(drag.zoneId, moveZoneConfig(origen, d));
  };

  const handlePointerCancel = () => setDrag(null);

  const moviendo = drag && drag.mode === 'move';
  const dragDelta = moviendo ? deltaOf(drag) : null;

  // --- Teclado -------------------------------------------------------------
  // El listener va en `window` y no en el lienzo a propósito. El pointerdown
  // del arrastre hace preventDefault (necesario: sin eso el navegador arranca
  // su propio drag de selección), y eso impide que el foco viaje al elemento
  // agarrado; atar las flechas a "el lienzo enfocado" dejaría al usuario
  // seleccionando con el mouse y sin poder mover con el teclado hasta darle un
  // Tab extra. Con `window` + guardas de target el gesto es uno solo:
  // seleccionás, movés. El lienzo igual lleva tabIndex para que se lo pueda
  // alcanzar (y ver enfocado) sin mouse.
  //
  // La guarda de target es lo que hace esto tolerable: el diseñador está lleno
  // de InputNumber (role=spinbutton, un <input>), el textarea de leyendas y
  // sliders de antd (role=slider, que YA manejan las flechas). Robarles la
  // tecla ahí sería infuriante, así que se sale sin tocar nada.
  const puedeTeclado = !!(selectedZone && onZoneChange && zoneOrigins?.[selectedZone]);
  useEffect(() => {
    if (!puedeTeclado) return undefined;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || (t.closest && t.closest(
        'input, textarea, select, [contenteditable="true"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="textbox"]'
      )))) return;
      const paso = e.shiftKey ? 10 : 1;
      let dRow = 0;
      let dCol = 0;
      if (e.key === 'ArrowUp') dRow = -paso;
      else if (e.key === 'ArrowDown') dRow = paso;
      else if (e.key === 'ArrowLeft') dCol = -paso;
      else if (e.key === 'ArrowRight') dCol = paso;
      else return; // tecla ajena: NO se hace preventDefault, la página sigue scrolleando
      e.preventDefault();
      const origen = zoneOrigins[selectedZone];
      if (!origen) return;
      // Mismísima función que usa el mouse al soltar: si el teclado re-derivara
      // la aritmética, mover con flechas y arrastrar dejarían de coincidir y
      // una de las dos estaría mintiendo sin que nadie se entere.
      onZoneChange(selectedZone, moveZoneConfig(origen, { dRow, dCol }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [puedeTeclado, selectedZone, zoneOrigins, onZoneChange]);

  // --- Handles de resize ---------------------------------------------------
  // Solo para la zona seleccionada, y solo si es una CAJA de dos bordes
  // (`ancho` finito) — mismo portón que usa originOfZone en TicketDesigner. El
  // QR y el logo son puntos posicionados: no tienen borde derecho que tirar
  // (el tamaño del logo es su slider maxW), así que dibujarles handles
  // prometería un control que no existe.
  const origenSel = selectedZone ? zoneOrigins?.[selectedZone] : null;
  let handles = null;
  if (origenSel && Number.isFinite(origenSel.ancho) && onZoneChange) {
    // Alto: la unión de las cajas de los elementos de la zona (`codigo` son dos
    // líneas). Sin elementos visibles no hay nada que redimensionar.
    let top = Infinity;
    let bottom = -Infinity;
    for (const el of elements) {
      if (el.zoneId !== selectedZone) continue;
      const b = bboxOfElement(el);
      if (!b) continue;
      top = Math.min(top, b.top);
      bottom = Math.max(bottom, b.top + b.h);
    }
    if (Number.isFinite(top) && bottom > top) {
      const caja = { col: origenSel.col, colEnd: origenSel.col + origenSel.ancho };
      // Mientras se arrastra un handle, la barra sigue al puntero — pero pasada
      // por applyResize, así que el freno en MIN_BOX_W se VE antes de soltar y
      // no aparece como un salto sorpresa después.
      const vista = drag && (drag.mode === 'left' || drag.mode === 'right')
        ? applyResize(caja, drag.mode, drag.dCol)
        : caja;
      const wDots = k > 0 ? Math.max(HANDLE_DOTS, HANDLE_MIN_PX / k) : HANDLE_DOTS;
      handles = [['left', vista.col], ['right', vista.colEnd]].map(([lado, x]) => (
        <div
          key={lado}
          data-resize={lado}
          data-zone-resize={selectedZone}
          onPointerDown={iniciarDrag(selectedZone, lado)}
          style={{
            position: 'absolute',
            top,
            left: x - wDots / 2,
            width: wDots,
            height: bottom - top,
            cursor: 'ew-resize',
            touchAction: 'none',
            background: 'rgba(0,122,255,0.18)',
            borderLeft: '2px solid #007AFF',
            borderRight: '2px solid #007AFF',
            boxSizing: 'border-box',
          }}
        />
      ));
    }
  }

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
          // move/up/cancel van en el CONTENEDOR, no en cada elemento: con un
          // arrastre rápido el puntero adelanta al elemento y los eventos
          // caerían fuera, cortando el arrastre a mitad de camino. Los del
          // elemento capturado igual burbujean hasta acá.
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handleBackgroundPointerDown}
          tabIndex={0}
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
          {elements.map((el, idx) => {
            // Una zona puede tener MÁS DE UN elemento (`codigo` se parte en
            // `codigo` y `codigo2` cuando el número de ticket es largo), así
            // que se desplaza todo lo que comparta zoneId, no solo lo agarrado.
            const arrastrando = !!(dragDelta && el.zoneId && el.zoneId === drag.zoneId);
            const offset = arrastrando ? dragDelta : null;
            const bbox = bboxOfElement(el);
            let invalido = false;
            if (arrastrando && bbox) {
              const proy = { top: bbox.top + offset.dRow, left: bbox.left + offset.dCol, w: bbox.w, h: bbox.h };
              invalido =
                hitsPerforation(proy, perforaciones) ||
                proy.top < SAFE.rowMin ||
                proy.top + proy.h > SAFE.rowMax ||
                proy.left < SAFE.colMin ||
                proy.left + proy.w > SAFE.colMax;
            }
            return (
              <TicketElement
                key={idx}
                el={el}
                bbox={bbox}
                offset={offset}
                invalido={invalido}
                draggable={puedeArrastrar(el.zoneId) && !!bbox}
                seleccionado={!!el.zoneId && el.zoneId === selectedZone}
                onPointerDown={handlePointerDown(el.zoneId)}
              />
            );
          })}

          {handles}

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

// Dibujo del elemento + su rectángulo de arrastre. El rectángulo va aparte del
// dibujo a propósito: el texto se pinta en un <div> shrink-to-fit rotado y
// escalado (y el logo, en tiras de 1 dot de alto), o sea blancos de mouse
// pésimos. El overlay usa la caja REAL del motor, así el usuario agarra —y ve
// resaltado— exactamente el rectángulo que el backend va a verificar.
function TicketElement({ el, bbox, offset, invalido, draggable, seleccionado, onPointerDown }) {
  const dRow = offset?.dRow || 0;
  const dCol = offset?.dCol || 0;
  return (
    <>
      <ElementShape el={el} dRow={dRow} dCol={dCol} />
      {draggable && bbox && (
        <div
          data-zone={el.zoneId}
          data-invalido={invalido ? 'true' : 'false'}
          data-selected={seleccionado ? 'true' : 'false'}
          onPointerDown={onPointerDown}
          style={{
            position: 'absolute',
            top: bbox.top + dRow,
            left: bbox.left + dCol,
            width: bbox.w,
            height: bbox.h,
            cursor: 'move',
            touchAction: 'none', // sin esto el navegador se queda el gesto y hace scroll
            outline: invalido
              ? '2px solid #E4574B'
              : seleccionado
              ? '2px solid rgba(0,122,255,0.85)'
              : '1px dashed rgba(0,122,255,0.35)',
            background: invalido ? 'rgba(228,87,75,0.12)' : 'transparent',
          }}
        />
      )}
    </>
  );
}

function ElementShape({ el, dRow, dCol }) {
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
        style.top = el.row - cross + dRow;
        style.left = el.col - along + dCol;
        transform = `translate(${along}px, ${cross}px) rotate(180deg) scaleX(${scaleX})`;
      } else if (el.rotation === 90 || el.rotation === 270) {
        // <RR> (90°: texto corre hacia abajo) / <RL> (270°: hacia arriba,
        // emisión vertical del talón). Se dibuja la corrida horizontal y se
        // rota alrededor del punto de anclaje (top-left = el <RC> del FGL):
        // con -90° el texto queda extendiéndose hacia arriba desde el
        // anclaje, con +90° hacia abajo — misma geometría que la impresora.
        // El scaleX va a la derecha de la rotación: se aplica ANTES, sobre el
        // eje largo del texto sin rotar, que es lo que hay que ajustar.
        style.top = el.row + dRow;
        style.left = el.col + dCol;
        transform = `${el.rotation === 90 ? 'rotate(90deg)' : 'rotate(-90deg)'} scaleX(${scaleX})`;
      } else {
        style.top = el.row + dRow;
        style.left = el.col + dCol;
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
            top: el.row + dRow,
            left: el.col + dCol,
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
            top: el.row + dRow,
            left: el.col + dCol,
            width: el.width,
            height: el.height,
            border: `${el.thickness}px solid #191919`,
            boxSizing: 'border-box',
          }}
        />
      );
    case 'qr':
      return <QrCanvas el={el} dRow={dRow} dCol={dCol} />;
    case 'graphic':
      return <GraphicCanvas el={el} dRow={dRow} dCol={dCol} />;
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

function QrCanvas({ el, dRow = 0, dCol = 0 }) {
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
        top: row + dRow,
        left: col + dCol,
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
function GraphicCanvas({ el, dRow = 0, dCol = 0 }) {
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
        top: row + dRow,
        left: col + dCol,
        width,
        height: 1,
        imageRendering: 'pixelated',
      }}
    />
  );
}
