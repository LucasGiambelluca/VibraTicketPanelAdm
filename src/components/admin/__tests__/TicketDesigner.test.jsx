import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import TicketDesigner from '../TicketDesigner';
import * as ticketTemplateService from '../../../services/ticketTemplateService';
import * as printAgentService from '../../../services/printAgentService';

// jsdom no implementa ResizeObserver: TicketCanvas lo usa para medir su
// ancho y escalar el lienzo de 1050x384 dots. Sin este stub, render()
// tiraría un ReferenceError apenas montara el canvas.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

vi.mock('../../../services/ticketTemplateService', () => ({
  getTemplate: vi.fn().mockResolvedValue({ config: { v: 1, zonas: { precio: { row: 280, visible: true } }, stubEndCol: 250 }, logoFilename: null, source: 'default' }),
  previewTemplate: vi.fn().mockResolvedValue({ fgl: '<RC280,280><F3>$ 1,00\n<p>' }),
  saveTemplate: vi.fn().mockResolvedValue({ ok: true }),
  deleteTemplate: vi.fn(), uploadLogo: vi.fn(),
  getCalibration: vi.fn().mockResolvedValue({ calibration: null }),
  saveCalibration: vi.fn().mockResolvedValue({ ok: true, calibration: {} }),
  getCalibrationTicket: vi.fn().mockResolvedValue({ fgl: '<RC5,5><p>' }),
}));

