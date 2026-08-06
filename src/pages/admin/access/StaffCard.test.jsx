import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffCard, { opcionesDePuerta } from './StaffCard';

vi.mock('../../../services/apiService', () => ({
  accessApi: {
    listAssignments: vi.fn(),
    createAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    shows: vi.fn(),
    listGates: vi.fn(),
  },
  adminUsersApi: { listUsers: vi.fn() },
}));

import { accessApi, adminUsersApi } from '../../../services/apiService';

const ASIGNACION = {
  id: '1', userId: '48', userName: 'Ana G.', userEmail: 'ana@x.com',
  gateId: '7', gateCode: 'NORTE', gateName: 'Puerta Norte', isSupervisor: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  // GET /shows devuelve un ARRAY PELADO con columnas snake_case. Verificado en
  // shows.controller.js: `res.json(rows)`.
  accessApi.shows.mockResolvedValue({
    data: [
      { id: '3', event_id: '1', starts_at: '2026-08-08T23:00:00.000Z' },
      { id: '4', event_id: '1', starts_at: '2026-08-09T23:00:00.000Z' },
    ],
  });
  accessApi.listGates.mockResolvedValue({
    data: { gates: [{ id: '7', code: 'NORTE', name: 'Puerta Norte', isActive: true }] },
  });
  accessApi.listAssignments.mockResolvedValue({ data: { assignments: [ASIGNACION] } });
  accessApi.createAssignment.mockResolvedValue({ data: { id: '2' } });
  accessApi.deleteAssignment.mockResolvedValue({ data: { deleted: true } });
  // GET /admin/users envuelve doble: { success, data: { users, pagination } }.
  adminUsersApi.listUsers.mockResolvedValue({
    data: { success: true, data: {
      users: [{ id: '48', name: 'Ana G.', email: 'ana@x.com' }],
      pagination: { page: 1, limit: 100 },
    } },
  });
});

/** Abre el modal y elige a la primera persona de la lista. */
async function abrirYElegirPersona(user) {
  await user.click(screen.getByRole('button', { name: /asignar persona/i }));
  const persona = await screen.findByLabelText('Persona');
  await user.click(persona);
  await user.click(await screen.findByTitle('Ana G. · ana@x.com'));
}

