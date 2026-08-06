import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Empty, Form, List, Modal, Popconfirm, Select, Space, Switch,
  Tag, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { accessApi, adminUsersApi } from '../../../services/apiService';
import { extractArray } from '../../../utils/extractArray';

/**
 * Las puertas que se pueden elegir al asignar a alguien.
 *
 * Sólo las activas. El backend desactiva —en vez de borrar— las puertas que ya
 * tienen escaneos o personal (`deleteGate`), y `buildManifest` filtra por
 * `is_active`: una puerta desactivada no baja a los dispositivos. Ofrecerla acá
 * dejaría asignar personal a una puerta que en la app no existe, y el turno
 * saldría vacío sin ningún error que lo explique.
 *
 * El `value` va como string porque así vienen los ids de la API; con un número
 * el Select no reconocería el valor ya guardado.
 */
export function opcionesDePuerta(gates) {
  return (gates || [])
    .filter((g) => g.isActive)
    .map((g) => ({ value: String(g.id), label: `${g.code} · ${g.name}` }));
}

/** Cómo se escribe una fecha de función en el selector. */
function etiquetaFecha(show) {
  // La columna es `starts_at`, snake_case: `GET /shows` devuelve las filas tal
  // como salen de la base, sin camelizar.
  const crudo = show.starts_at ?? show.startsAt;
  const fecha = new Date(crudo);
  return Number.isNaN(fecha.getTime())
    ? String(crudo ?? 'Sin fecha')
    : fecha.toLocaleString('es-AR');
}

/**
 * Personal de puerta de una fecha.
 *
 * El turno es por fecha, no por evento: `staff_assignments` cuelga de `show_id`
 * y la app de puerta pide sus asignaciones para el día. Por eso la tarjeta
 * trabaja siempre sobre una fecha elegida, aunque las puertas sean del evento.
 */
