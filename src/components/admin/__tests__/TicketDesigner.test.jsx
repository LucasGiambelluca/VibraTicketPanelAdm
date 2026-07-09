import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketDesigner from '../TicketDesigner';
import * as ticketTemplateService from '../../../services/ticketTemplateService';

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
});
