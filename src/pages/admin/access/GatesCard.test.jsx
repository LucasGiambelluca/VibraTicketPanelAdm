import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import GatesCard, { etiquetaSector } from './GatesCard';

vi.mock('../../../services/apiService', () => ({
  accessApi: {
    listGates: vi.fn(),
    createGate: vi.fn(),
    updateGate: vi.fn(),
    deleteGate: vi.fn(),
    eventSectors: vi.fn(),
    ticketTypes: vi.fn(),
  },
}));

import { accessApi } from '../../../services/apiService';

const puertas = [
  { id: '7', code: 'NORTE', name: 'Puerta Norte', isActive: true,
    sectors: ['Campo'], ticketTypeIds: [] },
  { id: '8', code: 'VIEJA', name: 'Puerta vieja', isActive: false,
    sectors: [], ticketTypeIds: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  accessApi.listGates.mockResolvedValue({ data: { gates: puertas } });
  accessApi.eventSectors.mockResolvedValue({
    data: { sectors: ['Campo', 'Campo con Acceso a Cancha', 'Platea Alta'] },
  });
  accessApi.ticketTypes.mockResolvedValue({ data: { ticketTypes: [] } });
  accessApi.createGate.mockResolvedValue({ data: { id: '9' } });
  accessApi.updateGate.mockResolvedValue({ data: { updated: true } });
  accessApi.deleteGate.mockResolvedValue({ data: { deleted: true } });
});

afterEach(() => {
  // Los message de antd son estáticos y viven 3s en document.body: sin esto,
  // el aviso de un test se encuentra desde el siguiente y da un falso verde.
  message.destroy();
});

/** Abre el modal de "Nueva puerta" y espera a que estén los sectores. */
async function abrirNueva(user) {
  await user.click(await screen.findByRole('button', { name: /nueva/i }));
  await waitFor(() => expect(accessApi.eventSectors).toHaveBeenCalled());
}

/**
 * El desplegable de sectores, ya abierto.
 *
 * No se usa getAllByRole('option') a propósito: los role="option" de antd son
 * un espejo OCULTO para lectores de pantalla (height:0;width:0) que dibuja el
 * value crudo y sólo renderiza tres ítems alrededor del activo. Lo que el
 * usuario ve son los .ant-select-item-option, que no llevan role. Un test que
 * mire el espejo aprueba una lista que en pantalla es ilegible.
 */
async function abrirDesplegableDeSectores(user) {
  await user.click(screen.getByLabelText(/sectores que admite/i));
  await waitFor(() => expect(document.getElementById('sectors_list')).toBeTruthy());
  return document.getElementById('sectors_list').closest('.ant-select-dropdown');
}

describe('etiquetaSector', () => {
  it('deja el texto legible cuando no hay nada raro', () => {
    expect(etiquetaSector('Platea Alta')).toBe('«Platea Alta»');
  });

  it('hace visible el espacio del final, que es el que el HTML se come', () => {
    expect(etiquetaSector('Campo ')).toBe('«Campo·»');
    expect(etiquetaSector('Campo ')).not.toBe(etiquetaSector('Campo'));
  });

  it('hace visible el espacio del principio', () => {
    expect(etiquetaSector(' Campo')).toBe('«·Campo»');
  });

  it('marca un espacio por cada espacio, no uno por todos', () => {
    // 'Campo  ' y 'Campo ' son dos sectores distintos para el motor: si los dos
    // se dibujaran «Campo·» seguirían siendo indistinguibles.
    expect(etiquetaSector('Campo  ')).toBe('«Campo··»');
    expect(etiquetaSector('Campo  ')).not.toBe(etiquetaSector('Campo '));
  });

  it('marca también el tab y el salto de línea, que no se ven en absoluto', () => {
    expect(etiquetaSector('Campo\t')).toBe('«Campo·»');
    expect(etiquetaSector('\nCampo')).toBe('«·Campo»');
  });

  it('no toca las mayúsculas: esa diferencia ya se ve sola', () => {
    expect(etiquetaSector('CAMPO')).toBe('«CAMPO»');
  });

  it('deja pasar el interior tal cual, incluidos los espacios del medio', () => {
    expect(etiquetaSector('Campo  con  Acceso')).toBe('«Campo  con  Acceso»');
  });

  it('no explota con un sector vacío o ausente', () => {
    expect(etiquetaSector('')).toBe('«»');
    expect(etiquetaSector(undefined)).toBe('«»');
    expect(etiquetaSector('   ')).toBe('«···»');
  });
});