export default function StaffCard({ eventId }) {
  const [shows, setShows] = useState([]);
  // Las fechas arrancan vacías y también quedan vacías cuando el evento no
  // tiene ninguna: sin esta bandera el cartel de "no tiene fechas" se pintaría
  // mientras todavía se están pidiendo, afirmando algo que no se sabe.
  const [showsListos, setShowsListos] = useState(false);
  const [showId, setShowId] = useState(null);
  const [gates, setGates] = useState([]);
  const [porteros, setPorteros] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!eventId) {
      setShows([]);
      setShowId(null);
      setShowsListos(false);
      return;
    }
    let vigente = true;
    (async () => {
      try {
        const [s, g] = await Promise.all([
          accessApi.shows(eventId),
          accessApi.listGates(eventId),
        ]);
        if (!vigente) return;
        // `GET /shows` devuelve un array pelado; los endpoints nuevos de access
        // devuelven `{ gates: [] }`. extractArray cubre las dos formas.
        const lista = extractArray(s, 'shows');
        setShows(lista);
        setGates(extractArray(g, 'gates'));
        setShowId(lista.length ? String(lista[0].id) : null);
        setShowsListos(true);
      } catch (e) {
        if (!vigente) return;
        // Si la lista no llegó, no se sabe si el evento tiene fechas: se deja el
        // cartel apagado y se dice lo que realmente pasó.
        setShowsListos(false);
        message.error('No se pudieron cargar las fechas del evento');
      }
    })();
    // Cambiar de evento mientras la respuesta anterior viaja dejaría las fechas
    // del evento viejo pisando a las nuevas.
    return () => { vigente = false; };
  }, [eventId]);

  useEffect(() => {
    (async () => {
      try {
        const r = await adminUsersApi.listUsers({ role: 'DOOR', limit: 100 });
        setPorteros(extractArray(r, 'users'));
      } catch (e) {
        message.error('No se pudo cargar la lista de personal de puerta');
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    if (!showId) { setAsignaciones([]); return; }
    setCargando(true);
    try {
      const r = await accessApi.listAssignments(showId);
      setAsignaciones(extractArray(r, 'assignments'));
    } catch (e) {
      message.error(e?.response?.data?.message || 'No se pudo cargar el personal');
    } finally {
      setCargando(false);
    }
  }, [showId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Los campos se limpian una vez que el modal está montado: el Modal no
  // renderiza su contenido hasta la primera apertura, y tocar el Form antes deja
  // la instancia de useForm sin conectar a ningún Form.
  useEffect(() => {
    if (!abierto) return;
    form.resetFields();
  }, [abierto, form]);

  const asignar = async (values) => {
    try {
      await accessApi.createAssignment({
        userId: values.userId,
        // Sin puerta elegida, la asignación vale para cualquier puerta de la
        // fecha: así lo trata `staff_assignments.gate_id NULL`. Se manda null
        // explícito porque axios borra las claves undefined del body.
        gateId: values.gateId || null,
        isSupervisor: Boolean(values.isSupervisor),
        showId,
      });
      message.success('Persona asignada');
      setAbierto(false);
      cargar();
    } catch (e) {
      if (e?.response?.status === 409) {
        // El backend responde Conflict. Mostrar el código sería inútil para
        // quien está cargando una grilla de personal.
        message.error('Esa persona ya está asignada a esa puerta en esta fecha');
      } else {
        message.error(e?.response?.data?.message || 'No se pudo asignar');
      }
      // El modal queda abierto: cerrarlo tiraría lo que se eligió.
    }
  };

  const quitar = async (a) => {
    try {
      // El id de la ASIGNACIÓN, no el del usuario: son dos ids distintos y los
      // dos están en la fila.
      await accessApi.deleteAssignment(a.id);
      message.success('Asignación quitada');
      cargar();
    } catch (e) {
      message.error(e?.response?.data?.message || 'No se pudo quitar');
    }
  };

  if (!eventId) {
    return (
      <Card title="Personal de puerta">
        <Empty description="Elegí un evento para ver su personal de puerta" />
      </Card>
    );
  }

  if (showsListos && shows.length === 0) {
    return (
      <Card title="Personal de puerta">
        <Empty description="Este evento no tiene fechas cargadas todavía" />
      </Card>
    );
  }

  return (
    <Card
      title="Personal de puerta"
      extra={
        <Space>
          <label htmlFor="staff-fecha">Fecha</label>
          <Select
            id="staff-fecha"
            value={showId}
            style={{ minWidth: 220 }}
            onChange={setShowId}
            options={shows.map((s) => ({
              value: String(s.id),
              label: etiquetaFecha(s),
            }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!showId}
            onClick={() => setAbierto(true)}
          >
            Asignar persona
          </Button>
        </Space>
      }
    >
      <List
        loading={cargando}
        dataSource={asignaciones}
        locale={{ emptyText: 'Nadie asignado a esta fecha' }}
        renderItem={(a) => (
          <List.Item
            actions={[
              <Popconfirm
                key="q"
                title="¿Quitar a esta persona de la fecha?"
                okText="Sí"
                cancelText="No"
                onConfirm={() => quitar(a)}
              >
                <Button danger icon={<DeleteOutlined />}>Quitar</Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <strong>{a.userName}</strong>
                  {a.isSupervisor && <Tag color="blue">supervisor</Tag>}
                </Space>
              }
              description={
                a.gateId
                  ? `${a.gateCode} · ${a.gateName}`
                  : 'Cualquier puerta de esta fecha'
              }
            />
          </List.Item>
        )}
      />

      <Modal
        open={abierto}
        title="Asignar persona a la fecha"
        onCancel={() => setAbierto(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={asignar}>
          <Form.Item
            name="userId"
            label="Persona"
            rules={[{ required: true, message: 'Elegí a quién asignar' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Buscar por nombre o email"
              options={porteros.map((u) => ({
                value: String(u.id), label: `${u.name} · ${u.email}`,
              }))}
              notFoundContent="No hay usuarios con rol DOOR cargados"
            />
          </Form.Item>
          <Form.Item
            name="gateId"
            label="Puerta"
            extra="Sin elegir puerta, la persona puede escanear en cualquiera de esta fecha."
          >
            <Select
              allowClear
              placeholder="Cualquier puerta"
              options={opcionesDePuerta(gates)}
            />
          </Form.Item>
          <Form.Item name="isSupervisor" label="Supervisor" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
