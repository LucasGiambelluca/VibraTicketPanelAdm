import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Space, 
  Button, 
  Input, 
  Select, 
  Modal, 
  Typography, 
  Row, 
  Col, 
  message, 
  Tooltip,
  Switch 
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  CodeOutlined,
  DollarOutlined,
  SyncOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { adminPaymentsApi } from '../../services/apiService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { Title, Text } = Typography;
const { Option } = Select;

export default function PaymentMonitor() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: undefined,
    orderId: '',
    paymentId: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Modal para ver JSON
  const [jsonModal, setJsonModal] = useState({ open: false, data: null });

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const response = await adminPaymentsApi.getPaymentLogs({
        page,
        limit: pagination.limit,
        ...filters
      });

      // Helper para extraer arrays (igual que en otros componentes)
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

      const data = extractArray(response, 'logs') || extractArray(response, 'paymentLogs');

      const pag = response?.pagination || response?.data?.pagination || { 
        page: 1, 
        limit: 20, 
        total: data.length 
      };

      setLogs(data);
      setPagination({
        page: pag.page,
        limit: pag.limit,
        total: pag.total
      });
    } catch (error) {
      console.error('❌ Error fetching payment logs:', error);
      // Solo mostrar error si no es 500 (para evitar spam visual si el backend falla)
      if (error.response?.status !== 500) {
        message.error('Error al cargar logs de pagos');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        // Refrescar manteniendo página y filtros actuales
        fetchLogs(pagination.page);
      }, 10000); // 10 segundos
    }
    return () => clearInterval(interval);
  }, [autoRefresh, pagination.page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchLogs(1);
  };

  const handleRefresh = () => {
    fetchLogs(pagination.page);
  };

  const handleReset = () => {
    setFilters({ status: undefined, orderId: '', paymentId: '' });
    // setTimeout para asegurar que el estado se actualice antes de buscar
    setTimeout(() => fetchLogs(1), 0);
  };

  const showJson = (data) => {
    setJsonModal({ open: true, data });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (text) => <Text type="secondary">#{text}</Text>
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => date ? format(new Date(date), 'dd MMM yyyy HH:mm', { locale: es }) : '-'
    },
    {
      title: 'Orden',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 100,
      render: (id) => <Tag color="blue">ORD-{id}</Tag>
    },
    {
      title: 'MP Payment ID',
      dataIndex: 'mp_payment_id',
      key: 'mp_payment_id',
      render: (id) => <Text copyable>{id}</Text>
    },
    {
      title: 'Usuario',
      dataIndex: 'user_email',
      key: 'user_email',
      render: (email) => <Text>{email}</Text>
    },
    {
      title: 'Monto',
      dataIndex: 'transaction_amount',
      key: 'transaction_amount',
      render: (amount) => (
        <Text strong>
          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)}
        </Text>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        let color = 'default';
        if (status === 'approved') color = 'success';
        if (status === 'pending') color = 'warning';
        if (status === 'rejected') color = 'error';
        
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color}>{status?.toUpperCase()}</Tag>
            {record.status_detail && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.status_detail}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Button 
          icon={<CodeOutlined />} 
          size="small" 
          onClick={() => showJson(record.webhook_data)}
        >
          JSON
        </Button>
      )
    }
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: '#fff' }}>
          <DollarOutlined style={{ marginRight: 12, color: '#667eea' }} />
          Monitor de Pagos
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
          Historial de notificaciones de MercadoPago
        </Text>
      </div>

      <Card className="glass-card" bordered={false} style={{ borderRadius: 16, marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={6}>
            <Select
              placeholder="Estado"
              style={{ width: '100%' }}
              allowClear
              value={filters.status}
              onChange={(val) => handleFilterChange('status', val)}
            >
              <Option value="approved">Aprobado (approved)</Option>
              <Option value="pending">Pendiente (pending)</Option>
              <Option value="rejected">Rechazado (rejected)</Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Input 
              placeholder="ID Orden" 
              value={filters.orderId}
              onChange={(e) => handleFilterChange('orderId', e.target.value)}
              prefix="#"
            />
          </Col>
          <Col xs={24} md={6}>
            <Input 
              placeholder="ID Pago MP" 
              value={filters.paymentId}
              onChange={(e) => handleFilterChange('paymentId', e.target.value)}
            />
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                Buscar
              </Button>
              <Button icon={<SyncOutlined spin={loading} />} onClick={handleRefresh}>
                Actualizar
              </Button>
              <Button icon={<ClearOutlined />} onClick={handleReset}>
                Limpiar
              </Button>
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                <Switch 
                  checked={autoRefresh} 
                  onChange={setAutoRefresh} 
                  checkedChildren="Auto" 
                  unCheckedChildren="Off"
                />
                <Text style={{ marginLeft: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  Auto-refresh (10s)
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="glass-card" bordered={false} style={{ borderRadius: 16 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page) => fetchLogs(page),
            showTotal: (total) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>Total {total} logs</span>,
            className: 'glass-pagination'
          }}
          className="glass-table"
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title="Webhook Data (JSON)"
        open={jsonModal.open}
        onCancel={() => setJsonModal({ open: false, data: null })}
        footer={[
          <Button key="close" onClick={() => setJsonModal({ open: false, data: null })}>
            Cerrar
          </Button>
        ]}
        width={600}
        className="glass-modal"
      >
        <div style={{ 
          background: '#1e1e1e', 
          color: '#d4d4d4', 
          padding: 16, 
          borderRadius: 8, 
          maxHeight: 400, 
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 12
        }}>
          <pre style={{ margin: 0 }}>
            {jsonModal.data ? JSON.stringify(jsonModal.data, null, 2) : 'No data'}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
