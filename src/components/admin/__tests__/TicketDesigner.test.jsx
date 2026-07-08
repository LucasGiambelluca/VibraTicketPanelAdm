import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
