import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Form, Input, List, Modal, Popconfirm, Select,
  Space, Switch, Tag, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { accessApi } from '../../../services/apiService';
import { extractArray } from '../../../utils/extractArray';

/** Con qué se dibuja un espacio que si no sería invisible. */
const MARCA_ESPACIO = '·';

/**
 * Cómo se escribe un sector en pantalla.
 *
 * El endpoint de sectores devuelve a propósito las variantes que el motor de
 * puerta considera DISTINTAS: 'Campo', 'CAMPO' y 'Campo ' son tres sectores
 * diferentes, porque `gate_rules.sector` se compara con === contra
 * `seats.sector` (ticketValidation.service.js:195) y el sector se guarda sin
 * trim ni normalizar.
 *
 * El problema es que en un <Select> pelado 'Campo' y 'Campo ' se dibujan
 * IDÉNTICAS —el HTML colapsa el espacio del borde— y quien configura la puerta
 * no tiene con qué elegir: elige una de las dos al azar y la mitad de los
 * tickets rebota en la entrada, sin ningún error que lo explique.
 *
 * Por eso el sector se muestra entre « »: los delimitadores marcan dónde
 * empieza y dónde termina el texto, y cada espacio de los bordes se dibuja como
 * '·'. Se eligió el punto medio y no el símbolo tipográfico de espacio (␣,
 * U+2423) porque ese no está en todas las fuentes y caería en un cuadrito. La
 * diferencia de mayúsculas ya se ve sola, no hace falta marcarla.
 */
export function etiquetaSector(sector) {
  const texto = String(sector ?? '');
  const [, izquierda, medio, derecha] = texto.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const marcar = (s) => MARCA_ESPACIO.repeat(s.length);
  return `«${marcar(izquierda)}${medio}${marcar(derecha)}»`;
}

/**
 * El `white-space: pre` cubre el otro caso que el HTML colapsa y « » no atrapa:
 * los espacios dobles del medio ('Campo  Norte'). El monoespaciado hace que un
 * espacio de más ocupe siempre lo mismo y se note.
 */
function SectorTexto({ value }) {
  return (
    <span style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>
      {etiquetaSector(value)}
    </span>
  );
}

/**
 * Puertas de un evento, con sus reglas de sector y de tipo de entrada.
 *
 * Los sectores y los tipos se eligen de una lista, nunca se escriben: la regla
 * se compara como texto exacto contra el sector del ticket, y este evento tiene
 * sectores como "Campo con Acceso a Cancha" y "Campo con Acceso a Cancha2".
 * Un typo no falla al guardar — deja una puerta que rechaza a todo el mundo, y
 * eso se descubre en vivo.
 */
