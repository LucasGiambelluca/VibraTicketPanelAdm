import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  message, 
  Tag, 
  Space, 
  Modal, 
  Typography,
  Tooltip,
  Spin,
  Empty,
  Statistic,
  Row,
  Col
} from 'antd';
import { 
  DeleteOutlined, 
  ReloadOutlined, 
  ExclamationCircleOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { manageOrdersApi } from '../../services/apiService';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import MobileCardItem from '../../components/MobileCardItem';

dayjs.extend(relativeTime);
dayjs.locale('es');

const { Title, Text } = Typography;
const { confirm } = Modal;

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  // Cargar órdenes pendientes al montar el componente
  useEffect(() => {
    loadPendingOrders();
  }, []);

  // Función para cargar órdenes pendientes
  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      
      // El interceptor de Axios maneja automáticamente la autenticación
      
      const response = await manageOrdersApi.getPendingOrders();

      // Helper para extraer arrays (igual que en users/banners/events)
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

      const ordersData = extractArray(response, 'pendingOrders');
      setOrders(ordersData);
      
      if (ordersData.length === 0) {
        message.info('No hay órdenes pendientes en este momento');
      } else {
        message.success(`Se cargaron ${ordersData.length} órdenes pendientes`);
      }
    } catch (error) {
      console.error('❌ Error cargando órdenes pendientes:', error);
      
      // El interceptor de Axios ya maneja errores 401
      // Solo mostramos mensajes para otros tipos de errores
      if (error.response?.status === 500) {
        message.error('Error en el servidor. Contacta al administrador.');
      } else if (error.message?.includes('Network') || !error.response) {
        message.error('No se puede conectar al servidor.');
      } else if (error.response?.status !== 401) {
        // No mostrar error si es 401, el interceptor lo maneja
        message.error('Error al cargar las órdenes pendientes');
      }
      
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para cancelar una orden
  const handleCancelOrder = (orderId) => {
    confirm({
      title: '¿Estás seguro de cancelar esta orden?',
      icon: <ExclamationCircleOutlined />,
      content: 'Esta acción liberará los asientos reservados y no se podrá deshacer.',
      okText: 'Sí, cancelar orden',
      okType: 'danger',
      cancelText: 'No, mantener orden',
      onOk: async () => {
        try {
          setCancellingOrderId(orderId);
          const response = await manageOrdersApi.cancelOrder(orderId);
          
          message.success(response.message || `Orden #${orderId} cancelada exitosamente`);
          
          // Recargar la lista de órdenes
          await loadPendingOrders();
        } catch (error) {
          
          // Manejar errores específicos
          if (error.status === 404) {
            message.error('La orden no fue encontrada');
          } else if (error.status === 409) {
            message.error(error.message || 'La orden no se puede cancelar porque no está pendiente');
          } else if (error.status === 400) {
            message.error(error.response?.data?.message || error.message || 'Datos inválidos');
          } else if (error.status === 403) {
            message.error('No tienes permisos para cancelar órdenes');
          } else if (error.status === 500) {
            message.error('Error del servidor. Por favor, contacta al administrador.');
          } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
            message.error('Error de conexión. Verifica que el backend esté corriendo.');
          } else {
            // Mostrar el mensaje de error del backend si existe
            const errorMsg = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Error al cancelar la orden';
            message.error(errorMsg);
          }
        } finally {
          setCancellingOrderId(null);
        }
      }
    });
  };

  // Calcular estadísticas
  const calculateStats = () => {
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;
    const totalItems = orders.reduce((sum, order) => sum + (order.itemCount || 0), 0);
    
    return { totalOrders, totalAmount, totalItems };
  };

  const stats = calculateStats();

  // Columnas de la tabla
  const columns = [
    {
      title: 'ID Orden',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 100,
      render: (orderId) => (
        <Text strong>#{orderId}</Text>
      ),
      sorter: (a, b) => a.orderId - b.orderId,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          PENDING: { color: 'warning', text: 'Pendiente' },
          PAID: { color: 'success', text: 'Pagada' },
          CANCELLED: { color: 'default', text: 'Cancelada' },
          EXPIRED: { color: 'error', text: 'Expirada' }
        };
        
        const config = statusConfig[status] || { color: 'default', text: status };
        
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      filters: [
        { text: 'Pendiente', value: 'PENDING' },
        { text: 'Pagada', value: 'PAID' },
        { text: 'Cancelada', value: 'CANCELLED' },
        { text: 'Expirada', value: 'EXPIRED' }
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Usuario',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text>{email || 'N/A'}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.userEmail || '').localeCompare(b.userEmail || ''),
    },
    {
      title: 'Items',
      dataIndex: 'itemCount',
      key: 'itemCount',
      width: 100,
      align: 'center',
      render: (count) => (
        <Space>
          <ShoppingCartOutlined />
          <Text>{count || 0}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.itemCount || 0) - (b.itemCount || 0),
    },
    {
      title: 'Total',
      dataIndex: 'total_cents',
      key: 'total_cents',
      width: 120,
      align: 'right',
      render: (cents) => {
        const amount = (cents || 0) / 100;
        return (
          <Text strong style={{ color: '#52c41a' }}>
            ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Text>
        );
      },
      sorter: (a, b) => (a.total_cents || 0) - (b.total_cents || 0),
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => {
        if (!date) return 'N/A';
        const dayjsDate = dayjs(date);
        return (
          <Tooltip title={dayjsDate.format('DD/MM/YYYY HH:mm:ss')}>
            <Space direction="vertical" size={0}>
              <Text>{dayjsDate.format('DD/MM/YYYY')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ClockCircleOutlined /> {dayjsDate.fromNow()}
              </Text>
            </Space>
          </Tooltip>
        );
      },
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="Cancelar orden">
            <Button
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={cancellingOrderId === record.orderId}
              onClick={() => handleCancelOrder(record.orderId)}
            >
              Cancelar
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={2} style={{ margin: 0 }}>
                Gestión de Órdenes Pendientes
              </Title>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadPendingOrders}
                loading={loading}
              >
                Actualizar
              </Button>
            </div>
            <Text type="secondary">
              Administra y cancela órdenes que están en estado pendiente de pago
            </Text>
          </Space>
        </Card>

        {/* Estadísticas */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Órdenes Pendientes"
                value={stats.totalOrders}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total en Órdenes"
                value={stats.totalAmount}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Items Totales"
                value={stats.totalItems}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabla de órdenes */}
        <Card>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="orderId"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} órdenes`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            locale={{
              emptyText: (
                <Empty
                  description="No hay órdenes pendientes"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
            scroll={{ x: 'max-content' }}
          />

          {/* Mobile Cards View */}
          <div className="mobile-card-list" style={{ display: 'none' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ) : orders.length === 0 ? (
              <div className="mobile-empty-state">
                <ShoppingCartOutlined className="mobile-empty-state-icon" />
                <div className="mobile-empty-state-text">No hay órdenes pendientes</div>
              </div>
            ) : (
              orders.map((order) => (
                <MobileCardItem
                  key={order.orderId}
                  title={order.eventName}
                  badge={
                    <Tag color="orange">
                      PENDING
                    </Tag>
                  }
                  details={[
                    { 
                      label: 'Usuario', 
                      value: order.customerEmail || 'N/A'
                    },
                    { 
                      label: 'Tickets', 
                      value: order.ticketCount || 0
                    },
                    { 
                      label: 'Total', 
                      value: `$${(order.totalCents / 100).toFixed(2)}`
                    },
                    {
                      label: 'Creada',
                      value: dayjs(order.created_at).fromNow()
                    }
                  ]}
                  actions={[
                    {
                      label: 'Cancelar',
                      icon: <DeleteOutlined />,
                      danger: true,
                      loading: cancellingOrderId === order.orderId,
                      onClick: () => handleCancelOrder(order.orderId)
                    }
                  ]}
                />
              ))
            )}
          </div>
        </Card>
      </Space>
    </div>
  );
}
