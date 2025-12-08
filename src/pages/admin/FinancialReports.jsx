import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Typography, 
  Card, 
  Row, 
  Col, 
  DatePicker, 
  Select, 
  Button, 
  Table, 
  Statistic, 
  Space, 
  message,
  Spin
} from 'antd';
import { 
  DollarOutlined, 
  ShoppingOutlined, 
  TagsOutlined, 
  FileTextOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { reportsApi, eventsApi } from '../../services/apiService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default function FinancialReports() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [events, setEvents] = useState([]);
  
  // Filtros
  const [filters, setFilters] = useState({
    dateRange: null,
    eventId: null
  });

  useEffect(() => {
    fetchEvents();
    fetchReport();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await eventsApi.getEvents({ limit: 100 });
      
      // Helper para extraer  arrays
      const extractArray = (res, key) => {
        const payload = res.data || res;
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload[key])) return payload[key];
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.rows)) return payload.rows;
        if (payload.data && typeof payload.data === 'object') {
          if (Array.isArray(payload.data[key])) return payload.data[key];
          if (Array.isArray(payload.data.rows)) return payload.data.rows;
        }
        return [];
      };

      const eventsData = extractArray(response, 'events');
      setEvents(eventsData);
    } catch (error) {
      console.error('❌ Error fetching events:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      
      if (filters.dateRange) {
        params.dateFrom = filters.dateRange[0].toISOString();
        params.dateTo = filters.dateRange[1].toISOString();
      }
      
      if (filters.eventId) {
        params.eventId = filters.eventId;
      }

      const response = await reportsApi.getFinancialReport(params);
      
      // Extraer datos del response
      const data = response?.data?.data || response?.data || response || {};
      
      // Verificar que tenga datos
      if (data.summary || data.byEvent) {
        setReportData(data);
      } else {
        console.warn('No financial data in response');
        setReportData(null);
      }
    } catch (error) {
      console.error('❌ Error fetching report:', error);
      
      if (error.response?.status !== 401) {
        message.error('Error al cargar el reporte financiero');
      }
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchReport();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(parseFloat(value || 0));
  };

  // Columnas para la tabla de desglose por evento
  const columns = [
    {
      title: 'Evento',
      dataIndex: 'eventName',
      key: 'eventName',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Órdenes',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      align: 'center'
    },
    {
      title: 'Tickets',
      dataIndex: 'ticketsSold',
      key: 'ticketsSold',
      align: 'center'
    },
    {
      title: 'Ventas Brutas',
      dataIndex: 'grossSales',
      key: 'grossSales',
      align: 'right',
      render: (val) => formatCurrency(val)
    },
    {
      title: 'Descuentos',
      dataIndex: 'totalDiscounts',
      key: 'totalDiscounts',
      align: 'right',
      render: (val) => <Text type="danger">-{formatCurrency(val)}</Text>
    },
    {
      title: 'Ventas Netas',
      dataIndex: 'netSales',
      key: 'netSales',
      align: 'right',
      render: (val) => <Text strong style={{ color: '#667eea' }}>{formatCurrency(val)}</Text>
    },
    {
      title: 'Service Charge (Est.)',
      dataIndex: 'estimatedServiceCharges',
      key: 'estimatedServiceCharges',
      align: 'right',
      render: (val) => formatCurrency(val)
    },
    {
      title: 'Total Recaudado',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      align: 'right',
      render: (val) => <Text strong type="success">{formatCurrency(val)}</Text>
    }
  ];

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0 }} className="mobile-compact-title">
          <DollarOutlined style={{ marginRight: 12, color: '#667eea' }} />
          Reportes Financieros
        </Title>
        <Text type="secondary">Resumen de ventas, recaudación y métricas financieras</Text>
      </div>

      {/* Filtros */}
      <Card className="glass-card mobile-compact-card" style={{ marginBottom: 32, borderRadius: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Rango de Fechas</Text>
            <RangePicker 
              style={{ width: '100%' }} 
              size="large"
              onChange={(dates) => handleFilterChange('dateRange', dates)}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Filtrar por Evento</Text>
            <Select
              style={{ width: '100%' }}
              size="large"
              placeholder="Todos los eventos"
              allowClear
              showSearch
              optionFilterProp="children"
              onChange={(val) => handleFilterChange('eventId', val)}
            >
              {events.map(event => (
                <Option key={event.id} value={event.id}>{event.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={8} style={{ display: 'flex', alignItems: 'flex-end' }} className="mobile-actions-row">
            <Button 
              type="primary" 
              icon={<FilterOutlined />} 
              size="large" 
              onClick={handleApplyFilters}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                marginRight: 12
              }}
            >
              Aplicar Filtros
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              size="large" 
              onClick={fetchReport}
            >
              Actualizar
            </Button>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Cargando datos financieros...</div>
        </div>
      ) : reportData ? (
        <>
          {/* Tarjetas de Resumen */}
          <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="glass-card" style={{ height: '100%', borderRadius: 16 }}>
                <Statistic
                  title={<Text type="secondary">Ventas Brutas</Text>}
                  value={reportData.summary.grossSales}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total antes de descuentos</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="glass-card" style={{ height: '100%', borderRadius: 16 }}>
                <Statistic
                  title={<Text type="secondary">Descuentos Aplicados</Text>}
                  value={reportData.summary.totalDiscounts}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Ahorro total de usuarios</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="glass-card" style={{ height: '100%', borderRadius: 16 }}>
                <Statistic
                  title={<Text type="secondary">Ventas Netas</Text>}
                  value={reportData.summary.netSales}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Ingresos por tickets</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="glass-card" style={{ height: '100%', borderRadius: 16 }}>
                <Statistic
                  title={<Text type="secondary">Total Recaudado</Text>}
                  value={reportData.summary.totalCollected}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Incluye Service Charge</Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" className="glass-card" style={{ borderRadius: 12 }}>
                <Statistic 
                  title="Órdenes Totales" 
                  value={reportData.summary.ordersCount} 
                  prefix={<ShoppingOutlined />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" className="glass-card" style={{ borderRadius: 12 }}>
                <Statistic 
                  title="Tickets Vendidos" 
                  value={reportData.summary.ticketsSold} 
                  prefix={<TagsOutlined />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" className="glass-card" style={{ borderRadius: 12 }}>
                <Statistic 
                  title="Service Charges (Est.)" 
                  value={reportData.summary.estimatedServiceCharges} 
                  precision={2}
                  prefix="$"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" className="glass-card" style={{ borderRadius: 12 }}>
                <Statistic 
                  title="Fees Mantenimiento (Est.)" 
                  value={reportData.summary.estimatedMaintenanceFees} 
                  precision={2}
                  prefix="$"
                />
              </Card>
            </Col>
          </Row>

          {/* Tabla de Desglose */}
          <Card 
            title={<><FileTextOutlined /> Desglose por Evento</>} 
            className="glass-card" 
            style={{ borderRadius: 16 }}
          >
            <Table 
              dataSource={reportData.byEvent} 
              columns={columns} 
              rowKey="eventId"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              size="small"
            />
          </Card>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          No hay datos para mostrar. Selecciona filtros y haz clic en "Aplicar Filtros".
        </div>
      )}
    </div>
  );
}