describe('StaffCard', () => {
  it('muestra quién está asignado a la fecha', async () => {
    render(<StaffCard eventId="1" />);
    expect(await screen.findByText('Ana G.')).toBeInTheDocument();
    expect(screen.getByText(/NORTE/)).toBeInTheDocument();
    expect(screen.getByText(/supervisor/i)).toBeInTheDocument();
  });

  it('pide el personal de la PRIMERA fecha, no de todo el evento', async () => {
    render(<StaffCard eventId="1" />);
    await screen.findByText('Ana G.');
    expect(accessApi.listAssignments).toHaveBeenCalledWith('3');
  });

  it('cambiar de fecha recarga el personal de esa fecha', async () => {
    const user = userEvent.setup();
    render(<StaffCard eventId="1" />);
    await screen.findByText('Ana G.');

    // El selector de fecha es el único combobox fuera del modal.
    await user.click(screen.getByLabelText('Fecha'));
    const opciones = await screen.findAllByText(/9\/8\/2026|8\/9\/2026/);
    await user.click(opciones[opciones.length - 1]);

    await waitFor(() => expect(accessApi.listAssignments).toHaveBeenCalledWith('4'));
  });

  it('una asignación sin puerta dice que puede escanear en cualquiera', async () => {
    accessApi.listAssignments.mockResolvedValue({
      data: { assignments: [{ ...ASIGNACION, gateId: null, gateCode: null, gateName: null }] },
    });
    render(<StaffCard eventId="1" />);
    expect(await screen.findByText(/cualquier puerta/i)).toBeInTheDocument();
  });

  it('una persona ya asignada muestra un mensaje entendible, no "Error 409"',
    async () => {
      accessApi.createAssignment.mockRejectedValue({
        response: { status: 409, data: { message: 'Esa asignación ya existe' } },
      });
      const user = userEvent.setup();
      render(<StaffCard eventId="1" />);
      await screen.findByText('Ana G.');

      await abrirYElegirPersona(user);
      await user.click(screen.getByRole('button', { name: /guardar/i }));

      const aviso = await screen.findByText(/ya está|ya existe/i);
      expect(aviso).toBeInTheDocument();
      expect(screen.queryByText(/409/)).toBeNull();
    });

  it('asigna a la fecha elegida y con la persona elegida', async () => {
    const user = userEvent.setup();
    render(<StaffCard eventId="1" />);
    await screen.findByText('Ana G.');

    await abrirYElegirPersona(user);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(accessApi.createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '48', showId: '3' })));
  });

  it('relee las puertas al abrir el modal, para ver la recién creada', async () => {
    // El flujo real es crear la puerta en la tarjeta de arriba y asignarle
    // gente acá, en ese orden. Las dos tarjetas son independientes: si esta
    // sólo pidiera las puertas al montarse, la puerta nueva no estaría en el
    // desplegable y habría que recargar la página entera.
    const user = userEvent.setup();
    render(<StaffCard eventId="1" />);
    await screen.findByText('Ana G.');
    const antes = accessApi.listGates.mock.calls.length;

    accessApi.listGates.mockResolvedValue({
      data: { gates: [
        { id: '7', code: 'NORTE', name: 'Puerta Norte', isActive: true },
        { id: '9', code: 'NUEVA', name: 'Recién creada', isActive: true },
      ] },
    });
    await user.click(screen.getByRole('button', { name: /asignar persona/i }));

    await waitFor(() =>
      expect(accessApi.listGates.mock.calls.length).toBeGreaterThan(antes));
    await user.click(await screen.findByLabelText('Puerta'));
    expect(await screen.findByTitle('NUEVA · Recién creada')).toBeInTheDocument();
  });

  it('quitar usa el id de la asignación, no el del usuario', async () => {
    // Son dos ids distintos y los dos están en la fila. Mandar el del usuario
    // borra la asignación de otra persona, o ninguna.
    const user = userEvent.setup();
    render(<StaffCard eventId="1" />);
    await screen.findByText('Ana G.');

    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await user.click(await screen.findByRole('button', { name: /^s(í|i)$/i }));

    await waitFor(() => expect(accessApi.deleteAssignment).toHaveBeenCalledWith('1'));
  });

  it('sin fechas cargadas lo dice', async () => {
    accessApi.shows.mockResolvedValue({ data: [] });
    render(<StaffCard eventId="1" />);
    expect(await screen.findByText(/no tiene fechas/i)).toBeInTheDocument();
  });

  it('mientras carga no dice que el evento no tiene fechas', () => {
    // La lista arranca vacía: si el cartel dependiera sólo de shows.length,
    // se afirmaría que el evento no tiene fechas antes de haber preguntado.
    render(<StaffCard eventId="1" />);
    expect(screen.queryByText(/no tiene fechas/i)).toBeNull();
  });
});

describe('opcionesDePuerta', () => {
  it('no ofrece las puertas desactivadas', () => {
    // El backend desactiva en vez de borrar las puertas con historia
    // (deleteGate). Si el panel las siguiera ofreciendo, se podría asignar
    // personal a una puerta que ya no baja en el manifiesto y el turno saldría
    // vacío en la app.
    const opciones = opcionesDePuerta([
      { id: '7', code: 'NORTE', name: 'Puerta Norte', isActive: true },
      { id: '8', code: 'VIEJA', name: 'Puerta vieja', isActive: false },
    ]);
    expect(opciones).toEqual([{ value: '7', label: 'NORTE · Puerta Norte' }]);
  });

  it('el value es string, como el gateId que devuelve la API', () => {
    // El backend devuelve los ids como string. Un value numérico haría que el
    // Select no reconozca el valor guardado al editar.
    const [opcion] = opcionesDePuerta([
      { id: 9, code: 'SUR', name: 'Puerta Sur', isActive: true },
    ]);
    expect(opcion.value).toBe('9');
  });
});
