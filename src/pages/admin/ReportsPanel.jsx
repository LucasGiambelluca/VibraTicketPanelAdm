import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, DatePicker, Select, Button, Space, Typography, Spin, message, Tabs, Tag, Progress } from 'antd';
import { 
  DollarOutlined, 
  ShoppingOutlined, 
  UserOutlined, 
  CalendarOutlined,
  TrophyOutlined,
  RiseOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { reportsApi } from '../../services/apiService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

export default function ReportsPanel() {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventReport, setEventReport] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [period, setPeriod] = useState('daily');

  // Cargar dashboard general
  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.getEventsReport();

      // Helper para extraer objetos de datos
      const extractData = (res) => {
        return res?.data?.data || res?.data || res || {};
      };

      const data = extractData(response);
      
      // Asegurar que la respuesta tenga la estructura correcta
      const formattedData = {
        summary: data.summary || {
          totalEvents: 0,
          totalShows: 0,
          totalTicketsSold: 0,
          totalRevenue: 0,
          totalCustomers: 0
        },
        events: Array.isArray(data.events) ? data.events : []
      };
      
      setDashboardData(formattedData);
    } catch (error) {
      console.error('❌ Error al cargar dashboard:', error);
      
      // No mostrar mensaje si es 401, el interceptor lo maneja
      if (error.response?.status !== 401) {
        message.error('Error al cargar el dashboard.');
      }
      
      // Establecer datos vacíos en caso de error
      setDashboardData({
        summary: {
          totalEvents: 0,
          totalShows: 0,
          totalTicketsSold: 0,
          totalRevenue: 0,
          totalCustomers: 0
        },
        events: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar reporte de ventas
  const loadSalesReport = async () => {
    try {
      setLoading(true);
      const params = {
        period,
        ...(dateRange && {
          dateFrom: dateRange[0].format('YYYY-MM-DD'),
          dateTo: dateRange[1].format('YYYY-MM-DD')
        }),
        ...(selectedEvent && { eventId: selectedEvent })
      };
      
      const response = await reportsApi.getSalesReport(params);

      // Extraer datos
      const data = response?.data?.data || response?.data || response || {};
      
      // Formatear datos
      const formattedSales = {
        summary: data.summary || {
          totalTransactions: 0,
          totalTickets: 0,
          totalRevenue: 0,
          averageTransactionValue: 0
        },
        data: data.data || []
      };
      
      setSalesData(formattedSales);
    } catch (error) {
      console.error('❌ Error al cargar ventas:', error);
      
      if (error.response?.status !== 401) {
        message.error('Error al cargar reporte de ventas.');
      }
      setSalesData(null);
    } finally {
      setLoading(false);
    }
  };

  // Cargar reporte de evento específico
  const loadEventReport = async (eventId) => {
    try {
      setLoading(true);
      const response = await reportsApi.getEventReport(eventId);

      // Extraer datos
      const data = response?.data?.data || response?.data || response || {};
      
      // Formatear datos del evento
      const formattedReport = {
        event: data.event || {},
        summary: data.summary || {
          totalTicketsAvailable: 0,
          totalTicketsSold: 0,
          totalTicketsReserved: 0,
          ticketsRemaining: 0,
          totalRevenue: 0,
          occupancyRate: 0,
          uniqueCustomers: 0
        },
        pricing: data.pricing || null,
        topBuyers: Array.isArray(data.topBuyers) ? data.topBuyers : []
      };
      
      setEventReport(formattedReport);
    } catch (error) {
      console.error('❌ Error al cargar reporte de evento:', error);
      
      if (error.response?.status !== 401) {
        message.error('Error al cargar reporte del evento.');
      }
      setEventReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadEventReport(selectedEvent);
    }
  }, [selectedEvent]);

  // Columnas para tabla de eventos
  const eventsColumns = [
    {
      title: 'Evento',
      dataIndex: 'eventName',
      key: 'eventName',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Shows',
      dataIndex: 'showsCount',
      key: 'showsCount',
      align: 'center',
      render: (count) => <Tag color="blue">{count}</Tag>
    },
    {
      title: 'Tickets Vendidos',
      dataIndex: 'ticketsSold',
      key: 'ticketsSold',
      align: 'center',
      render: (sold) => <Text strong style={{ color: '#52c41a' }}>{sold}</Text>
    },
    {
      title: 'Ingresos',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      render: (revenue) => (
        <Text strong style={{ color: '#1890ff' }}>
          ${(revenue / 100).toLocaleString('es-AR')}
        </Text>
      )
    },
    {
      title: 'Ocupación',
      dataIndex: 'occupancyRate',
      key: 'occupancyRate',
      align: 'center',
      render: (rate) => (
        <Progress 
          percent={parseFloat(rate)} 
          size="small" 
          status={rate > 80 ? 'success' : rate > 50 ? 'normal' : 'exception'}
        />
      )
    },
    {
      title: 'Clientes',
      dataIndex: 'uniqueCustomers',
      key: 'uniqueCustomers',
      align: 'center'
    }
  ];

  // Columnas para top compradores
  const topBuyersColumns = [
    {
      title: 'Posición',
      key: 'position',
      width: 80,
      render: (_, __, index) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}>
          #{index + 1}
        </Tag>
      )
    },
    {
      title: 'Cliente',
      dataIndex: 'customerEmail',
      key: 'customerEmail'
    },
    {
      title: 'Tickets Comprados',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      align: 'center',
      render: (count) => <Tag color="blue">{count}</Tag>
    },
    {
      title: 'Total Gastado',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${(amount / 100).toLocaleString('es-AR')}
        </Text>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <BarChartOutlined /> Reportes y Análisis
        </Title>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadDashboard}
          loading={loading}
        >
          Actualizar
        </Button>
      </div>

      <Tabs defaultActiveKey="dashboard">
        {/* TAB 1: Dashboard General */}
        <TabPane 
          tab={<span><LineChartOutlined /> Dashboard General</span>} 
          key="dashboard"
        >
          {loading && !dashboardData ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
            </div>
          ) : dashboardData ? (
            <>
              {/* KPIs Principales */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Total Eventos"
                      value={dashboardData.summary?.totalEvents || 0}
                      prefix={<CalendarOutlined />}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Total Shows"
                      value={dashboardData.summary?.totalShows || 0}
                      prefix={<CalendarOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Tickets Vendidos"
                      value={dashboardData.summary?.totalTicketsSold || 0}
                      prefix={<ShoppingOutlined />}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Ingresos Totales"
                      value={(dashboardData.summary?.totalRevenue || 0) / 100}
                      prefix={<DollarOutlined />}
                      precision={2}
                      valueStyle={{ color: '#faad14' }}
                      suffix="ARS"
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Clientes Únicos"
                      value={dashboardData.summary?.totalCustomers || 0}
                      prefix={<UserOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Tabla de Eventos */}
              <Card title="Rendimiento por Evento" style={{ marginBottom: 24 }}>
                <Table
                  columns={eventsColumns}
                  dataSource={dashboardData.events || []}
                  rowKey="eventId"
                  pagination={{ pageSize: 10 }}
                  loading={loading}
                />
              </Card>
            </>
          ) : (
            <Card>
              <Text type="secondary">No hay datos disponibles</Text>
            </Card>
          )}
        </TabPane>

        {/* TAB 2: Reporte de Evento Específico */}
        <TabPane 
          tab={<span><TrophyOutlined /> Reporte por Evento</span>} 
          key="event"
        >
          <Card style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>Seleccionar Evento:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Selecciona un evento"
                  onChange={setSelectedEvent}
                  value={selectedEvent}
                  loading={loading}
                >
                  {dashboardData?.events?.map(event => (
                    <Option key={event.eventId} value={event.eventId}>
                      {event.eventName}
                    </Option>
                  ))}
                </Select>
              </div>

              {eventReport && (
                <>
                  {/* Información del Evento */}
                  <Card title="Información del Evento" size="small">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Text type="secondary">Nombre:</Text>
                        <br />
                        <Text strong>{eventReport.event?.name}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Venue:</Text>
                        <br />
                        <Text strong>{eventReport.event?.venue_name || 'N/A'}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Total Shows:</Text>
                        <br />
                        <Tag color="blue">{eventReport.event?.shows?.count || 0}</Tag>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Período:</Text>
                        <br />
                        <Text>
                          {eventReport.event?.shows?.firstShow && 
                            format(new Date(eventReport.event.shows.firstShow), 'dd/MM/yyyy', { locale: es })}
                          {' - '}
                          {eventReport.event?.shows?.lastShow && 
                            format(new Date(eventReport.event.shows.lastShow), 'dd/MM/yyyy', { locale: es })}
                        </Text>
                      </Col>
                    </Row>
                  </Card>

                  {/* Métricas del Evento */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Tickets Disponibles"
                          value={eventReport.summary?.totalTicketsAvailable || 0}
                          prefix={<ShoppingOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Tickets Vendidos"
                          value={eventReport.summary?.totalTicketsSold || 0}
                          valueStyle={{ color: '#52c41a' }}
                          prefix={<ShoppingOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Tickets Reservados"
                          value={eventReport.summary?.totalTicketsReserved || 0}
                          valueStyle={{ color: '#faad14' }}
                          prefix={<ShoppingOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Ingresos Totales"
                          value={(eventReport.summary?.totalRevenue || 0) / 100}
                          precision={2}
                          prefix={<DollarOutlined />}
                          valueStyle={{ color: '#1890ff' }}
                          suffix="ARS"
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Tasa de Ocupación"
                          value={eventReport.summary?.occupancyRate || 0}
                          precision={2}
                          suffix="%"
                          valueStyle={{ 
                            color: eventReport.summary?.occupancyRate > 80 ? '#52c41a' : 
                                   eventReport.summary?.occupancyRate > 50 ? '#faad14' : '#cf1322'
                          }}
                          prefix={<RiseOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Card>
                        <Statistic
                          title="Clientes Únicos"
                          value={eventReport.summary?.uniqueCustomers || 0}
                          prefix={<UserOutlined />}
                          valueStyle={{ color: '#722ed1' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* Análisis de Precios */}
                  {eventReport.pricing && (
                    <Card title="Análisis de Precios" size="small">
                      <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <Statistic
                            title="Precio Promedio"
                            value={(eventReport.pricing.averagePrice || 0) / 100}
                            precision={2}
                            prefix="$"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Precio Mínimo"
                            value={(eventReport.pricing.minPrice || 0) / 100}
                            precision={2}
                            prefix="$"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Precio Máximo"
                            value={(eventReport.pricing.maxPrice || 0) / 100}
                            precision={2}
                            prefix="$"
                          />
                        </Col>
                      </Row>
                    </Card>
                  )}

                  {/* Top 10 Compradores */}
                  {eventReport.topBuyers && eventReport.topBuyers.length > 0 && (
                    <Card title="Top 10 Compradores">
                      <Table
                        columns={topBuyersColumns}
                        dataSource={eventReport.topBuyers}
                        rowKey="customerEmail"
                        pagination={false}
                      />
                    </Card>
                  )}
                </>
              )}
            </Space>
          </Card>
        </TabPane>

        {/* TAB 3: Ventas por Período */}
        <TabPane 
          tab={<span><DollarOutlined /> Ventas por Período</span>} 
          key="sales"
        >
          <Card style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Text strong>Período:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    value={period}
                    onChange={setPeriod}
                  >
                    <Option value="hourly">Por Hora</Option>
                    <Option value="daily">Por Día</Option>
                    <Option value="weekly">Por Semana</Option>
                    <Option value="monthly">Por Mes</Option>
                  </Select>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Rango de Fechas:</Text>
                  <RangePicker
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={setDateRange}
                    format="DD/MM/YYYY"
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Evento (opcional):</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Todos los eventos"
                    onChange={setSelectedEvent}
                    value={selectedEvent}
                    allowClear
                  >
                    {dashboardData?.events?.map(event => (
                      <Option key={event.eventId} value={event.eventId}>
                        {event.eventName}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
              <Button 
                type="primary" 
                icon={<BarChartOutlined />}
                onClick={loadSalesReport}
                loading={loading}
              >
                Generar Reporte
              </Button>

              {salesData && (
                <Card title="Resultados">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Transacciones"
                        value={salesData.summary?.totalTransactions || 0}
                        prefix={<ShoppingOutlined />}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Tickets Vendidos"
                        value={salesData.summary?.totalTickets || 0}
                        prefix={<ShoppingOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Ingresos"
                        value={(salesData.summary?.totalRevenue || 0) / 100}
                        precision={2}
                        prefix={<DollarOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                        suffix="ARS"
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Ticket Promedio"
                        value={(salesData.summary?.averageTransactionValue || 0) / 100}
                        precision={2}
                        prefix="$"
                      />
                    </Col>
                  </Row>
                </Card>
              )}
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
