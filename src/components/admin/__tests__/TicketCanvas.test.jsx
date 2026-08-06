import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TicketCanvas from '../TicketCanvas';
import { MIN_BOX_W } from '../../../utils/dragMath';

// jsdom no implementa ResizeObserver: TicketCanvas lo usa para medir su ancho.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom no hace layout, así que offsetWidth es siempre 0 y el lienzo quedaría
// con escala k=0: todo delta del mouse se traduciría a 0 dots y ningún test de
// arrastre probaría nada. Fijamos el ancho en los 1113 dots del lienzo para que
// k valga exactamente 1 y 1 px de pantalla == 1 dot de impresora.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 1113,
});

// jsdom no implementa PointerEvent, así que fireEvent.pointerDown cae a un
// `Event` pelado y clientX/clientY/shiftKey se pierden por el camino: el
// arrastre mediría siempre 0 dots y los tests pasarían sin probar nada.
// MouseEvent sí trae esas propiedades, y es todo lo que el componente lee.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends window.MouseEvent {
    constructor(type, props = {}) {
      super(type, props);
      this.pointerId = props.pointerId;
    }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const PERF1 = 280;
const PERF2 = 828;

// Elementos con la forma REAL que emite el backend
// (ticketTemplate.controller.js:toPreviewElements): row/col es el ancla FGL y
// boxW/boxH la caja completa en ejes de pantalla.
const evento = {
  type: 'text', zoneId: 'evento', name: 'evento', text: 'FIESTA',
  font: 'F3', hw: [2, 2], row: 104, col: 310, boxW: 500, boxH: 70,
};
// Serial vertical del talón: rotado 270° y NO editable (zoneId null).
const serial = {
  type: 'text', zoneId: null, name: 'serialA', text: '0001-0002',
  font: 'F1', hw: [1, 1], rotation: 270, row: 370, col: 252, boxW: 22, boxH: 355,
};
// Una zona, dos elementos: el número de ticket largo se parte en dos líneas.
const codigo = {
  type: 'text', zoneId: 'codigo', name: 'codigo', text: '0001-0002',
  font: 'F2', hw: [1, 1], row: 296, col: 10, boxW: 235, boxH: 20,
};
const codigo2 = {
  type: 'text', zoneId: 'codigo', name: 'codigo2', text: '-0003',
  font: 'F2', hw: [1, 1], row: 316, col: 10, boxW: 235, boxH: 20,
};

// Origen de cada zona tal como lo arma TicketDesigner desde `boxes`. `ancho`
// existe solo en las cajas de texto (colEnd - colStart); el QR y el logo son
// puntos y no lo tienen.
const ORIGINS = {
  evento: { row: 104, col: 310, ancho: 500 },
  codigo: { row: 296, col: 10, ancho: 235 },
  qr: { row: 100, col: 50 },
  logo: { row: 140, col: 455 },
};

// `selectedZone` es un prop CONTROLADO (el estado vive en TicketDesigner), así
// que los tests montan el mismo lazo padre-hijo real en vez de simularlo: sin
// esto un click no seleccionaría nada y los handles no aparecerían nunca.
function Harness({ elements, talon2StartCol, zoneOrigins, onZoneChange, initialSelected }) {
  const [selectedZone, setSelectedZone] = useState(initialSelected ?? null);
  return (
    <TicketCanvas
      elements={elements}
      stubEndCol={PERF1}
      talon2StartCol={talon2StartCol}
      metrics={null}
      boxes={{}}
      zoneOrigins={zoneOrigins}
      onZoneChange={onZoneChange}
      selectedZone={selectedZone}
      onSelectZone={setSelectedZone}
    />
  );
}

function renderCanvas(props = {}) {
  const onZoneChange = vi.fn();
  const utils = render(
    <Harness
      elements={props.elements || [evento, serial, codigo, codigo2]}
      talon2StartCol={props.talon2StartCol ?? null}
      zoneOrigins={props.zoneOrigins || ORIGINS}
      onZoneChange={onZoneChange}
      initialSelected={props.selectedZone}
    />
  );
  return { ...utils, onZoneChange };
}

