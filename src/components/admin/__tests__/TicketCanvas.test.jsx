import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TicketCanvas from '../TicketCanvas';

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

const ORIGINS = {
  evento: { row: 104, col: 310 },
  codigo: { row: 296, col: 10 },
  qr: { row: 100, col: 50 },
  logo: { row: 140, col: 455 },
};

function renderCanvas(props = {}) {
  const onZoneChange = vi.fn();
  const utils = render(
    <TicketCanvas
      elements={props.elements || [evento, serial, codigo, codigo2]}
      stubEndCol={PERF1}
      talon2StartCol={props.talon2StartCol ?? null}
      metrics={null}
      boxes={{}}
      zoneOrigins={props.zoneOrigins || ORIGINS}
      onZoneChange={onZoneChange}
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
    // origen {104, 310} + delta {20, 50}
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 124, col: 360 });
  });

  it('con Shift el movimiento se bloquea al eje dominante', () => {
    const { container, onZoneChange } = renderCanvas();
    // |dx| > |dy| => solo horizontal: la fila no se toca.
    drag(container, 'evento', 50, 20, { shiftKey: true });
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 104, col: 360 });

    onZoneChange.mockClear();
    // |dy| > |dx| => solo vertical: la columna no se toca.
    drag(container, 'evento', 12, 60, { shiftKey: true });
    expect(onZoneChange).toHaveBeenCalledWith('evento', { row: 164, col: 310 });
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
