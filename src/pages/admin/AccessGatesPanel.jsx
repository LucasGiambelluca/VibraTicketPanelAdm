import { useEffect, useState } from 'react';
import { Card, Select, Space, Typography, message } from 'antd';
import { eventsApi } from '../../services/apiService';
import { extractArray } from '../../utils/extractArray';
import GatesCard from './access/GatesCard';
import StaffCard from './access/StaffCard';

const { Title, Text } = Typography;

/**
 * Puertas y personal de un evento.
 *
 * Elegís el evento una sola vez y hacés las dos cosas acá: es el flujo real de
 * cargar un evento nuevo. Las dos tarjetas son independientes entre sí y sólo
 * comparten el evento elegido.
 *
 * Hasta esta pantalla, definir una puerta y asignar personal se hacía con
 * INSERT a mano o con curl.
 */
export default function AccessGatesPanel() {
  const [eventos, setEventos] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await eventsApi.getEvents({ limit: 100 });
        setEventos(extractArray(r, 'events'));
      } catch (e) {
        message.error('No se pudieron cargar los eventos');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>Puertas y personal</Title>
          <Text type="secondary">
            Las puertas son del evento; el personal se asigna por fecha.
          </Text>
          <Select
            showSearch
            optionFilterProp="label"
            loading={cargando}
            style={{ minWidth: 320 }}
            placeholder="Elegí un evento"
            value={eventId}
            onChange={setEventId}
            options={eventos.map((e) => ({ value: String(e.id), label: e.name }))}
          />
        </Space>
      </Card>

      {/* Las tarjetas se montan recién con un evento elegido: sin id no tienen
          nada que pedir, y montarlas antes sólo dispara llamadas que fallan. */}
      {eventId && (
        <>
          <GatesCard eventId={eventId} />
          <StaffCard eventId={eventId} />
        </>
      )}
    </Space>
  );
}
