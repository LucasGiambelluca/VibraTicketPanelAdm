import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, DatePicker, message, Popconfirm, Space, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { showsApi } from '../services/apiService';

/**
 * Gestión de Funciones (fechas) de un evento.
 * - 1 función: vista simple (fecha + "agregar otra").
 * - 2+ funciones: tabla con editar/borrar.
 * Agregar copia secciones/precios/asientos de la primera función (endpoint duplicate).
 */
export default function EventFunctions({ eventId }) {
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // función en edición
  const [editDate, setEditDate] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await showsApi.listShows({ eventId });
      const list = (res.data?.shows || res.data || [])
        .slice()
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      setFunctions(list);
    } catch (e) {
      message.error('Error cargando funciones');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addDate) { message.warning('Elegí fecha y hora'); return; }
    if (functions.length === 0) { message.error('No hay función base para copiar'); return; }
    setSaving(true);
    try {
      const base = functions[0];
      const res = await showsApi.duplicateShow(base.id, { startsAt: addDate.toISOString() });
      message.success(`Función creada con ${res.data?.copied?.sections ?? 0} secciones`);
      setAddOpen(false); setAddDate(null);
      load();
    } catch (e) {
      message.error(e.response?.data?.message || 'Error al crear la función');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editDate || !editing) return;
    setSaving(true);
    try {
      await showsApi.updateShow(editing.id, { startsAt: editDate.toISOString() });
      message.success('Fecha actualizada');
      setEditing(null); setEditDate(null);
      load();
    } catch (e) {
      message.error(e.response?.data?.message || 'Error al actualizar la fecha');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (functions.length <= 1) { message.warning('No se puede borrar la única función del evento'); return; }
    try {
      await showsApi.deleteShow(row.id);
      message.success('Función eliminada');
      load();
    } catch (e) {
      message.error(e.response?.data?.message || 'No se pudo borrar (puede tener ventas)');
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setEditDate(dayjs(row.starts_at));
  };

  const columns = [
    {
      title: 'Fecha y hora',
      dataIndex: 'starts_at',
      render: (d) => <span><CalendarOutlined /> {dayjs(d).format('DD/MM/YYYY HH:mm')}</span>,
    },
    { title: 'Estado', dataIndex: 'status', render: (s) => <Tag color={s === 'PUBLISHED' ? 'green' : 'default'}>{s || '—'}</Tag> },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Tooltip title="Editar fecha">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Popconfirm
            title="¿Borrar esta función?"
            description="Si tiene ventas, el backend la archivará en vez de borrarla."
            okText="Borrar" cancelText="Cancelar"
            onConfirm={() => handleDelete(row)}
            disabled={functions.length <= 1}
          >
            <Tooltip title={functions.length <= 1 ? 'No se puede borrar la única función' : 'Borrar'}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={functions.length <= 1} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const addButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
      {functions.length === 0 ? 'Agregar función' : 'Agregar otra función'}
    </Button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Funciones</h3>
        {functions.length !== 1 && addButton}
      </div>

      {loading ? null : functions.length === 1 ? (
        // Vista simple: una sola fecha
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <Space size="middle">
            <span style={{ fontSize: 16 }}>
              <CalendarOutlined /> {dayjs(functions[0].starts_at).format('DD/MM/YYYY HH:mm')}
            </span>
            <Tag color={functions[0].status === 'PUBLISHED' ? 'green' : 'default'}>{functions[0].status || '—'}</Tag>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(functions[0])}>Editar fecha</Button>
          </Space>
          {addButton}
        </div>
      ) : (
        <Table rowKey="id" dataSource={functions} columns={columns} loading={loading} pagination={false} size="small" />
      )}

      {/* Modal agregar */}
      <Modal
        title="Nueva función"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => { setAddOpen(false); setAddDate(null); }}
        okText="Crear" cancelText="Cancelar" confirmLoading={saving}
      >
        <p>Se copian las secciones, precios y asientos de la primera función.</p>
        <DatePicker showTime format="DD/MM/YYYY HH:mm" value={addDate} onChange={setAddDate} style={{ width: '100%' }} />
      </Modal>

      {/* Modal editar fecha */}
      <Modal
        title="Editar fecha de la función"
        open={!!editing}
        onOk={handleEdit}
        onCancel={() => { setEditing(null); setEditDate(null); }}
        okText="Guardar" cancelText="Cancelar" confirmLoading={saving}
      >
        <DatePicker showTime format="DD/MM/YYYY HH:mm" value={editDate} onChange={setEditDate} style={{ width: '100%' }} />
      </Modal>
    </div>
  );
}
