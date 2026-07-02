import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Modal,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  LinkOutlined,
  DisconnectOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { producersApi } from '../../services/apiService';

const { Text } = Typography;

// Formatear centavos como moneda ARS (es-AR)
const formatArs = (cents) => {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

// Formatear fecha dd/mm/aaaa
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Badge de estado de vinculación MercadoPago
function MpStatusBadge({ row }) {
  const status = row.mp_status;

  if (status === 'LINKED') {
    const vence = formatDate(row.expires_at);
    return (
      <Space direction="vertical" size={0}>
        <Tag color="green">Vinculada</Tag>
        {row.mp_user_id && (
          <Text type="secondary" style={{ fontSize: 12 }}>MP ID: {row.mp_user_id}</Text>
        )}
        {vence && (
          <Text type="secondary" style={{ fontSize: 12 }}>vence {vence}</Text>
        )}
      </Space>
    );
  }
  if (status === 'EXPIRED') {
    return <Tag color="red">Vencida</Tag>;
  }
  if (status === 'REVOKED') {
    return <Tag color="default">Revocada</Tag>;
  }
  // PENDING o null
  return <Tag color="gold">Sin vincular</Tag>;
}

export default function ProducersPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modal de link OAuth generado
  const [linkModal, setLinkModal] = useState({ open: false, producerName: '', authorizationUrl: '' });
  const [copied, setCopied] = useState(false);

  // Modal de nueva productora
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await producersApi.getMpSummary();
      const payload = res.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.rows || payload?.data || payload?.producers || []);
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error al cargar productoras';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Generar link de vinculación MP
  const handleCreateLink = async (row) => {
    try {
      setActionLoadingId(row.producer_id);
      const res = await producersApi.createProducerMpLink(row.producer_id);
      const data = res.data?.data || res.data || {};
      if (!data.authorizationUrl) {
        message.error('El backend no devolvió el link de autorización');
        return;
      }
      setCopied(false);
      setLinkModal({
        open: true,
        producerName: data.producerName || row.producer_name,
        authorizationUrl: data.authorizationUrl,
      });
      // Refrescar para reflejar estado PENDING
      fetchSummary();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al generar el link de MercadoPago';
      message.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Desvincular cuenta MP
  const handleRevoke = async (row) => {
    const ok = window.confirm(
      '¿Desvincular la cuenta de MercadoPago de esta productora? Las próximas ventas irán a la cuenta global sin split.'
    );
    if (!ok) return;
    try {
      setActionLoadingId(row.producer_id);
      await producersApi.revokeProducerMpLink(row.producer_id);
      message.success('Cuenta de MercadoPago desvinculada');
      await fetchSummary();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al desvincular la cuenta';
      message.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Copiar link al portapapeles
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkModal.authorizationUrl);
      setCopied(true);
      message.success('Link copiado al portapapeles');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      message.error('No se pudo copiar. Seleccioná el texto y copialo manualmente.');
    }
  };

  // Crear nueva productora
  const handleCreateProducer = async () => {
    const name = createName.trim();
    if (!name) {
      message.warning('Ingresá el nombre de la productora');
      return;
    }
    try {
      setCreating(true);
      await producersApi.createProducer({ name });
      message.success(`Productora "${name}" creada correctamente`);
      setCreateOpen(false);
      setCreateName('');
      await fetchSummary();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al crear la productora';
      message.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      title: 'Productora',
      dataIndex: 'producer_name',
      key: 'producer_name',
      render: (name, row) => (
        <div>
          <Text strong>{name || `Productora #${row.producer_id}`}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {row.producer_id}</Text>
        </div>
      ),
    },
    {
      title: 'MercadoPago',
      key: 'mp_status',
      render: (_, row) => <MpStatusBadge row={row} />,
    },
    {
      title: 'Vendido',
      dataIndex: 'gross_cents',
      key: 'gross_cents',
      align: 'right',
      render: (cents, row) => (
        <div>
          <Text>{formatArs(cents)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {Number(row.approved_payments || 0)} pagos
          </Text>
        </div>
      ),
    },
    {
      title: 'Comisión plataforma',
      dataIndex: 'platform_fee_cents',
      key: 'platform_fee_cents',
      align: 'right',
      render: (cents) => formatArs(cents),
    },
    {
      title: 'Neto productora',
      dataIndex: 'producer_net_cents',
      key: 'producer_net_cents',
      align: 'right',
      render: (cents) => <Text strong>{formatArs(cents)}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, row) => {
        const isLinked = row.mp_status === 'LINKED';
        const canRevoke = isLinked || row.mp_status === 'EXPIRED';
        const busy = actionLoadingId === row.producer_id;
        return (
          <Space>
            {!isLinked && (
              <Button
                size="small"
                type="primary"
                icon={<LinkOutlined />}
                loading={busy}
                onClick={() => handleCreateLink(row)}
              >
                Vincular MP
              </Button>
            )}
            {canRevoke && (
              <Button
                size="small"
                danger
                icon={<DisconnectOutlined />}
                loading={busy}
                onClick={() => handleRevoke(row)}
              >
                Desvincular
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <header className="page-header">
        <span className="page-eyebrow">Ventas · split de pagos</span>
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Productoras</h1>
            <p className="page-subtitle">
              Vinculá la cuenta de MercadoPago de cada productora: el dinero de sus entradas
              va a su cuenta y la plataforma retiene el cargo por servicio.
            </p>
          </div>
          <div className="page-actions">
            <Button icon={<ReloadOutlined />} onClick={fetchSummary} loading={loading}>
              Actualizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Nueva productora
            </Button>
          </div>
        </div>
      </header>

      <Card>
        <Table
          rowKey="producer_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 'max-content' }}
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} productoras`,
          }}
          locale={{ emptyText: 'No hay productoras cargadas' }}
        />

        {error && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              marginTop: '16px',
            }}
          >
            <Text type="danger">Error al cargar productoras: {error}</Text>
            <br />
            <Button type="link" onClick={fetchSummary} style={{ marginTop: '8px' }}>
              Reintentar
            </Button>
          </div>
        )}
      </Card>

      {/* Modal: link de vinculación generado */}
      <Modal
        title={`Link de vinculación · ${linkModal.producerName}`}
        open={linkModal.open}
        onCancel={() => setLinkModal({ open: false, producerName: '', authorizationUrl: '' })}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopyLink}
          >
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>,
          <Button
            key="close"
            onClick={() => setLinkModal({ open: false, producerName: '', authorizationUrl: '' })}
          >
            Cerrar
          </Button>,
        ]}
        width={640}
        centered
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.TextArea
            readOnly
            value={linkModal.authorizationUrl}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onFocus={(e) => e.target.select()}
          />
          <Text type="secondary">
            El link vence en 15 minutos. Enviáselo a la productora para que autorice con SU
            cuenta de MercadoPago.
          </Text>
        </Space>
      </Modal>

      {/* Modal: nueva productora */}
      <Modal
        title="Nueva productora"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreateName('');
        }}
        onOk={handleCreateProducer}
        okText="Crear"
        cancelText="Cancelar"
        confirmLoading={creating}
        width={420}
        centered
      >
        <div style={{ marginTop: 8 }}>
          <Text strong>Nombre</Text>
          <Input
            style={{ marginTop: 6 }}
            placeholder="Nombre de la productora"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onPressEnter={handleCreateProducer}
            maxLength={120}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