const handleOf = (container, zone) => container.querySelector(`[data-zone="${zone}"]`);

// Un arrastre completo: agarrar en (0,0) y soltar en (dx,dy) px de pantalla,
// que con k=1 son dx/dy dots.
function drag(container, zone, dx, dy, { shiftKey = false, soltar = true } = {}) {
  const handle = handleOf(container, zone);
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: dx, clientY: dy, shiftKey });
  if (soltar) fireEvent.pointerUp(handle, { pointerId: 1, clientX: dx, clientY: dy, shiftKey });
  return handle;
}

describe('TicketCanvas — arrastrar para mover', () => {
  beforeEach(() => vi.clearAllMocks());

  it('arrastrar un elemento editable avisa la fila/columna nuevas al soltar', () => {
    const { container, onZoneChange } = renderCanvas();
    drag(container, 'evento', 50, 20);
    expect(onZoneChange).toHaveBeenCalledTimes(1);
    // origen {104, 310} + delta {20, 50}, con el ancho (500) preservado.
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 124, col: 360, colEnd: 860 });
  });

  it('con Shift el movimiento se bloquea al eje dominante', () => {
    const { container, onZoneChange } = renderCanvas();
    // |dx| > |dy| => solo horizontal: la fila no se toca.
    drag(container, 'evento', 50, 20, { shiftKey: true });
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 104, col: 360, colEnd: 860 });

    onZoneChange.mockClear();
    // |dy| > |dx| => solo vertical: ni la columna ni el ancho se tocan.
    drag(container, 'evento', 12, 60, { shiftKey: true });
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 164, col: 310, colEnd: 810 });
  });

  it('arrastrar traslada la caja entera: el elemento se mueve lo mismo que el mouse', () => {
    // Regresión del bug medido contra el motor real: escribir solo `col` movía
    // el borde izquierdo y dejaba el derecho quieto, o sea achicaba la caja, y
    // el alineado se comía parte del desplazamiento (evento centrado avanzaba
    // +25 con un arrastre de +50; precio, alineado a la derecha, +88). Con los
    // dos bordes escritos el ancho no cambia y el motor traslada de verdad.
    const { container, onZoneChange } = renderCanvas();

    drag(container, 'evento', 50, 0);
    const evento = onZoneChange.mock.calls.at(-1)[1];
    expect(evento).toEqual({ row: 104, col: 360, colEnd: 860 });
    expect(evento.colEnd - evento.col).toBe(ORIGINS.evento.ancho); // ancho intacto

    onZoneChange.mockClear();
    drag(container, 'codigo', -8, 12);
    const codigo = onZoneChange.mock.calls.at(-1)[1];
    expect(codigo).toEqual({ row: 308, col: 2, colEnd: 237 });
    expect(codigo.colEnd - codigo.col).toBe(ORIGINS.codigo.ancho);
  });

  it('una caja contra el borde se frena entera en vez de achicarse', () => {
    const { container, onZoneChange } = renderCanvas();
    // Empujón bien pasado de rosca: 310 + 900 = 1210, fuera del lienzo (1112).
    drag(container, 'evento', 900, 0);
    const cfg = onZoneChange.mock.calls.at(-1)[1];
    // El borde derecho toca el tope y la caja SE FRENA: si se recortara cada
    // borde por separado quedaría col 1112 / colEnd 1112, o sea ancho 0.
    expect(cfg).toEqual({ row: 104, col: 612, colEnd: 1112 });
    expect(cfg.colEnd - cfg.col).toBe(ORIGINS.evento.ancho);
  });

  it('un elemento sin zoneId (serial vertical) no es arrastrable ni dispara callback', () => {
    const { container, onZoneChange } = renderCanvas();
    // No se le dibuja rectángulo de arrastre: las únicas manijas son las de
    // las zonas editables. (Se compara la lista de zonas y no un
    // `[data-zone="null"]`, que el selector de jsdom resuelve mal.)
    const zonas = [...container.querySelectorAll('[data-zone]')].map((el) => el.dataset.zone);
    expect(zonas).toEqual(['evento', 'codigo', 'codigo']);

    // Y agarrar el texto del serial en sí tampoco mueve nada.
    const texto = [...container.querySelectorAll('div')].find((d) => d.textContent === '0001-0002');
    fireEvent.pointerDown(texto, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(texto, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(texto, { pointerId: 1, clientX: 40, clientY: 40 });
    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it('arrastrar una zona con dos elementos (codigo + codigo2) desplaza a los dos', () => {
    const { container } = renderCanvas();
    const handles = () => [...container.querySelectorAll('[data-zone="codigo"]')];
    expect(handles().map((h) => h.style.top)).toEqual(['296px', '316px']);

    const h = handles()[0];
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 15, clientY: 30 });

    // Las DOS líneas siguen al mouse, no solo la agarrada.
    expect(handles().map((h2) => h2.style.top)).toEqual(['326px', '346px']);
    expect(handles().map((h2) => h2.style.left)).toEqual(['25px', '25px']);
  });

  it('se resalta en rojo cuando la caja proyectada cruza una perforación activa', () => {
    const { container } = renderCanvas();
    const h = handleOf(container, 'evento');
    expect(h.dataset.invalido).toBe('false');

    // evento ocupa cols 310..810; corriéndolo 50 dots a la izquierda pasa a
    // 260..760 y se come la perforación 1 (col 280).
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(h, { pointerId: 1, clientX: -50, clientY: 0 });
    expect(handleOf(container, 'evento').dataset.invalido).toBe('true');
  });

  it('no se resalta contra la perforación 2 mientras el talón derecho está oculto', () => {
    // 310..810 + 30 => 340..840, que cruza la perforación 2 (col 828).
    const { container } = renderCanvas({ talon2StartCol: null });
    const h = handleOf(container, 'evento');
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 30, clientY: 0 });
    expect(handleOf(container, 'evento').dataset.invalido).toBe('false');

    // El mismo movimiento con el talón derecho VISIBLE sí es inválido.
    const otro = renderCanvas({ talon2StartCol: PERF2 });
    const h2 = handleOf(otro.container, 'evento');
    fireEvent.pointerDown(h2, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(h2, { pointerId: 1, clientX: 30, clientY: 0 });
    expect(handleOf(otro.container, 'evento').dataset.invalido).toBe('true');
  });

  it('se resalta al salirse del área segura del motor, no del lienzo entero', () => {
    const { container } = renderCanvas();
    const h = handleOf(container, 'evento');
    // Fila 104 - 100 = 4, por debajo de SAFE.rowMin (5): el backend lo
    // rechazaría aunque siga dentro del lienzo (fila >= 0).
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 0, clientY: -100 });
    expect(handleOf(container, 'evento').dataset.invalido).toBe('true');
  });

  it('el QR y el logo son arrastrables y escriben fila/columna como cualquier zona', () => {
    const qr = { type: 'qr', zoneId: 'qr', row: 100, col: 50, pointSize: 4, modules: 45, payload: 'X' };
    // Primera fila del logo: la única que trae la caja completa.
    const logo0 = { type: 'graphic', zoneId: 'logo', row: 140, col: 455, hex: 'FF', boxTop: 140, boxLeft: 455, boxW: 200, boxH: 100 };
    const logo1 = { type: 'graphic', zoneId: 'logo', row: 141, col: 455, hex: 'FF' };
    const { container, onZoneChange } = renderCanvas({ elements: [qr, logo0, logo1] });

    // Una sola manija para el logo entero, no una por tira de bitmap.
    expect(container.querySelectorAll('[data-zone="logo"]')).toHaveLength(1);

    // Sin colEnd: son puntos posicionados, no cajas de dos bordes. El maxW del
    // logo es un tamaño de render y lo maneja su slider, no el arrastre.
    drag(container, 'qr', 10, 25);
    expect(onZoneChange).toHaveBeenCalledWith('qr', { row: 125, col: 60 });

    onZoneChange.mockClear();
    drag(container, 'logo', -20, 5);
    expect(onZoneChange).toHaveBeenCalledWith('logo', { row: 145, col: 435 });
  });

  it('un click sin desplazamiento no escribe config', () => {
    const { container, onZoneChange } = renderCanvas();
    const h = handleOf(container, 'evento');
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(h, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it('sin origen conocido para la zona no se ofrece arrastre (evita saltar a 0,0)', () => {
    // `boxes` vacío => zoneOrigins vacío: es lo que pasa en el primer render,
    // antes de que vuelva el primer preview.
    const { container, onZoneChange } = renderCanvas({ zoneOrigins: {} });
    expect(container.querySelectorAll('[data-zone]')).toHaveLength(0);
    expect(onZoneChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Selección + handles de resize
// ---------------------------------------------------------------------------

const resizeHandle = (container, lado) => container.querySelector(`[data-resize="${lado}"]`);

// Arrastre de un handle lateral: mismo protocolo que `drag`, pero el que
// importa es el eje horizontal.
function dragHandle(container, lado, dx, { soltar = true } = {}) {
  const h = resizeHandle(container, lado);
  fireEvent.pointerDown(h, { pointerId: 2, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(h, { pointerId: 2, clientX: dx, clientY: 0 });
  if (soltar) fireEvent.pointerUp(h, { pointerId: 2, clientX: dx, clientY: 0 });
  return h;
}

describe('TicketCanvas — handles de resize', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clickear un elemento selecciona su zona y le dibuja los dos handles', () => {
    const { container } = renderCanvas();
    // Sin selección no hay handles: 13 zonas con manijas a la vez taparían el
    // ticket con controles.
    expect(container.querySelectorAll('[data-resize]')).toHaveLength(0);

    fireEvent.pointerDown(handleOf(container, 'evento'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(handleOf(container, 'evento'), { pointerId: 1, clientX: 0, clientY: 0 });

    expect(handleOf(container, 'evento').dataset.selected).toBe('true');
    expect([...container.querySelectorAll('[data-resize]')].map((h) => h.dataset.resize))
      .toEqual(['left', 'right']);
    // Y solo la seleccionada: `codigo` sigue sin manijas.
    expect(container.querySelectorAll('[data-zone-resize="codigo"]')).toHaveLength(0);
  });

  it('los handles se paran en los bordes de la caja y abarcan su alto', () => {
    const { container } = renderCanvas({ selectedZone: 'evento' });
    const izq = resizeHandle(container, 'left');
    const der = resizeHandle(container, 'right');
    // Centrados en col 310 y 310+500=810, y del alto de la caja (70).
    const w = parseFloat(izq.style.width);
    expect(parseFloat(izq.style.left) + w / 2).toBe(310);
    expect(parseFloat(der.style.left) + w / 2).toBe(810);
    expect(izq.style.height).toBe('70px');
    expect(izq.style.cursor).toBe('ew-resize');
    // Blanco de mouse: con k=1 el mínimo de pantalla manda (14 px > 8 dots).
    expect(w).toBeGreaterThanOrEqual(14);
  });

  it('el handle es más ANCHO en dots cuando el lienzo está escalado chico', () => {
    // Con k=1 el handle mide lo mínimo; a k=0.25 tiene que medir 4 veces más
    // dots para seguir siendo el mismo blanco de mouse en pantalla. Sin esta
    // compensación una barra de 8 dots se dibuja como 2 px y es inagarrable.
    const { container } = renderCanvas({ selectedZone: 'evento' });
    const anchoK1 = parseFloat(resizeHandle(container, 'left').style.width);

    const spy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1113 / 4 });
    const chico = renderCanvas({ selectedZone: 'evento' });
    const anchoK025 = parseFloat(resizeHandle(chico.container, 'left').style.width);
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', spy);

    expect(anchoK025).toBeCloseTo(anchoK1 * 4, 5);
  });

  it('el QR y el logo no tienen handles: son puntos, no cajas de dos bordes', () => {
    const qr = { type: 'qr', zoneId: 'qr', row: 100, col: 50, pointSize: 4, modules: 45, payload: 'X' };
    const logo0 = { type: 'graphic', zoneId: 'logo', row: 140, col: 455, hex: 'FF', boxTop: 140, boxLeft: 455, boxW: 200, boxH: 100 };

    const qrSel = renderCanvas({ elements: [qr, logo0], selectedZone: 'qr' });
    expect(qrSel.container.querySelectorAll('[data-resize]')).toHaveLength(0);

    const logoSel = renderCanvas({ elements: [qr, logo0], selectedZone: 'logo' });
    expect(logoSel.container.querySelectorAll('[data-resize]')).toHaveLength(0);
  });

  it('tirar del handle derecho mueve SOLO el borde derecho', () => {
    const { container, onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    dragHandle(container, 'right', 120);
    // 310..810 => 310..930. `col` intacto: esa es toda la diferencia con mover.
    expect(onZoneChange).toHaveBeenCalledTimes(1);
    expect(onZoneChange).toHaveBeenCalledWith('evento', { col: 310, colEnd: 930 });
  });

  it('tirar del handle izquierdo mueve SOLO el borde izquierdo', () => {
    const { container, onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    dragHandle(container, 'left', 60);
    expect(onZoneChange).toHaveBeenCalledWith('evento', { col: 370, colEnd: 810 });
  });

  it('el handle izquierdo pasado del derecho se frena en MIN_BOX_W, no se invierte', () => {
    const { container, onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    // +900 sobre col 310 daría 1210, muy pasado de colEnd (810).
    dragHandle(container, 'left', 900);
    const cfg = onZoneChange.mock.calls.at(-1)[1];
    expect(cfg).toEqual({ col: 810 - MIN_BOX_W, colEnd: 810 });
    // La caja nunca queda invertida ni por debajo del mínimo que acepta el
    // motor: una más angosta la rechaza el Joi del backend con 400 y el motor
    // la descartaría volviendo al default.
    expect(cfg.colEnd - cfg.col).toBe(MIN_BOX_W);
    expect(cfg.colEnd).toBeGreaterThan(cfg.col);
  });

  it('el handle derecho tampoco puede achicar por debajo de MIN_BOX_W', () => {
    const { container, onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    dragHandle(container, 'right', -900);
    const cfg = onZoneChange.mock.calls.at(-1)[1];
    expect(cfg).toEqual({ col: 310, colEnd: 310 + MIN_BOX_W });
    expect(cfg.colEnd - cfg.col).toBe(MIN_BOX_W);
  });

  it('mientras se arrastra, la barra sigue al puntero y frena donde va a soltar', () => {
    const { container } = renderCanvas({ selectedZone: 'evento' });
    dragHandle(container, 'right', 100, { soltar: false });
    const der = resizeHandle(container, 'right');
    const w = parseFloat(der.style.width);
    expect(parseFloat(der.style.left) + w / 2).toBe(910); // 810 + 100
    // El izquierdo no se mueve: el borde opuesto queda clavado.
    expect(parseFloat(resizeHandle(container, 'left').style.left) + w / 2).toBe(310);
  });

  // El verificador del backend mira la TINTA, no la caja de config. Medido
  // contra el motor: "FESTIVAL DEL SUR" en una caja 310..830 se imprime en
  // 410..730 y el motor lo ACEPTA aunque la caja monte la perforación 828.
  // Estos fixtures reproducen esa diferencia (tinta 320 dentro de caja 500);
  // el `evento` de arriba, con boxW == ancho, es el caso degenerado en que
  // coinciden y no distingue una cosa de la otra.
  const eventoCentrado = { ...evento, col: 400, boxW: 320 }; // tinta 400..720 => centrada
  const eventoDerecha = { ...evento, col: 490, boxW: 320 }; // tinta 490..810 => pegada a la derecha

  it('el resize marca invalido cuando la caja proyectada cruza una perforación', () => {
    const { container } = renderCanvas({
      elements: [eventoCentrado], selectedZone: 'evento', talon2StartCol: PERF2,
    });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('false');

    // Ensanchar 100 mueve la tinta centrada a 450..770: todavía no llega a la
    // perforación 2 (828) y el motor lo acepta. Pintar rojo acá sería el falso
    // rojo que entrena a ignorar el aviso.
    dragHandle(container, 'right', 100, { soltar: false });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('false');

    // Ensanchando 300 la tinta pasa a 550..870 y SÍ cruza la 828 — verificado
    // contra el motor, que devuelve "evento: cruza la perforacion (col 828)".
    dragHandle(container, 'right', 300, { soltar: false });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('true');
    // El contorno del elemento se pinta igual que en un movimiento inválido.
    expect(handleOf(container, 'evento').dataset.invalido).toBe('true');
    // Y el handle izquierdo, aunque no se movió, también avisa: lo inválido es
    // la zona entera, no uno de sus bordes.
    expect(resizeHandle(container, 'left').dataset.invalido).toBe('true');
  });

  it('el resize no marca invalido por la perforación 2 si el talón derecho está oculto', () => {
    // Mismo arrastre que arriba, pero sin talón derecho: esa perforación no
    // existe y pintar rojo ahí enseñaría a ignorar el aviso. El motor también
    // lo acepta (verificado: talon2=OFF, dCol=300 => sin errores).
    const { container } = renderCanvas({
      elements: [eventoCentrado], selectedZone: 'evento', talon2StartCol: null,
    });
    dragHandle(container, 'right', 300, { soltar: false });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('false');
    expect(handleOf(container, 'evento').dataset.invalido).toBe('false');
  });

  it('el resize marca invalido cuando la caja proyectada se sale del área segura', () => {
    // Tinta pegada al borde derecho: ensanchar 300 la lleva a 790..1110, y
    // 1110 pasa SAFE.colMax (1105) aunque siga dentro del lienzo (1112).
    const { container } = renderCanvas({
      elements: [eventoDerecha], selectedZone: 'evento', talon2StartCol: null,
    });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('false');
    dragHandle(container, 'right', 300, { soltar: false });
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('true');
  });

  it('el resize proyecta la TINTA, no la caja: una caja que monta la perforación con el texto lejos no es inválida', () => {
    // Regresión del falso rojo: la primera versión de este chequeo miraba
    // col/colEnd de la config, así que marcaba en rojo la caja 310..840 aunque
    // su texto centrado (410..720) no toque la perforación 828 — y el motor la
    // acepta sin un solo error. El rojo tiene que significar lo mismo que el
    // veredicto del backend, o no significa nada.
    const { container } = renderCanvas({
      elements: [eventoCentrado], selectedZone: 'evento', talon2StartCol: PERF2,
    });
    dragHandle(container, 'right', 30, { soltar: false }); // caja 310..840, monta la 828
    expect(resizeHandle(container, 'right').dataset.invalido).toBe('false');
    expect(handleOf(container, 'evento').dataset.invalido).toBe('false');
  });

  it('un click en el handle sin desplazamiento no escribe config', () => {
    const { container, onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    dragHandle(container, 'right', 0);
    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it('clickear el fondo del lienzo deselecciona (y se lleva los handles)', () => {
    const { container } = renderCanvas({ selectedZone: 'evento' });
    expect(container.querySelectorAll('[data-resize]')).toHaveLength(2);
    // El div escalado del lienzo: el padre de los overlays de zona.
    const fondo = handleOf(container, 'evento').parentElement;
    fireEvent.pointerDown(fondo, { pointerId: 1, clientX: 500, clientY: 200 });
    expect(container.querySelectorAll('[data-resize]')).toHaveLength(0);
  });
});

describe('TicketCanvas — mover con el teclado', () => {
  beforeEach(() => vi.clearAllMocks());

  const tecla = (key, opts = {}) => fireEvent.keyDown(document.body, { key, ...opts });

  it('las flechas mueven 1 dot y Shift+flecha mueve 10', () => {
    const { onZoneChange } = renderCanvas({ selectedZone: 'evento' });

    tecla('ArrowRight');
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 104, col: 311, colEnd: 811 });

    tecla('ArrowUp');
    expect(onZoneChange).toHaveBeenLastCalledWith('evento', { row: 103, col: 310, colEnd: 810 });

    tecla('ArrowRight', { shiftKey: true });
    expect(onZoneChange).toHaveBeenLastCalledWith('evento', { row: 104, col: 320, colEnd: 820 });

    tecla('ArrowDown', { shiftKey: true });
    expect(onZoneChange).toHaveBeenLastCalledWith('evento', { row: 114, col: 310, colEnd: 810 });
  });

  it('el teclado escribe EXACTAMENTE la misma forma que un arrastre equivalente', () => {
    // Si teclado y mouse divergieran, uno de los dos estaría mintiendo sobre
    // dónde queda la zona. Se compara contra el arrastre real, no contra un
    // literal calculado a mano.
    const conMouse = renderCanvas({ selectedZone: 'evento' });
    drag(conMouse.container, 'evento', 10, 10);
    const esperado = conMouse.onZoneChange.mock.calls.at(-1)[1];

    const conTeclado = renderCanvas({ selectedZone: 'evento' });
    tecla('ArrowRight', { shiftKey: true });
    tecla('ArrowDown', { shiftKey: true });
    // Cada tecla parte del MISMO origen (zoneOrigins no cambia en el test), así
    // que la comparación se hace sobre una sola pulsación por eje.
    const [primera, segunda] = conTeclado.onZoneChange.mock.calls.map((c) => c[1]);
    expect(primera).toEqual({ row: 104, col: 320, colEnd: 820 });
    expect(segunda).toEqual({ row: 114, col: 310, colEnd: 810 });
    expect(esperado).toEqual({ row: 114, col: 320, colEnd: 820 });
    expect(Object.keys(primera)).toEqual(Object.keys(esperado));
  });

  it('el QR (zona sin ancho) se mueve con flechas sin inventarle un colEnd', () => {
    const qr = { type: 'qr', zoneId: 'qr', row: 100, col: 50, pointSize: 4, modules: 45, payload: 'X' };
    const { onZoneChange } = renderCanvas({ elements: [qr], selectedZone: 'qr' });
    tecla('ArrowLeft');
    expect(onZoneChange).toHaveBeenCalledWith('qr', { row: 100, col: 49 });
  });

  it('sin zona seleccionada las flechas no hacen nada', () => {
    const { onZoneChange } = renderCanvas();
    tecla('ArrowRight');
    tecla('ArrowDown', { shiftKey: true });
    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it('las flechas NO se roban mientras se tipea en un input o textarea', () => {
    // El diseñador está lleno de InputNumber y del textarea de leyendas: mover
    // el ticket mientras el usuario corrige un número sería infuriante.
    const { onZoneChange } = renderCanvas({ selectedZone: 'evento' });

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    fireEvent.keyDown(ta, { key: 'ArrowDown' });

    // Y los sliders de antd, que ya manejan las flechas por su cuenta.
    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    document.body.appendChild(slider);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });

    expect(onZoneChange).not.toHaveBeenCalled();
    input.remove();
    ta.remove();
    slider.remove();
  });

  it('una tecla ajena no se intercepta (la página sigue scrolleando)', () => {
    const { onZoneChange } = renderCanvas({ selectedZone: 'evento' });
    const ev = new window.KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(onZoneChange).not.toHaveBeenCalled();

    // La que sí maneja, en cambio, se consume: sin esto la flecha movería la
    // zona Y scrollearía la página al mismo tiempo.
    const flecha = new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.body.dispatchEvent(flecha);
    expect(flecha.defaultPrevented).toBe(true);
  });
});