describe('GatesCard', () => {
  it('muestra las puertas del evento con sus sectores', async () => {
    render(<GatesCard eventId="1" />);
    expect(await screen.findByText('NORTE')).toBeInTheDocument();
    expect(screen.getByText('Puerta Norte')).toBeInTheDocument();
    expect(screen.getByText(/Campo/)).toBeInTheDocument();
  });

  it('una puerta desactivada se muestra, no se esconde', async () => {
    render(<GatesCard eventId="1" />);
    expect(await screen.findByText('VIEJA')).toBeInTheDocument();
    expect(screen.getByText(/desactivada/i)).toBeInTheDocument();
  });

  it('una puerta sin ninguna regla avisa que admite todo', async () => {
    render(<GatesCard eventId="1" />);
    await screen.findByText('VIEJA');
    // VIEJA no tiene ni sectores ni tipos: sin filas en gate_rules la puerta
    // deja pasar CUALQUIER ticket. Eso no se puede mostrar igual que una puerta
    // configurada, porque parece restringida y no lo está.
    expect(screen.getByText(/admite todas las entradas/i)).toBeInTheDocument();
  });

  it('una puerta restringida sólo por tipo de entrada no dice que admite todo', async () => {
    accessApi.listGates.mockResolvedValue({
      data: { gates: [{ id: '9', code: 'GA', name: 'Puerta GA', isActive: true,
        sectors: [], ticketTypeIds: ['3'] }] },
    });
    render(<GatesCard eventId="1" />);
    await screen.findByText('GA');
    expect(screen.queryByText(/admite todas las entradas/i)).toBeNull();
    expect(screen.getByText(/tipos de entrada: 1/i)).toBeInTheDocument();
  });

  it('no explota si una puerta viene sin arrays de reglas', async () => {
    accessApi.listGates.mockResolvedValue({
      data: { gates: [{ id: '9', code: 'RARA', name: 'Sin arrays', isActive: true }] },
    });
    render(<GatesCard eventId="1" />);
    expect(await screen.findByText('RARA')).toBeInTheDocument();
  });

  it('no pide las puertas si todavía no hay evento elegido', async () => {
    render(<GatesCard eventId={undefined} />);
    await screen.findByText(/puertas del evento/i);
    // accessApi.listGates rechaza sin eventId a propósito (si no, el backend
    // devolvía las puertas de TODOS los eventos). Pero la guarda va acá: una
    // promesa rechazada en cada render pinta un error que no es del usuario.
    expect(accessApi.listGates).not.toHaveBeenCalled();
  });

  it('recarga las puertas cuando cambia el evento elegido', async () => {
    const { rerender } = render(<GatesCard eventId="1" />);
    await waitFor(() => expect(accessApi.listGates).toHaveBeenCalledWith('1'));
    rerender(<GatesCard eventId="2" />);
    await waitFor(() => expect(accessApi.listGates).toHaveBeenCalledWith('2'));
  });

  it('los sectores salen del endpoint y no se escriben a mano', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await user.click(await screen.findByRole('button', { name: /nueva/i }));

    await waitFor(() => expect(accessApi.eventSectors).toHaveBeenCalledWith('1'));
    // El campo de sectores es un select, no un input de texto libre: si fuera
    // texto libre, un typo dejaría una puerta que rechaza a todo el mundo.
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/escribí.*sector/i)).toBeNull();
  });

  it('un sector tipeado a mano que no está en la lista no se puede elegir', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    // Esto es lo que separa mode="multiple" de mode="tags": con tags, este
    // Enter crearía la regla «Campo Inventado», que no existe en ningún asiento
    // y hace que la puerta rechace a todo el mundo sin fallar al guardar.
    const combo = screen.getByLabelText(/sectores que admite/i);
    await user.click(combo);
    await user.type(combo, 'Campo Inventado');
    await user.keyboard('{Enter}');

    await user.type(screen.getByLabelText(/^código$/i), 'SUR');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Puerta Sur');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(accessApi.createGate).toHaveBeenCalled());
    expect(accessApi.createGate.mock.calls[0][0].sectors).toEqual([]);
  });

  it('distingue a simple vista dos sectores que se escriben casi igual', async () => {
    // El endpoint devuelve las variantes que el motor de puerta considera
    // DISTINTAS ('Campo' !== 'CAMPO' !== 'Campo '). En un Select pelado las dos
    // últimas se dibujan idénticas —el HTML colapsa el espacio final— y quien
    // configura la puerta no tiene con qué elegir: elige una al azar y la mitad
    // de los tickets rebota en la entrada.
    accessApi.eventSectors.mockResolvedValue({
      data: { sectors: ['CAMPO', 'Campo', 'Campo '] },
    });
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    const desplegable = await abrirDesplegableDeSectores(user);
    const textos = within(desplegable).getAllByText(/^«/).map((n) => n.textContent);

    expect(textos).toEqual(['«CAMPO»', '«Campo»', '«Campo·»']);
    // Lo que importa no es el formato exacto sino que ninguna opción se lea
    // igual que otra: con label: s crudo, dos de las tres serían el mismo texto.
    expect(new Set(textos).size).toBe(3);
  });

  it('el sector elegido viaja al backend crudo, con su espacio y todo', async () => {
    // La marca « » y el · son sólo para el ojo. Si se colaran en el payload, la
    // regla guardada no coincidiría con ningún seats.sector y la puerta
    // rechazaría a todo el mundo — el mismo bug que se está evitando.
    accessApi.eventSectors.mockResolvedValue({
      data: { sectors: ['Campo', 'Campo '] },
    });
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    const desplegable = await abrirDesplegableDeSectores(user);
    await user.click(within(desplegable).getByText('«Campo·»'));

    await user.type(screen.getByLabelText(/^código$/i), 'SUR');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Puerta Sur');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(accessApi.createGate).toHaveBeenCalled());
    expect(accessApi.createGate.mock.calls[0][0].sectors).toEqual(['Campo ']);
  });

  it('los sectores de una puerta ya guardada también se muestran marcados', async () => {
    // El listado tiene el mismo problema que el desplegable: dos puertas, una
    // con «Campo» y otra con «Campo·», se leerían idénticas.
    accessApi.listGates.mockResolvedValue({
      data: { gates: [{ id: '7', code: 'NORTE', name: 'Puerta Norte', isActive: true,
        sectors: ['Campo '], ticketTypeIds: [] }] },
    });
    render(<GatesCard eventId="1" />);
    expect(await screen.findByText('«Campo·»')).toBeInTheDocument();
  });

  it('avisa cuando el evento no tiene asientos cargados', async () => {
    accessApi.eventSectors.mockResolvedValue({ data: { sectors: [] } });
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await user.click(await screen.findByRole('button', { name: /nueva/i }));

    expect(await screen.findByText(/cargar el mapa/i)).toBeInTheDocument();
  });

  it('no avisa de sectores faltantes cuando el evento sí tiene', async () => {
    // Contracara del test anterior: si el aviso se pintara siempre que el
    // estado arranca vacío, aquel test pasaría sin que el endpoint dijera nada.
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    await waitFor(() =>
      expect(screen.getByLabelText(/sectores que admite/i)).toBeInTheDocument());
    expect(screen.queryByText(/cargar el mapa/i)).toBeNull();
  });

  it('no dice que el evento no tiene sectores mientras todavía los está pidiendo', async () => {
    // Sin esto el aviso se pinta apenas abre el modal, porque el estado arranca
    // vacío: le dice al usuario algo del evento que todavía no sabe. Y además
    // haría que el test de arriba aprobara sin que el endpoint dijera nada.
    let responder;
    accessApi.eventSectors.mockReturnValue(new Promise((res) => { responder = res; }));
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await user.click(await screen.findByRole('button', { name: /nueva/i }));
    await screen.findByLabelText(/sectores que admite/i);

    expect(screen.queryByText(/cargar el mapa/i)).toBeNull();

    responder({ data: { sectors: [] } });
    expect(await screen.findByText(/cargar el mapa/i)).toBeInTheDocument();
  });

  it('al crear manda el eventId y ninguna clave que el backend rechace', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    await user.type(screen.getByLabelText(/^código$/i), 'SUR');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Puerta Sur');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(accessApi.createGate).toHaveBeenCalled());
    const payload = accessApi.createGate.mock.calls[0][0];
    // El Joi de createGate no tiene isActive: mandarlo da 400 "isActive is not
    // allowed" y la puerta no se crea. Se miran las CLAVES y no sólo los
    // valores porque una clave de más con undefined pasaría un toEqual.
    expect(Object.keys(payload).sort())
      .toEqual(['code', 'eventId', 'name', 'sectors', 'ticketTypeIds']);
    expect(payload).toEqual({
      eventId: '1', code: 'SUR', name: 'Puerta Sur', sectors: [], ticketTypeIds: [],
    });
  });

  it('abrir "Nueva puerta" después de editar no arrastra las reglas de la anterior', async () => {
    // El formulario es uno solo y se reusa. Si no se limpia, la puerta nueva
    // nace con los sectores de la que se estaba editando y nadie lo nota.
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await screen.findByText('NORTE');

    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    await waitFor(() => expect(accessApi.eventSectors).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    await user.click(screen.getByRole('button', { name: /nueva/i }));
    await user.type(screen.getByLabelText(/^código$/i), 'SUR');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Puerta Sur');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(accessApi.createGate).toHaveBeenCalled());
    expect(accessApi.createGate.mock.calls[0][0]).toEqual({
      eventId: '1', code: 'SUR', name: 'Puerta Sur', sectors: [], ticketTypeIds: [],
    });
  });

  it('al editar NO manda eventId, que el PUT rechaza con 400', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await screen.findByText('NORTE');

    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    await waitFor(() => expect(accessApi.eventSectors).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(accessApi.updateGate).toHaveBeenCalled());
    const [gateId, payload] = accessApi.updateGate.mock.calls[0];
    expect(gateId).toBe('7');
    expect(payload).not.toHaveProperty('eventId');
    expect(payload).toEqual({
      code: 'NORTE', name: 'Puerta Norte', sectors: ['Campo'],
      ticketTypeIds: [], isActive: true,
    });
  });

  it('recarga el listado después de editar, porque el PUT sólo devuelve updated', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await screen.findByText('NORTE');
    expect(accessApi.listGates).toHaveBeenCalledTimes(1);

    accessApi.listGates.mockResolvedValue({
      data: { gates: [{ ...puertas[0], name: 'Puerta Norte 2' }, puertas[1]] },
    });
    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    await waitFor(() => expect(accessApi.eventSectors).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText('Puerta Norte 2')).toBeInTheDocument();
    expect(accessApi.listGates).toHaveBeenCalledTimes(2);
  });

  it('un código duplicado avisa y deja el modal abierto para corregirlo', async () => {
    accessApi.createGate.mockRejectedValue({ response: { status: 409 } });
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await abrirNueva(user);

    await user.type(screen.getByLabelText(/^código$/i), 'NORTE');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Otra Norte');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText(/ya existe una puerta con ese código/i)).toBeInTheDocument();
    // Si el modal se cerrara, el usuario perdería lo que escribió y tendría que
    // cargar todo de nuevo para cambiar una letra del código.
    //
    // Se mira que el diálogo esté VISIBLE, no que el input siga en el DOM: antd
    // no desmonta el contenido del Modal al cerrarlo, sólo le pone display:none
    // al wrapper. Un toHaveValue sobre el input pasa igual con el modal cerrado
    // y no prueba nada (verificado mutando el componente).
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText(/^código$/i)).toHaveValue('NORTE');
  });

  it('cuando el backend desactiva en vez de borrar, lo dice', async () => {
    accessApi.deleteGate.mockResolvedValue({
      data: { deleted: false, deactivated: true, reason: 'tiene escaneos' },
    });
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await screen.findByText('NORTE');

    await user.click(screen.getAllByRole('button', { name: /borrar/i })[0]);
    await user.click(await screen.findByRole('button', { name: /^s(í|i)$/i }));

    expect(await screen.findByText(/se desactiv/i)).toBeInTheDocument();
  });

  it('cuando el backend borra de verdad, no dice que desactivó', async () => {
    const user = userEvent.setup();
    render(<GatesCard eventId="1" />);
    await screen.findByText('NORTE');

    await user.click(screen.getAllByRole('button', { name: /borrar/i })[0]);
    await user.click(await screen.findByRole('button', { name: /^s(í|i)$/i }));

    expect(await screen.findByText(/puerta borrada/i)).toBeInTheDocument();
    expect(screen.queryByText(/se desactiv/i)).toBeNull();
  });
});