vi.mock('../../../services/printAgentService', () => ({
  agentStatus: vi.fn().mockResolvedValue({ ok: true, printerReachable: true }),
  agentPrint: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('TicketDesigner', () => {
  beforeEach(() => {
    // Limpia calls/resultados entre tests (las implementaciones se re-setean
    // abajo) para que mock.calls.at(-1) nunca lea una llamada de otro test.
    vi.clearAllMocks();
    ticketTemplateService.getTemplate.mockResolvedValue({
      config: { v: 1, zonas: { precio: { row: 280, visible: true } }, stubEndCol: 250 },
      logoFilename: null,
      source: 'default',
    });
    ticketTemplateService.previewTemplate.mockResolvedValue({ fgl: '<RC280,280><F3>$ 1,00\n<p>' });
    printAgentService.agentStatus.mockResolvedValue({ ok: true, printerReachable: true });
    printAgentService.agentPrint.mockResolvedValue({ ok: true });
  });

  it('carga config y muestra controles + preview', async () => {
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('$ 1,00')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('muestra "Usar plantilla global" solo cuando hay eventId y source es "event"', async () => {
    ticketTemplateService.getTemplate.mockResolvedValue({
      config: { v: 1, zonas: { precio: { row: 280, visible: true } }, stubEndCol: 250 },
      logoFilename: null,
      source: 'event',
    });

    const { rerender } = render(<TicketDesigner eventId={null} />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());
    // Sin eventId no debe mostrarse, aunque source sea 'event'.
    expect(screen.queryByRole('button', { name: 'Usar plantilla global' })).not.toBeInTheDocument();

    rerender(<TicketDesigner eventId={42} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Usar plantilla global' })).toBeInTheDocument()
    );
  });

  it('un error de preview no rompe el componente y no bloquea los controles', async () => {
    ticketTemplateService.previewTemplate.mockRejectedValue({
      response: { data: { detail: 'x' } },
    });

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());

    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled(), {
      timeout: 2000,
    });

    // El componente sigue montado y usable pese al error de preview.
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('un error en la carga inicial muestra estado de error con botón Reintentar', async () => {
    const user = userEvent.setup();
    ticketTemplateService.getTemplate.mockRejectedValueOnce({
      response: { data: { detail: 'Network fail' } },
    });

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument());
    expect(screen.getByText('Network fail')).toBeInTheDocument();
    // Sin cfg todavía: los controles del editor no deben estar montados.
    expect(screen.queryByText('Precio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    // El reintento vuelve a llamar getTemplate; con el mock base (resuelto)
    // ya restaurado, el editor carga normalmente.
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('guarda el config sparse tal cual: solo las zonas originales + la tocada', async () => {
    const user = userEvent.setup();
    ticketTemplateService.getTemplate.mockResolvedValue({
      config: { v: 1, zonas: { precio: { row: 280 } }, stubEndCol: 250 },
      logoFilename: null,
      source: 'default',
    });

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Venue')).toBeInTheDocument());

    // Apagar SOLO la zona venue desde el switch del header de su panel.
    const venueHeader = screen
      .getByText('Venue')
      .closest('.ant-collapse-header');
    await user.click(within(venueHeader).getByRole('switch'));

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ticketTemplateService.saveTemplate).toHaveBeenCalled());

    const [eventIdArg, config] = vi.mocked(ticketTemplateService.saveTemplate).mock.calls.at(-1);
    expect(eventIdArg).toBeNull();
    expect(config.v).toBe(1);
    // El config queda sparse: exactamente las zonas originales + la tocada.
    expect(Object.keys(config.zonas).sort()).toEqual(['precio', 'venue']);
    expect(Object.keys(config.zonas)).not.toContain('pie');
    expect(Object.keys(config.zonas)).not.toContain('codigo');
    // La zona original no se toca; la tocada solo lleva el campo modificado.
    expect(config.zonas.precio).toEqual({ row: 280 });
    expect(config.zonas.venue).toEqual({ visible: false });
  });

  it('el textarea de leyendas preserva el tipeo crudo y el payload sale limpio', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Leyendas')).toBeInTheDocument());

    // Expandir el panel Leyendas (Collapse no monta los children hasta abrir).
    await user.click(screen.getByText('Leyendas'));
    await user.click(screen.getByRole('checkbox', { name: 'Usar leyendas propias' }));

    const textarea = screen.getByPlaceholderText('Una leyenda por línea (máx. 3)');
    // Multi-palabra + trailing space + línea en blanco intermedia.
    await user.type(textarea, 'linea uno {enter}{enter}linea dos');

    // El DOM conserva el tipeo tal cual: espacios, Enter y la línea en blanco
    // no se pisan por re-render del controlled input (sin sanitizar acá).
    expect(textarea).toHaveValue('linea uno \n\nlinea dos');

    // El preview debounced recibe el array limpio (trim + sin vacíos).
    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.leyendas).toEqual(['linea uno', 'linea dos']);
      },
      { timeout: 2000 }
    );

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ticketTemplateService.saveTemplate).toHaveBeenCalled());

    const [, config] = vi.mocked(ticketTemplateService.saveTemplate).mock.calls.at(-1);
    expect(config.leyendas).toEqual(['linea uno', 'linea dos']);
  });

  it('el preview refleja los cambios de control (mock eco del payload)', async () => {
    const user = userEvent.setup();
    // Eco: el FGL fake incluye la fila actual de la zona precio, así el test
    // verifica que un cambio de control viaja en el payload real de la
    // próxima llamada a previewTemplate (no un mock fijo desconectado del UI).
    ticketTemplateService.previewTemplate.mockImplementation((config) =>
      Promise.resolve({ fgl: `<RC${config.zonas?.precio?.row ?? 0},0><F3>ECO\n<p>` })
    );

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());

    // Expandir el panel Precio (Collapse no monta los children hasta abrir).
    await user.click(screen.getByText('Precio'));
    const rowInput = await screen.findByRole('spinbutton');

    await user.clear(rowInput);
    await user.type(rowInput, '199');

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.zonas.precio.row).toBe(199);
      },
      { timeout: 3000 }
    );
  });

  it('subir logo activa la zona Logo si estaba oculta y el próximo preview incluye logoFilename', async () => {
    const user = userEvent.setup();
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {});
    ticketTemplateService.getTemplate.mockResolvedValue({
      config: {
        v: 1,
        zonas: { precio: { row: 280, visible: true }, logo: { visible: false } },
        stubEndCol: 250,
      },
      logoFilename: null,
      source: 'default',
    });
    ticketTemplateService.uploadLogo.mockResolvedValue({ logoFilename: 'logo-1-999.png' });

    const { container } = render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Logo')).toBeInTheDocument());
    await user.click(screen.getByText('Logo'));

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    const file = new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() => expect(ticketTemplateService.uploadLogo).toHaveBeenCalled());
    const [eventIdArg, uploadedFile] = vi.mocked(ticketTemplateService.uploadLogo).mock.calls.at(-1);
    expect(eventIdArg).toBeNull();
    expect(uploadedFile.name).toBe('logo.png');

    expect(successSpy).toHaveBeenCalledWith('Logo subido y centrado — movelo desde la zona Logo si hace falta');

    // El próximo preview lleva el logoFilename nuevo Y la zona logo visible.
    await waitFor(
      () => {
        const [config, , logoFilenameArg] = vi
          .mocked(ticketTemplateService.previewTemplate)
          .mock.calls.at(-1);
        expect(logoFilenameArg).toBe('logo-1-999.png');
        expect(config.zonas.logo.visible).toBe(true);
      },
      { timeout: 2000 }
    );
  });

  it('un logo que supera 1 MB muestra un toast en español', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => {});
    ticketTemplateService.uploadLogo.mockRejectedValue({
      response: { data: { error: 'UploadError', detail: 'LIMIT_FILE_SIZE' } },
    });

    const { container } = render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Logo')).toBeInTheDocument());
    await user.click(screen.getByText('Logo'));

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'logo-grande.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('La imagen supera 1 MB. Probá con una más liviana.')
    );
  });

  it('el botón "Imprimir prueba" envía el FGL del preview actual al agente de impresión', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue({ fgl: '<RC10,10><F3>ECO-PRUEBA\n<p>' });

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());

    // name: regex porque el icono PrinterOutlined agrega su aria-label
    // ("printer") al nombre accesible calculado del botón.
    const printButton = await screen.findByRole('button', { name: /Imprimir prueba/ });
    await waitFor(() => expect(printButton).not.toBeDisabled());

    await user.click(printButton);

    await waitFor(() => expect(printAgentService.agentPrint).toHaveBeenCalled());
    const [fglBase64] = vi.mocked(printAgentService.agentPrint).mock.calls.at(-1);
    // agentPrint espera el FGL en base64 (mismo contrato que boxoffice); acá
    // se decodifica para verificar que es exactamente el FGL que devolvió
    // el preview más reciente en el momento del click.
    const decoded = Buffer.from(fglBase64, 'base64').toString('utf8');
    expect(decoded).toBe('<RC10,10><F3>ECO-PRUEBA\n<p>');
  });

  it('el botón "Imprimir prueba" queda deshabilitado si la impresora no está disponible', async () => {
    printAgentService.agentStatus.mockResolvedValue({ ok: false, printerReachable: false });

    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());

    const printButton = await screen.findByRole('button', { name: /Imprimir prueba/ });
    await waitFor(() => expect(printButton).toBeDisabled());
  });

  it('el selector de fuente ofrece las 4 fuentes y arranca en el default de la zona', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Nombre del evento')).toBeInTheDocument());

    await user.click(screen.getByText('Nombre del evento'));
    const panel = screen.getByText('Nombre del evento').closest('.ant-collapse-item');

    expect(within(panel).getByText('Tamaño de letra')).toBeInTheDocument();
    for (const label of ['Chica (1,9 mm)', 'Media (3,9 mm)', 'Grande (6,1 mm)', 'Enorme (7,9 mm)']) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    // Sin `font` en el config, el control muestra el default del motor para
    // evento (DEFAULT_FONTS.evento = 'F3x2' => "Enorme").
    expect(within(panel).getByRole('radio', { name: 'Enorme (7,9 mm)' })).toBeChecked();
  });

  it('cambiar la fuente de "evento" viaja como `font` (no `size`) en el próximo preview', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Nombre del evento')).toBeInTheDocument());
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());

    // Expandir el panel (Collapse no monta los children hasta abrir).
    await user.click(screen.getByText('Nombre del evento'));
    const panel = screen.getByText('Nombre del evento').closest('.ant-collapse-item');
    // El <input type="radio"> de rc-segmented tiene pointer-events:none (solo
    // visualmente accesible); el click real cae en el <label> que lo envuelve,
    // que es lo que arrastra el texto de la opción.
    await user.click(within(panel).getByText('Media (3,9 mm)'));

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.zonas.evento.font).toBe('F3');
        // `size` es una clave que el Joi del backend ya rechaza (unknown(false)):
        // si el panel la escribiera, guardar devolvería 400.
        expect(config.zonas.evento.size).toBeUndefined();
      },
      { timeout: 3000 }
    );
  });

  it('mover el slider "Ancho" del logo viaja como maxW en el próximo preview', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Logo')).toBeInTheDocument());
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());

    // Expandir el panel (Collapse no monta los children hasta abrir).
    await user.click(screen.getByText('Logo'));
    const panel = screen.getByText('Logo').closest('.ant-collapse-item');
    // Sin maxW explícito en el config, el slider arranca en el default del
    // motor (200 dots, ver LOGO_MAXW_DEFAULT) — es el primero de los dos
    // sliders de la zona logo (Ancho antes que Alto).
    const [anchoSlider] = within(panel).getAllByRole('slider');
    expect(anchoSlider).toHaveAttribute('aria-valuenow', '200');

    anchoSlider.focus();
    fireEvent.keyDown(anchoSlider, { key: 'ArrowRight', keyCode: 39, which: 39 });

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.zonas.logo.maxW).toBe(201);
      },
      { timeout: 3000 }
    );
  });

  it('activar "Talón derecho" y mover su slider viajan como talon2.visible/startCol en el próximo preview', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Talón derecho')).toBeInTheDocument());

    const header = screen.getByText('Talón derecho').closest('.ant-collapse-header');
    await user.click(within(header).getByRole('switch'));

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.talon2.visible).toBe(true);
      },
      { timeout: 3000 }
    );

    // Expandir el panel (Collapse no monta los children hasta abrir) para
    // llegar al slider "Columna de inicio".
    await user.click(screen.getByText('Talón derecho'));
    const panel = screen.getByText('Talón derecho').closest('.ant-collapse-item');
    const slider = within(panel).getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '828'); // default PERF_2 (Joi 100..1112)

    slider.focus();
    fireEvent.keyDown(slider, { key: 'ArrowRight', keyCode: 39, which: 39 });

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        expect(config.talon2).toEqual({ visible: true, startCol: 829 });
      },
      { timeout: 3000 }
    );
  });

  it('con eventId el diseñador manda eventId en cada preview (fixture sigue viajando como override)', async () => {
    render(<TicketDesigner eventId={7} />);
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());

    const [config, fixtureArg, , eventIdArg] = vi
      .mocked(ticketTemplateService.previewTemplate)
      .mock.calls.at(-1);
    expect(eventIdArg).toBe(7);
    expect(fixtureArg).toBe('normal'); // selector de fixtures sigue viajando (override explícito)
    expect(config.v).toBe(1);
  });

  it('sin eventId (plantilla global) no manda eventId en el preview', async () => {
    render(<TicketDesigner />);
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());

    const [, , , eventIdArg] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
    expect(eventIdArg).toBeNull();
  });

  it('un 404 EventNotFound cae a un preview de fixture puro (toast + reintento sin eventId)', async () => {
    const warnSpy = vi.spyOn(message, 'warning').mockImplementation(() => {});
    ticketTemplateService.previewTemplate.mockImplementation((config, fixture, logoFilename, eventId) => {
      if (eventId) {
        return Promise.reject({ response: { data: { error: 'EventNotFound' } } });
      }
      return Promise.resolve({ fgl: '<RC1,1><F1>FALLBACK-FIXTURE\n<p>' });
    });

    render(<TicketDesigner eventId={999} />);

    await waitFor(() => expect(warnSpy).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('FALLBACK-FIXTURE')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('un preview con talon2 rotado (<RU>) renderiza sin explotar', async () => {
    ticketTemplateService.previewTemplate.mockResolvedValue({
      fgl:
        '<NR>\n<RC280,280><F3>$ 25.000,00\n<RU>\n<RC350,1040><F2>RS FEST 2\n' +
        '<RC300,1040><F1>SABADO 21 MARZO 16:...\n<NR>\n<p>\n',
    });

    render(<TicketDesigner />);

    await waitFor(() => expect(screen.getByText('RS FEST 2')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('SABADO 21 MARZO 16:...')).toBeInTheDocument();
    expect(screen.getByText('$ 25.000,00')).toBeInTheDocument();
  });

  it('las zonas que no son texto de lectura (QR, emisión, logo) no tienen selector de fuente', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());

    for (const label of ['QR', 'Fecha emisión talón', 'Logo']) {
      await user.click(screen.getByText(label));
      const panel = screen.getByText(label).closest('.ant-collapse-item');
      expect(within(panel).queryByText('Tamaño de letra')).not.toBeInTheDocument();
    }
  });

  it('las zonas de texto que antes no tenían control (código, leyendas, tipo) ahora eligen fuente', async () => {
    const user = userEvent.setup();
    render(<TicketDesigner />);
    await waitFor(() => expect(screen.getByText('Precio')).toBeInTheDocument());

    for (const label of ['Código talón', 'Leyendas', 'Tipo de entrada']) {
      await user.click(screen.getByText(label));
      const panel = screen.getByText(label).closest('.ant-collapse-item');
      expect(within(panel).getByText('Tamaño de letra')).toBeInTheDocument();
      // Todas defaultean a F2 ("Chica") según DEFAULT_FONTS del motor.
      expect(within(panel).getByRole('radio', { name: 'Chica (1,9 mm)' })).toBeChecked();
    }
  });

  // --- Aviso de degradación + "Ensanchar la caja" ----------------------------
  // El backend nuevo devuelve `zones` (fuente pedida vs usada) y `boxes` (cajas
  // resueltas) en cada preview; estos tests los mockean para ejercitar el aviso.
  const previewConEstado = (zones, boxes) => ({
    fgl: '<RC10,10><F3>X\n<p>',
    elements: [],
    warnings: [],
    errors: [],
    metrics: null,
    zones,
    boxes,
  });
  const EVENTO_BOX = { evento: { row: 104, maxHeight: 70, colStart: 310, colEnd: 600 } };

  const abrirEvento = async (user) => {
    await waitFor(() => expect(ticketTemplateService.previewTemplate).toHaveBeenCalled());
    await user.click(screen.getByText('Nombre del evento'));
    return screen.getByText('Nombre del evento').closest('.ant-collapse-item');
  };

  it('el aviso de degradación aparece solo cuando la zona degradó', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue(
      previewConEstado(
        { evento: { fontPedido: 'F3x2', fontUsado: 'F3x2', degradado: false, anchoNecesario: 200 } },
        EVENTO_BOX
      )
    );

    render(<TicketDesigner />);
    const panel = await abrirEvento(user);
    await waitFor(() => expect(within(panel).getByText('Tamaño de letra')).toBeInTheDocument());
    expect(within(panel).queryByText(/no en/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Ensanchar la caja' })).not.toBeInTheDocument();
  });

  it('el aviso de degradación dice qué fuente entró y cuánto ancho falta', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue(
      previewConEstado(
        { evento: { fontPedido: 'F3x2', fontUsado: 'F3', degradado: true, anchoNecesario: 400 } },
        EVENTO_BOX
      )
    );

    render(<TicketDesigner />);
    const panel = await abrirEvento(user);

    await waitFor(() =>
      expect(within(panel).getByText('Entró en F3, no en F3x2')).toBeInTheDocument()
    );
    // 600 - 310 = 290 dots de caja actual.
    expect(within(panel).getByText(/necesita 400 dots y la caja tiene\s+290/)).toBeInTheDocument();
  });

  it('"Ensanchar la caja" escribe col/colEnd hasta que el texto entre en la fuente pedida', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue(
      previewConEstado(
        { evento: { fontPedido: 'F3x2', fontUsado: 'F3', degradado: true, anchoNecesario: 400 } },
        EVENTO_BOX
      )
    );

    render(<TicketDesigner />);
    const panel = await abrirEvento(user);
    const boton = await within(panel).findByRole('button', { name: 'Ensanchar la caja' });
    expect(boton).not.toBeDisabled();

    await user.click(boton);

    await waitFor(
      () => {
        const [config] = vi.mocked(ticketTemplateService.previewTemplate).mock.calls.at(-1);
        // colStart original + anchoNecesario + 4 dots de aire.
        expect(config.zonas.evento).toEqual({ col: 310, colEnd: 714 });
      },
      { timeout: 3000 }
    );
  });

  it('si el texto no entra ni a lo ancho del ticket, el botón queda deshabilitado y explica por qué', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue(
      previewConEstado(
        // 76 chars en F3x2 = 3040 dots sobre un cartón de 1113.
        { evento: { fontPedido: 'F3x2', fontUsado: 'F2', degradado: true, anchoNecesario: 3040 } },
        EVENTO_BOX
      )
    );

    render(<TicketDesigner />);
    const panel = await abrirEvento(user);

    const boton = await within(panel).findByRole('button', { name: 'Ensanchar la caja' });
    expect(boton).toBeDisabled();
    expect(
      within(panel).getByText(/No entra ni a lo ancho del ticket/)
    ).toBeInTheDocument();
  });

  it('si ensanchar pisaría una caja vecina, el botón se deshabilita y nombra al vecino', async () => {
    const user = userEvent.setup();
    ticketTemplateService.previewTemplate.mockResolvedValue(
      previewConEstado(
        { evento: { fontPedido: 'F3x2', fontUsado: 'F3', degradado: true, anchoNecesario: 400 } },
        {
          ...EVENTO_BOX,
          // El logo comparte filas con evento y arranca en col 500: ensanchar
          // hasta 714 lo pisaría y el verificador del backend daría error.
          logo: { row: 110, col: 500, maxW: 200, maxH: 60 },
        }
      )
    );

    render(<TicketDesigner />);
    const panel = await abrirEvento(user);

    const boton = await within(panel).findByRole('button', { name: 'Ensanchar la caja' });
    expect(boton).toBeDisabled();
    expect(within(panel).getByText(/sin pisar "logo"/)).toBeInTheDocument();
  });
});
