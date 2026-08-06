import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessGatesPanel from './AccessGatesPanel';

vi.mock('../../services/apiService', () => ({
  eventsApi: { getEvents: vi.fn() },
  accessApi: {
    listGates: vi.fn(),
    createGate: vi.fn(),
    updateGate: vi.fn(),
    deleteGate: vi.fn(),
    eventSectors: vi.fn(),
    ticketTypes: vi.fn(),
    listAssignments: vi.fn(),
    createAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    shows: vi.fn(),
  },
  adminUsersApi: { listUsers: vi.fn() },
}));

import { eventsApi, accessApi, adminUsersApi } from '../../services/apiService';

beforeEach(() => {
  vi.clearAllMocks();
  // GET /events envuelve doble: { success, data: { events, pagination } }.
  eventsApi.getEvents.mockResolvedValue({
    data: { success: true, data: {
      events: [{ id: 1, name: 'Fiesta de prueba' }],
      pagination: { page: 1, limit: 100 },
    } },
  });
  accessApi.listGates.mockResolvedValue({ data: { gates: [] } });
  accessApi.shows.mockResolvedValue({ data: [] });
  accessApi.listAssignments.mockResolvedValue({ data: { assignments: [] } });
  adminUsersApi.listUsers.mockResolvedValue({
    data: { success: true, data: { users: [], pagination: {} } },
  });
});

describe('AccessGatesPanel', () => {
  it('no pide puertas hasta que se elige un evento', async () => {
    render(<AccessGatesPanel />);
    await waitFor(() => expect(eventsApi.getEvents).toHaveBeenCalled());
    // listGates sin eventId devolvería las puertas de TODOS los eventos.
    expect(accessApi.listGates).not.toHaveBeenCalled();
  });

  it('elegir un evento monta las dos tarjetas con ese id', async () => {
    const user = userEvent.setup();
    render(<AccessGatesPanel />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByTitle('Fiesta de prueba'));

    // El id va como string: es como lo devuelve el resto de la API de accesos.
    await waitFor(() => expect(accessApi.listGates).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(accessApi.shows).toHaveBeenCalledWith('1'));
    expect(await screen.findByText('Puertas del evento')).toBeInTheDocument();
    expect(await screen.findByText('Personal de puerta')).toBeInTheDocument();
  });

  it('si los eventos no cargan, la pantalla no se rompe', async () => {
    eventsApi.getEvents.mockRejectedValue(new Error('sin red'));
    render(<AccessGatesPanel />);
    expect(await screen.findByText('Puertas y personal')).toBeInTheDocument();
  });
});