export default function GatesCard({ eventId }) {
  const [gates, setGates] = useState([]);
  const [sectors, setSectors] = useState([]);
  // Los sectores empiezan vacíos y también quedan vacíos cuando el evento no
  // tiene asientos: sin esta bandera el aviso de "no hay sectores" se pintaría
  // mientras todavía se están pidiendo, que es decir algo que no se sabe.
  const [sectorsListos, setSectorsListos] = useState(false);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    // Sin evento no se pide nada. accessApi.listGates rechaza si no le pasan
    // eventId —antes el backend devolvía las puertas de TODOS los eventos—,
    // pero la guarda va acá igual: apoyarse en el rechazo pinta un error de
    // consola en cada render en el que todavía no se eligió el evento.
    if (!eventId) {
      setGates([]);
      return;
    }
    setLoading(true);
    try {
      const r = await accessApi.listGates(eventId);
      setGates(extractArray(r, 'gates'));
    } catch (e) {
      message.error(e?.response?.data?.message || 'No se pudieron cargar las puertas');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = async (gate) => {
    setEditando(gate || null);
    setAbierto(true);

    if (!eventId) return;
    try {
      const [s, t] = await Promise.all([
        accessApi.eventSectors(eventId),
        accessApi.ticketTypes(eventId),
      ]);
      setSectors(extractArray(s, 'sectors'));
      // GET /events/:id/ticket-types devuelve { event, ticketTypes: [] }.
      setTypes(extractArray(t, 'ticketTypes'));
      setSectorsListos(true);
    } catch (e) {
      // Si la lista no llegó, no se sabe si el evento tiene sectores o no: se
      // deja el aviso apagado y se dice lo que realmente pasó.
      setSectorsListos(false);
      message.error('No se pudieron cargar los sectores del evento');
    }
  };

  // Los campos se cargan una vez que el modal está montado. Hacerlo antes de
  // abrirlo escribe sobre un Form que todavía no existe (el Modal no renderiza
  // su contenido hasta la primera apertura) y rc-field-form avisa que la
  // instancia no está conectada a ningún Form.
  useEffect(() => {
    if (!abierto) return;
    // resetFields antes de setFieldsValue: limpia los errores de validación que
    // hayan quedado del intento anterior, que setFieldsValue no toca.
    form.resetFields();
    form.setFieldsValue(editando
      ? { code: editando.code, name: editando.name,
          sectors: editando.sectors || [], ticketTypeIds: editando.ticketTypeIds || [],
          isActive: editando.isActive }
      : { code: '', name: '', sectors: [], ticketTypeIds: [], isActive: true });
  }, [abierto, editando, form]);

  const guardar = async (values) => {
    // El payload se arma explícito y distinto para cada operación, no se reusa
    // el del formulario: los dos schemas de Joi rechazan las claves que no
    // conocen. El PUT no acepta eventId (mover una puerta de evento invalidaría
    // sus reglas y sus asignaciones) y el POST no acepta isActive. Cualquiera
    // de las dos de más es un 400 y una edición que se pierde.
    const reglas = {
      code: values.code,
      name: values.name,
      sectors: values.sectors || [],
      ticketTypeIds: values.ticketTypeIds || [],
    };
    try {
      if (editando) {
        await accessApi.updateGate(editando.id, { ...reglas, isActive: values.isActive });
        message.success('Puerta actualizada');
      } else {
        await accessApi.createGate({ ...reglas, eventId });
        message.success('Puerta creada');
      }
      setAbierto(false);
      // El PUT responde { updated: true }, no la puerta: hay que releer.
      cargar();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        message.error('Ya existe una puerta con ese código en este evento');
      } else {
        message.error(e?.response?.data?.message || 'No se pudo guardar la puerta');
      }
      // El modal queda abierto a propósito: cerrarlo tira lo que se escribió.
    }
  };

  const borrar = async (gate) => {
    try {
      const r = await accessApi.deleteGate(gate.id);
      if (r?.data?.deactivated) {
        // No es un error: es la salvaguarda del backend. Decirlo con todas las
        // letras, porque el usuario pidió borrar y la puerta va a seguir ahí.
        message.warning(`La puerta se desactivó en vez de borrarse: ${r.data.reason}`);
      } else {
        message.success('Puerta borrada');
      }
      cargar();
    } catch (e) {
      message.error(e?.response?.data?.message || 'No se pudo borrar la puerta');
    }
  };

  const describir = (g) => {
    const misSectores = g.sectors || [];
    const misTipos = g.ticketTypeIds || [];
    if (misSectores.length === 0 && misTipos.length === 0) {
      // Sin filas en gate_rules la puerta admite CUALQUIER ticket
      // (migrations/028_access_control.sql:36). Se dice, porque una puerta así
      // se ve igual de "configurada" que el resto y no lo está.
      return <Tag color="warning">Sin reglas: admite todas las entradas</Tag>;
    }
    return (
      <Space size={4} wrap>
        {misSectores.length > 0 && (
          <span>
            Sectores:{' '}
            {misSectores.map((s, i) => (
              <span key={s}>
                {i > 0 && ', '}
                <SectorTexto value={s} />
              </span>
            ))}
          </span>
        )}
        {/* Una puerta filtrada sólo por tipo NO admite todo: si esta línea no
            estuviera, se vería igual que una sin ninguna regla. */}
        {misTipos.length > 0 && <span>Tipos de entrada: {misTipos.length}</span>}
      </Space>
    );
  };

  return (
    <Card
      title="Puertas del evento"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!eventId}
          onClick={() => abrir(null)}
        >
          Nueva puerta
        </Button>
      }
    >
      {/* El loading va en la lista y no en la Card: con loading en la Card,
          antd reemplaza TODO el cuerpo por un esqueleto, y el Modal vive en el
          cuerpo — abrirlo mientras recarga no mostraría nada. */}
      <List
        loading={loading}
        dataSource={gates}
        locale={{
          emptyText: eventId
            ? 'Este evento todavía no tiene puertas'
            : 'Elegí un evento para ver sus puertas',
        }}
        renderItem={(g) => (
          <List.Item
            actions={[
              <Button key="e" icon={<EditOutlined />} onClick={() => abrir(g)}>
                Editar
              </Button>,
              <Popconfirm
                key="b"
                title="¿Borrar esta puerta?"
                okText="Sí"
                cancelText="No"
                onConfirm={() => borrar(g)}
              >
                <Button danger icon={<DeleteOutlined />}>Borrar</Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <strong>{g.code}</strong>
                  <span>{g.name}</span>
                  {!g.isActive && <Tag color="default">desactivada</Tag>}
                </Space>
              }
              description={describir(g)}
            />
          </List.Item>
        )}
      />

      <Modal
        open={abierto}
        title={editando ? 'Editar puerta' : 'Nueva puerta'}
        onCancel={() => setAbierto(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={guardar}>
          <Form.Item
            name="code"
            label="Código"
            rules={[{ required: true, message: 'La puerta necesita un código' }]}
          >
            <Input placeholder="NORTE" maxLength={32} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Nombre"
            rules={[{ required: true, message: 'La puerta necesita un nombre' }]}
          >
            <Input placeholder="Puerta Norte" maxLength={100} />
          </Form.Item>

          {sectorsListos && sectors.length === 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Este evento no tiene sectores"
              description={
                'Hay que cargar el mapa del venue y los asientos antes de poder '
                + 'restringir la puerta por sector. Mientras tanto podés dejarla '
                + 'sin reglas o restringirla por tipo de entrada.'
              }
            />
          )}

          <Form.Item
            name="sectors"
            label="Sectores que admite"
            extra={'Van entre « » y con un · por cada espacio de los bordes. '
              + 'Para la puerta, un espacio de más es otro sector distinto; sin la '
              + 'marca los dos se verían iguales y no habría forma de elegir bien.'}
          >
            <Select
              mode="multiple"
              placeholder="Elegí de la lista"
              // El filtro busca por el sector real, no por la etiqueta con « »,
              // que además es un nodo y no un string.
              optionFilterProp="value"
              options={sectors.map((s) => ({ value: s, label: <SectorTexto value={s} /> }))}
            />
          </Form.Item>

          <Form.Item
            name="ticketTypeIds"
            label="Tipos de entrada que admite"
            extra="Las entradas sin asiento (GA) no tienen sector: se filtran por tipo."
          >
            <Select
              mode="multiple"
              placeholder="Elegí de la lista"
              optionFilterProp="label"
              options={types.map((t) => ({ value: String(t.id), label: t.name }))}
            />
          </Form.Item>

          {editando && (
            <Form.Item name="isActive" label="Activa" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
