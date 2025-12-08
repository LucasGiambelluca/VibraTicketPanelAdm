import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Badge, Modal, 
  message, Space, Tag, Tooltip, Card,
  Typography, Row, Col, Statistic, Input, Grid, Descriptions, Divider, Spin
} from 'antd';
import { 
  PlusOutlined, EditOutlined, 
  DeleteOutlined, BarChartOutlined,
  TagsOutlined, PercentageOutlined,
  DollarOutlined, CalendarOutlined,
  PauseCircleOutlined, PlayCircleOutlined,
  SearchOutlined, FilterOutlined, CheckCircleOutlined,
  DownOutlined, UpOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import DiscountCodeForm from '../../components/admin/DiscountCodeForm';
import DiscountStatistics from '../../components/admin/DiscountStatistics';
import { discountService } from '../../services/discountService';
import MobileCardItem from '../../components/MobileCardItem';

const { Title, Text } = Typography;

const DiscountCodesAdmin = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [statisticsModalVisible, setStatisticsModalVisible] = useState(false);
  const [selectedCodeId, setSelectedCodeId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const screens = Grid.useBreakpoint(); // Add Grid breakpoint hook
  const [statistics, setStatistics] = useState({
    totalCodes: 0,
    activeCodes: 0,
    totalUsage: 0,
    totalDiscounted: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10, // Reduced for better mobile view
    total: 0
  });

  useEffect(() => {
    loadCodes();
  }, [pagination.current]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const response = await discountService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        includeExpired: false
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

      const codesList = extractArray(response, 'codes') || extractArray(response, 'discountCodes');

      const paginationData = response?.pagination || response?.data?.pagination || { 
        total: codesList.length, 
        page: pagination.current, 
        limit: pagination.pageSize,
        totalPages: Math.ceil(codesList.length / pagination.pageSize)
      };

      setCodes(codesList);
      setPagination(prev => ({ 
        ...prev, 
        total: paginationData.total,
        totalPages: paginationData.totalPages 
      }));

      // Calcular estadísticas generales
      const activeCodes = codesList.filter(c => c.is_active);
      const totalUsage = codesList.reduce((sum, c) => sum + (c.usage_count || 0), 0);
      
      setStatistics({
        totalCodes: codesList.length,
        activeCodes: activeCodes.length,
        totalUsage: totalUsage,
        totalDiscounted: codesList.reduce((sum, c) => sum + (c.total_discounted || 0), 0)
      });
    } catch (error) {
      console.error('❌ Error cargando códigos de descuento:', error);
      message.error('Error cargando códigos de descuento');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCode(null);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingCode(record);
    setModalVisible(true);
  };

  const handleToggleStatus = async (codeId, currentStatus) => {
    const action = currentStatus ? 'suspender' : 'activar';
    const actionTitle = currentStatus ? '¿Suspender código?' : '¿Activar código?';
    const actionContent = currentStatus 
      ? 'El código será suspendido temporalmente y no podrá ser usado.'
      : 'El código será activado y podrá ser usado nuevamente.';
    
    Modal.confirm({
      title: actionTitle,
      content: actionContent,
      okText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelText: 'Cancelar',
      okType: currentStatus ? 'default' : 'primary',
      onOk: async () => {
        try {
          if (currentStatus) {
            await discountService.suspendCode(codeId);
            message.success('Código suspendido temporalmente');
          } else {
            await discountService.activateCode(codeId);
            message.success('Código activado exitosamente');
          }
          loadCodes();
        } catch (error) {
          const errorMsg = error.response?.data?.message || `Error al ${action} el código`;
          message.error(errorMsg);
        }
      }
    });
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '¿Seguro que desea eliminar este código?',
      content: 'Esta acción no se puede deshacer. El código desaparecerá de la lista principal.',
      okText: 'Eliminar',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: async () => {
        try {
          await discountService.deleteCode(id);
          message.success('Código eliminado correctamente');
          loadCodes();
        } catch (error) {
          message.error('Error al eliminar código');
        }
      }
    });
  };

  const handleStatistics = (record) => {
    setSelectedCodeId(record.id);
    setStatisticsModalVisible(true);
  };

  const handleFormSubmit = async (values) => {
    try {
      if (editingCode) {
        await discountService.updateCode(editingCode.id, values);
        message.success('Código actualizado');
      } else {
        await discountService.createCode(values);
        message.success('Código creado exitosamente');
      }
      setModalVisible(false);
      loadCodes();
    } catch (error) {
      if (error.response?.status === 409) {
        message.error('El código ya existe');
      } else {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Error al guardar código';
        message.error(errorMsg);
      }
    }
  };

  const columns = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      render: (code) => (
        <Tag color="geekblue" style={{ fontSize: '14px', padding: '4px 10px', borderRadius: '6px' }}>
          {code}
        </Tag>
      )
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      responsive: ['md']
    },
    {
      title: 'Valor',
      dataIndex: 'discount_display',
      key: 'discount_display',
      render: (display, record) => (
        <Space>
          {record.discount_type === 'PERCENTAGE' ? 
            <PercentageOutlined style={{ color: '#52c41a' }} /> : 
            <DollarOutlined style={{ color: '#faad14' }} />
          }
          <strong style={{ color: '#1f1f1f' }}>{display || '-'}</strong>
        </Space>
      )
    },
    {
      title: 'Uso',
      dataIndex: 'usage_status',
      key: 'usage_status',
      responsive: ['lg'], // Hide on mobile/tablet
      render: (_, record) => {
        const usageCount = record.usage_count || 0;
        const limit = record.usage_limit || '∞';
        const percentage = record.usage_limit ? (usageCount / record.usage_limit) * 100 : 0;
        
        return (
          <Tooltip title={`${usageCount} usados de ${limit}`}>
            <div style={{ width: 100 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span>{usageCount}</span>
                <span style={{ color: '#999' }}>/ {limit}</span>
              </div>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min(percentage, 100)}%`,
                  background: percentage > 90 ? '#ff4d4f' : '#1890ff',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      responsive: ['md'], // Hide on mobile
      render: (active, record) => {
        const isExpired = record.valid_until && new Date(record.valid_until) < new Date();
        if (isExpired) return <Badge status="error" text={<span style={{ color: '#ff4d4f' }}>Expirado</span>} />;
        return (
          <Badge
            status={active ? 'success' : 'warning'}
            text={active ? <span style={{ color: '#52c41a' }}>Activo</span> : <span style={{ color: '#faad14' }}>Suspendido</span>}
          />
        );
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right',
      responsive: ['md'], // Hide on mobile, actions are in expanded row
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
              size="small"
              type="text"
            />
          </Tooltip>
          <Tooltip title={record.is_active ? 'Suspender' : 'Activar'}>
            <Button 
              icon={record.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
              onClick={() => handleToggleStatus(record.id, record.is_active)}
              size="small"
              type="text"
              style={{ color: record.is_active ? '#faad14' : '#52c41a' }}
            />
          </Tooltip>
          <Tooltip title="Ver estadísticas">
            <Button 
              icon={<BarChartOutlined />} 
              onClick={() => handleStatistics(record)}
              size="small"
              type="text"
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record.id)}
              size="small"
              type="text"
              danger
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Expandable row renderer for mobile/tablet details
  const expandedRowRender = (record) => {
    const isExpired = record.valid_until && new Date(record.valid_until) < new Date();
    const usageCount = record.usage_count || 0;
    const limit = record.usage_limit || '∞';
    const percentage = record.usage_limit ? (usageCount / record.usage_limit) * 100 : 0;

    return (
      <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
          <Descriptions.Item label="Descripción">{record.description || 'Sin descripción'}</Descriptions.Item>
          <Descriptions.Item label="Estado">
             {isExpired ? (
               <Badge status="error" text="Expirado" />
             ) : (
               <Badge status={record.is_active ? 'success' : 'warning'} text={record.is_active ? 'Activo' : 'Suspendido'} />
             )}
          </Descriptions.Item>
          <Descriptions.Item label="Uso">
            <Space direction="vertical" style={{ width: '100%' }} size={0}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{usageCount} usados</span>
                <span>Límite: {limit}</span>
              </div>
              <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden', width: '100%', marginTop: 4 }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min(percentage, 100)}%`,
                  background: percentage > 90 ? '#ff4d4f' : '#1890ff'
                }} />
              </div>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Válido Hasta">
            {record.valid_until ? new Date(record.valid_until).toLocaleDateString() : 'Indefinido'}
          </Descriptions.Item>
          <Descriptions.Item label="Mínimo de Compra">
            {record.min_purchase_amount ? `$${record.min_purchase_amount}` : 'Sin mínimo'}
          </Descriptions.Item>
        </Descriptions>
        
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
           <Button 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
              size="small"
            >
              Editar
            </Button>
            <Button 
              icon={record.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
              onClick={() => handleToggleStatus(record.id, record.is_active)}
              size="small"
              danger={record.is_active}
              type={record.is_active ? 'default' : 'primary'}
            >
              {record.is_active ? 'Suspender' : 'Activar'}
            </Button>
            <Button 
              icon={<BarChartOutlined />} 
              onClick={() => handleStatistics(record)}
              size="small"
            >
              Estadísticas
            </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      
      {/* Header Section */}
      <div className="glass-header" style={{ 
        padding: '24px', 
        borderRadius: '16px', 
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <Title level={2} style={{ margin: 0, background: 'linear-gradient(45deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Códigos de Descuento
          </Title>
          <Text type="secondary">Gestiona y monitorea tus campañas promocionales</Text>
        </div>
        <Space>
          <Input 
            placeholder="Buscar código..." 
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
            style={{ width: 200, borderRadius: '8px' }}
            onChange={e => setSearchText(e.target.value)}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              boxShadow: '0 4px 14px 0 rgba(118, 75, 162, 0.39)'
            }}
          >
            Nuevo Código
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        {[
          { title: 'Total Códigos', value: statistics.totalCodes, icon: <TagsOutlined />, color: '#1890ff' },
          { title: 'Activos', value: statistics.activeCodes, icon: <CheckCircleOutlined />, color: '#52c41a' }, // Note: CheckCircleOutlined needs import if used, replacing with generic icon logic or ensuring import
          { title: 'Total Usos', value: statistics.totalUsage, icon: <BarChartOutlined />, color: '#722ed1' },
          { title: 'Total Descontado', value: statistics.totalDiscounted, icon: <DollarOutlined />, color: '#eb2f96', prefix: '$' }
        ].map((stat, index) => (
          <Col xs={24} sm={12} md={6} key={index}>
            <div className="glass-card" style={{ padding: '24px', height: '100%', transition: 'transform 0.3s', cursor: 'default' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Statistic
                title={<Text type="secondary">{stat.title}</Text>}
                value={stat.value}
                prefix={stat.prefix || <span style={{ color: stat.color, marginRight: 8, fontSize: 20 }}>{stat.icon}</span>}
                valueStyle={{ fontWeight: 600, color: '#1f1f1f' }}
              />
            </div>
          </Col>
        ))}
      </Row>

      {/* Main Table */}
      <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={codes.filter(c => c.code.includes(searchText.toUpperCase()))}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            onChange: (page) => setPagination({ ...pagination, current: page }),
            showSizeChanger: false,
            itemRender: (_, type, originalElement) => {
              if (type === 'prev') return <Button type="text">Anterior</Button>;
              if (type === 'next') return <Button type="text">Siguiente</Button>;
              return originalElement;
            }
          }}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
            expandIcon: ({ expanded, onExpand, record }) => (
              <Button
                type="text"
                size="small"
                icon={expanded ? <UpOutlined /> : <DownOutlined />}
                onClick={e => onExpand(record, e)}
              />
            )
          }}
        />

        {/* Mobile Cards View */}
        <div className="mobile-card-list" style={{ display: 'none' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : codes.filter(c => c.code.includes(searchText.toUpperCase())).length === 0 ? (
            <div className="mobile-empty-state">
              <TagsOutlined className="mobile-empty-state-icon" />
              <div className="mobile-empty-state-text">No hay códigos de descuento</div>
            </div>
          ) : (
            codes.filter(c => c.code.includes(searchText.toUpperCase())).map((code) => {
              const isExpired = code.valid_until && new Date(code.valid_until) < new Date();
              const usageCount = code.usage_count || 0;
              const limit = code.usage_limit || '∞';
              const discountDisplay = code.discount_type === 'percentage' 
                ? `${code.discount_value}%`
                : `$${code.discount_value}`;

              return (
                <MobileCardItem
                  key={code.id}
                  title={code.code}
                  badge={
                    <Tag color={isExpired ? 'red' : code.is_active ? 'green' : 'orange'}>
                      {isExpired ? 'Expirado' : code.is_active ? 'Activo' : 'Suspendido'}
                    </Tag>
                  }
                  details={[
                    { 
                      label: 'Descuento', 
                      value: discountDisplay
                    },
                    { 
                      label: 'Uso', 
                      value: `${usageCount} / ${limit}`
                    },
                    { 
                      label: 'Válido hasta', 
                      value: code.valid_until ? new Date(code.valid_until).toLocaleDateString() : 'Indefinido'
                    },
                    {
                      label: 'Descripción',
                      value: code.description || 'Sin descripción'
                    }
                  ]}
                  actions={[
                    {
                      label: 'Editar',
                      icon: <EditOutlined />,
                      type: 'primary',
                      onClick: () => handleEdit(code)
                    },
                    {
                      label: code.is_active ? 'Suspender' : 'Activar',
                      icon: code.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
                      onClick: () => handleToggleStatus(code.id, code.is_active)
                    },
                    {
                      label: 'Estadísticas',
                      icon: <BarChartOutlined />,
                      onClick: () => handleStatistics(code)
                    },
                    {
                      label: 'Eliminar',
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () => handleDelete(code.id)
                    }
                  ]}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        title={
          <Space>
            {editingCode ? <EditOutlined /> : <PlusOutlined />}
            {editingCode ? 'Editar Código' : 'Crear Código'}
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}

      >
        <DiscountCodeForm
          initialValues={editingCode}
          onSubmit={handleFormSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>

      <Modal
        title={<Space><BarChartOutlined /> Estadísticas</Space>}
        open={statisticsModalVisible}
        onCancel={() => setStatisticsModalVisible(false)}
        footer={null}
        width={900}
        style={{ top: 20 }}

      >
        {selectedCodeId && <DiscountStatistics codeId={selectedCodeId} />}
      </Modal>
    </div>
  );
};

export default DiscountCodesAdmin;
