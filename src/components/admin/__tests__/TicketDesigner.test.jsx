import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    await waitFor(() => expect(screen.getByText('Venue y dirección')).toBeInTheDocument());

    // Apagar SOLO la zona venue desde el switch del header de su panel.
    const venueHeader = screen
      .getByText('Venue y dirección')
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

    expect(successSpy).toHaveBeenCalledWith('Logo subido — zona Logo activada en la plantilla');

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
});
