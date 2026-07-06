import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BocaPrinterConfig from '../BocaPrinterConfig';

describe('BocaPrinterConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('muestra los campos de Ethernet cuando el transporte es tcp', async () => {
    localStorage.setItem('bocaConfig', JSON.stringify({ transport: 'tcp', host: '10.0.0.192' }));
    render(<BocaPrinterConfig onSaved={() => {}} />);
    expect(screen.getByLabelText(/ip de la impresora/i)).toHaveValue('10.0.0.192');
    expect(screen.queryByLabelText(/share de windows/i)).not.toBeInTheDocument();
  });

  it('muestra el campo de share cuando el transporte es windows', () => {
    render(<BocaPrinterConfig onSaved={() => {}} />); // default = windows
    expect(screen.getByLabelText(/share de windows/i)).toHaveValue('\\\\localhost\\BOCA');
    expect(screen.queryByLabelText(/ip de la impresora/i)).not.toBeInTheDocument();
  });

  it('guarda transporte tcp con host y puerto en localStorage y avisa via onSaved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<BocaPrinterConfig onSaved={onSaved} />);

    await user.click(screen.getByRole('radio', { name: /ethernet/i }));
    const hostInput = screen.getByLabelText(/ip de la impresora/i);
    await user.clear(hostInput);
    await user.type(hostInput, '10.0.0.192');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = JSON.parse(localStorage.getItem('bocaConfig'));
    expect(saved.transport).toBe('tcp');
    expect(saved.host).toBe('10.0.0.192');
    expect(saved.port).toBe(9100);
  });

  it('guarda el share cuando el transporte es windows', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<BocaPrinterConfig onSaved={onSaved} />);

    const shareInput = screen.getByLabelText(/share de windows/i);
    await user.clear(shareInput);
    await user.type(shareInput, '\\\\localhost\\Lemur');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = JSON.parse(localStorage.getItem('bocaConfig'));
    expect(saved.transport).toBe('windows');
    expect(saved.printer_share).toBe('\\\\localhost\\Lemur');
  });
});
