import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Select, Button, Tag, Space, Typography, Input, InputNumber, Radio,
  message, Alert, List, Divider, Row, Col, Spin,
} from 'antd';
import { PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../../api/client';
import { boxofficeApi } from '../../services/apiService';
import { agentStatus, agentPrint, agentTestTicket, getAgentUrl, setAgentUrl } from '../../services/printAgentService';

const { Title, Text } = Typography;

export default function BoxOffice() {
  const [agent, setAgent] = useState({ checking: true, ok: false, printerReachable: false });
  const refreshAgent = async () => {
    setAgent(a => ({ ...a, checking: true }));
    try {
      const st = await agentStatus();
      setAgent({ checking: false, ok: true, printerReachable: st.printerReachable });
    } catch {
      setAgent({ checking: false, ok: false, printerReachable: false });
    }
  };
  useEffect(() => { refreshAgent(); }, []);

  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [mode, setMode] = useState('seats');
  const [seats, setSeats] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [gaQty, setGaQty] = useState({});
  const [loadingSeats, setLoadingSeats] = useState(false);

  // listShows devuelve un array plano: [{id, event_id, starts_at, status, eventName, ...}]
  useEffect(() => {
    apiClient.get('/shows').then(r => {
      const data = r.data;
      // El endpoint devuelve array plano directamente
      setShows(Array.isArray(data) ? data : (data.shows || data || []));
    }).catch(() => message.error('No se pudieron cargar los shows'));
  }, []);

  const loadShowData = async (show) => {
    setSelectedShow(show);
    setSelectedSeats([]);
    setGaQty({});
    setLoadingSeats(true);
    try {
      const [seatsRes, typesRes] = await Promise.allSettled([
        apiClient.get(`/shows/${show.id}/seats`),
        apiClient.get(`/events/${show.event_id}/ticket-types`),
      ]);
      // listSeats devuelve {showId, seats:[{id,sector,rowLabel,seatNumber,status,priceCents,...}]}
      const seatsData = seatsRes.status === 'fulfilled' ? seatsRes.value.data : null;
      setSeats(seatsData ? (seatsData.seats || []) : []);
      // getTicketTypes devuelve {event, ticketTypes:[{id,name,price_cents,...}]}
      const typesData = typesRes.status === 'fulfilled' ? typesRes.value.data : null;
      setTicketTypes(typesData ? (typesData.ticketTypes || []) : []);
    } finally {
      setLoadingSeats(false);
    }
  };

  // Seats usan campos camelCase: rowLabel, seatNumber, priceCents
  const seatsBySector = useMemo(() => {
    const map = {};
    for (const s of seats) (map[s.sector] = map[s.sector] || []).push(s);
    return map;
  }, [seats]);

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return;
    setSelectedSeats(prev =>
      prev.includes(seat.id) ? prev.filter(i => i !== seat.id) : [...prev, seat.id]
    );
  };

  const [customer, setCustomer] = useState({ name: '', dni: '', email: '' });
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // priceCents es el campo de asientos; price_cents es el de ticket types
  // Si no hay priceCents en los asientos mostramos "al confirmar"
  const seatsHavePrice = seats.some(s => s.priceCents != null && s.priceCents !== 0);

  const totalCents = useMemo(() => {
    if (mode === 'seats') {
      if (!seatsHavePrice) return null; // sin precio en asientos
      return seats
        .filter(s => selectedSeats.includes(s.id))
        .reduce((sum, s) => sum + Number(s.priceCents || 0), 0);
    }
    return ticketTypes.reduce(
      (sum, t) => sum + Number(t.price_cents || 0) * (gaQty[t.id] || 0),
      0
    );
  }, [mode, seats, selectedSeats, ticketTypes, gaQty, seatsHavePrice]);

  const [selling, setSelling] = useState(false);
  const [printQueue, setPrintQueue] = useState([]);

  const printTicket = async (ticket) => {
    setPrintQueue(q =>
      q.map(t => t.id === ticket.id && t.kind === ticket.kind ? { ...t, status: 'pending' } : t)
    );
    try {
      const { data } = await boxofficeApi.getTicketFgl(ticket.kind, ticket.id);
      await agentPrint(data.fgl);
      await boxofficeApi.logPrint({
        ticketKind: ticket.kind,
        ticketId: ticket.id,
        orderId: ticket.orderId || null,
        status: 'OK',
        printerName: getAgentUrl(),
      });
      setPrintQueue(q =>
        q.map(t => t.id === ticket.id && t.kind === ticket.kind ? { ...t, status: 'ok' } : t)
      );
    } catch (e) {
      await boxofficeApi.logPrint({
        ticketKind: ticket.kind,
        ticketId: ticket.id,
        orderId: ticket.orderId || null,
        status: 'FAILED',
        errorDetail: String(e.message).slice(0, 400),
      }).catch(() => {});
      setPrintQueue(q =>
        q.map(t =>
          t.id === ticket.id && t.kind === ticket.kind ? { ...t, status: 'failed', error: e.message } : t
        )
      );
    }
  };

  const confirmSale = async () => {
    setSelling(true);
    try {
      const payload = mode === 'seats'
        ? { showId: selectedShow.id, seatIds: selectedSeats, paymentMethod, customer }
        : {
            eventId: selectedShow.event_id,
            items: Object.entries(gaQty)
              .filter(([, q]) => q > 0)
              .map(([id, q]) => ({ ticketTypeId: Number(id), quantity: q })),
            paymentMethod,
            customer,
          };
      const { data } = await boxofficeApi.createOrder(payload);
      const totalDisplay = (Number(data.totalCents) / 100).toLocaleString('es-AR');
      message.success(
        `Venta registrada${data.orderId ? ` (orden #${data.orderId})` : ''} — $${totalDisplay}`
      );
      const queue = data.tickets.map((t, i) => ({
        ...t,
        orderId: data.orderId || null,
        label: `Ticket ${i + 1}`,
        status: 'pending',
      }));
      setPrintQueue(queue);
      if (mode === 'seats') loadShowData(selectedShow);
      setSelectedSeats([]);
      setGaQty({});
      for (const t of queue) await printTicket(t);
    } catch (e) {
      const detail = e.response?.data;
      if (detail?.error === 'SeatsTaken') {
        message.error('Asientos ya vendidos — refrescando mapa');
        loadShowData(selectedShow);
      } else {
        message.error(detail?.message || 'Error registrando la venta');
      }
    } finally {
      setSelling(false);
    }
  };

  const canSell =
    selectedShow &&
    !selling &&
    (mode === 'seats'
      ? selectedSeats.length > 0
      : Object.values(gaQty).some(q => q > 0));

  return (
    <div>
      <Title level={3}>Boletería</Title>

      {!agent.ok && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Agente de impresión no disponible"
          description={
            <Space direction="vertical">
              <Text>La venta se puede hacer igual; los tickets quedan en el sistema para reimprimir.</Text>
              <Space>
                <Input
                  size="small"
                  style={{ width: 260 }}
                  defaultValue={getAgentUrl()}
                  onBlur={e => setAgentUrl(e.target.value)}
                  addonBefore="URL agente"
                />
                <Button size="small" icon={<ReloadOutlined />} onClick={refreshAgent}>
                  Reintentar
                </Button>
              </Space>
            </Space>
          }
        />
      )}
      {agent.ok && !agent.printerReachable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Agente OK pero impresora inaccesible (apagada / sin red / sin papel?)"
          action={
            <Button size="small" onClick={refreshAgent}>
              Reintentar
            </Button>
          }
        />
      )}
      {agent.ok && agent.printerReachable && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Impresora lista"
          action={
            <Button
              size="small"
              onClick={() =>
                agentTestTicket()
                  .then(() => message.success('Ticket de prueba enviado'))
                  .catch(e => message.error(e.message))
              }
            >
              Imprimir prueba
            </Button>
          }
        />
      )}

      <Card title="1. Funcion" style={{ marginBottom: 16 }}>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Seleccionar show"
          optionFilterProp="label"
          options={shows.map(s => ({
            value: s.id,
            // eventName es el campo del JOIN en listShows
            label: `${s.eventName || `Evento ${s.event_id}`} — ${new Date(s.starts_at).toLocaleString('es-AR')}`,
            show: s,
          }))}
          onChange={(_, opt) => loadShowData(opt.show)}
        />
      </Card>

      {selectedShow && (
        <Card
          title="2. Entradas"
          extra={
            <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
              <Radio.Button value="seats">Asientos</Radio.Button>
              <Radio.Button value="ga">Entrada general</Radio.Button>
            </Radio.Group>
          }
          style={{ marginBottom: 16 }}
        >
          {loadingSeats ? (
            <Spin />
          ) : mode === 'seats' ? (
            Object.keys(seatsBySector).length === 0 ? (
              <Text type="secondary">Este show no tiene asientos numerados.</Text>
            ) : (
              Object.entries(seatsBySector).map(([sector, sectorSeats]) => (
                <div key={sector} style={{ marginBottom: 12 }}>
                  <Divider orientation="left" plain>
                    Sector {sector}
                  </Divider>
                  <Space wrap size={[4, 4]}>
                    {sectorSeats.map(seat => (
                      <Tag.CheckableTag
                        key={seat.id}
                        checked={selectedSeats.includes(seat.id)}
                        onChange={() => toggleSeat(seat)}
                        style={{
                          border: '1px solid #d9d9d9',
                          userSelect: 'none',
                          opacity: seat.status === 'AVAILABLE' ? 1 : 0.3,
                          cursor: seat.status === 'AVAILABLE' ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {/* Campos camelCase: rowLabel, seatNumber */}
                        {seat.rowLabel}-{seat.seatNumber}
                      </Tag.CheckableTag>
                    ))}
                  </Space>
                </div>
              ))
            )
          ) : (
            <List
              dataSource={ticketTypes}
              locale={{ emptyText: 'Este evento no tiene tipos de entrada general' }}
              renderItem={t => (
                <List.Item
                  actions={[
                    <InputNumber
                      key="q"
                      min={0}
                      max={20}
                      value={gaQty[t.id] || 0}
                      onChange={v => setGaQty(q => ({ ...q, [t.id]: v || 0 }))}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={t.name}
                    description={`$${(Number(t.price_cents) / 100).toLocaleString('es-AR')}`}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      {selectedShow && (
        <Card title="3. Cliente y pago" style={{ marginBottom: 16 }}>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Input
                placeholder="Nombre (opcional)"
                value={customer.name}
                onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
              />
            </Col>
            <Col xs={24} md={8}>
              <Input
                placeholder="DNI (opcional)"
                value={customer.dni}
                onChange={e => setCustomer(c => ({ ...c, dni: e.target.value }))}
              />
            </Col>
            <Col xs={24} md={8}>
              <Input
                placeholder="Email (opcional, manda tickets digitales)"
                value={customer.email}
                onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
              />
            </Col>
          </Row>
          <Divider />
          <Space size="large" wrap>
            <Radio.Group value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <Radio.Button value="CASH">Efectivo</Radio.Button>
              <Radio.Button value="CARD_EXTERNAL">Tarjeta (posnet)</Radio.Button>
            </Radio.Group>
            <Title level={4} style={{ margin: 0 }}>
              Total:{' '}
              {totalCents === null
                ? 'al confirmar'
                : `$${(totalCents / 100).toLocaleString('es-AR')}`}
            </Title>
            <Button
              type="primary"
              size="large"
              icon={<PrinterOutlined />}
              disabled={!canSell}
              loading={selling}
              onClick={confirmSale}
            >
              Cobrar e imprimir
            </Button>
          </Space>
        </Card>
      )}

      {printQueue.length > 0 && (
        <Card title="Impresion">
          <List
            dataSource={printQueue}
            renderItem={t => (
              <List.Item
                actions={
                  t.status === 'failed'
                    ? [
                        <Button key="r" size="small" onClick={() => printTicket(t)}>
                          Reintentar
                        </Button>,
                      ]
                    : []
                }
              >
                <Space>
                  {t.status === 'ok' && <CheckCircleOutlined style={{ color: 'green' }} />}
                  {t.status === 'failed' && <CloseCircleOutlined style={{ color: 'red' }} />}
                  {t.status === 'pending' && <Spin size="small" />}
                  <Text>
                    {t.label} ({t.kind} #{t.id})
                  </Text>
                  {t.error && <Text type="danger">{t.error}</Text>}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
