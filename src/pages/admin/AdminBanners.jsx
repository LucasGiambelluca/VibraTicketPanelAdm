import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Upload, 
  Switch, 
  InputNumber,
  message,
  Tag,
  Image,
  Popconfirm,
  Alert,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UploadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { homepageBannersApi, eventsApi } from '../../services/apiService';
import { getImageUrl } from '../../utils/imageUtils';
import MobileCardItem from '../../components/MobileCardItem';

const { Option } = Select;
const { TextArea } = Input;

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [form] = Form.useForm();
  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    loadBanners();
    loadEvents();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const response = await homepageBannersApi.getAllBanners();

      // Helper para extraer arrays (reutilizado)
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
        // Caso específico para banners: response.data.all
        if (payload.all && Array.isArray(payload.all)) return payload.all;
        return [];
      };

      const bannersList = extractArray(response, 'all');
      setBanners(bannersList);
    } catch (error) {
      console.error('❌ Error al cargar banners:', error);
      message.error('Error al cargar los banners');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await eventsApi.getEvents();
      setEvents(response.events || []);
    } catch (error) {
      console.error('❌ Error al cargar eventos:', error);
    }
  };

  const handleCreate = () => {
    setEditingBanner(null);
    setImageFile(null);
    setPreviewImage(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setImageFile(null);
    setPreviewImage(getImageUrl(banner.image_url, 'Banner'));
    form.setFieldsValue({
      title: banner.title,
      description: banner.description,
      link_type: banner.link_type,
      link_url: banner.link_url,
      event_id: banner.event_id,
      display_order: banner.display_order,
      is_active: banner.is_active
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      if (!editingBanner && !imageFile) {
        message.error('Debes subir una imagen para el banner');
        return;
      }

      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('description', values.description || '');
      formData.append('link_type', values.link_type || 'none');
      
      if (values.link_type === 'external' && values.link_url) {
        formData.append('link_url', values.link_url);
      }
      
      if (values.link_type === 'event' && values.event_id) {
        formData.append('event_id', String(values.event_id)); // Convertir a string
      }
      
      formData.append('display_order', String(values.display_order || 0)); // Convertir a string
      // Según la guía oficial: enviar como string 'true' o 'false'
      formData.append('is_active', values.is_active ? 'true' : 'false');
      
      if (imageFile) {
        formData.append('banner', imageFile);
      }

      if (editingBanner) {
        await homepageBannersApi.updateBanner(editingBanner.id, formData);
        message.success('Banner actualizado correctamente');
      } else {
        await homepageBannersApi.createBanner(formData);
        message.success('Banner creado correctamente');
      }

      setModalVisible(false);
      loadBanners();
    } catch (error) {
      console.error('❌ Error al guardar banner:', error);
      message.error(error.response?.data?.message || 'Error al guardar el banner');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (bannerId) => {
    try {
      await homepageBannersApi.toggleBanner(bannerId);
      message.success('Estado del banner actualizado');
      loadBanners();
    } catch (error) {
      console.error('❌ Error al cambiar estado:', error);
      message.error('Error al cambiar el estado del banner');
    }
  };

  const handleDelete = async (bannerId) => {
    try {
      await homepageBannersApi.deleteBanner(bannerId);
      message.success('Banner eliminado correctamente');
      loadBanners();
    } catch (error) {
      console.error('❌ Error al eliminar banner:', error);
      message.error('Error al eliminar el banner');
    }
  };

  const handleReorder = async (bannerId, direction) => {
    const currentIndex = banners.findIndex(b => b.id === bannerId);
    if (currentIndex === -1) return;

    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= newBanners.length) return;

    // Intercambiar posiciones
    [newBanners[currentIndex], newBanners[targetIndex]] = 
    [newBanners[targetIndex], newBanners[currentIndex]];

    // Actualizar display_order
    const reorderData = newBanners.map((banner, index) => ({
      id: banner.id,
      display_order: index * 10
    }));

    try {
      await homepageBannersApi.reorderBanners(reorderData);
      message.success('Orden actualizado');
      loadBanners();
    } catch (error) {
      console.error('❌ Error al reordenar:', error);
      message.error('Error al reordenar los banners');
    }
  };

  const handleImageChange = (info) => {
    const file = info.file.originFileObj || info.file;
    setImageFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const columns = [
    {
      title: 'Orden',
      dataIndex: 'display_order',
      key: 'display_order',
      width: 80,
      sorter: (a, b) => a.display_order - b.display_order,
      defaultSortOrder: 'ascend'
    },
    {
      title: 'Imagen',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 150,
      render: (url) => (
        <Image
          width={120}
          height={50}
          src={getImageUrl(url, 'Banner')}
          alt="Banner"
          style={{ objectFit: 'cover', borderRadius: 4 }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        />
      )
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Tipo de Link',
      dataIndex: 'link_type',
      key: 'link_type',
      width: 120,
      render: (type, record) => {
        if (type === 'event') {
          const event = events.find(e => e.id === record.event_id);
          return <Tag color="blue">Evento: {event?.name || record.event_id}</Tag>;
        }
        if (type === 'external') {
          return <Tag color="green">Externa</Tag>;
        }
        return <Tag>Ninguno</Tag>;
      }
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active, record) => (
        <Switch
          checked={active}
          onChange={() => handleToggleActive(record.id)}
          checkedChildren={<EyeOutlined />}
          unCheckedChildren={<EyeInvisibleOutlined />}
        />
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const currentIndex = banners.findIndex(b => b.id === record.id);
        return (
          <Space size="small">
            <Button
              type="text"
              icon={<ArrowUpOutlined />}
              onClick={() => handleReorder(record.id, 'up')}
              disabled={currentIndex === 0}
              title="Subir"
            />
            <Button
              type="text"
              icon={<ArrowDownOutlined />}
              onClick={() => handleReorder(record.id, 'down')}
              disabled={currentIndex === banners.length - 1}
              title="Bajar"
            />
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            >
              Editar
            </Button>
            <Popconfirm
              title="¿Estás seguro de eliminar este banner?"
              onConfirm={() => handleDelete(record.id)}
              okText="Sí"
              cancelText="No"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                Eliminar
              </Button>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <PictureOutlined style={{ fontSize: 24 }} />
            <span style={{ fontSize: 20, fontWeight: 'bold' }}>
              Gestión de Banners de Homepage
            </span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
          >
            Crear Banner
          </Button>
        }
      >
        <Alert
          message="Información"
          description="Los banners se muestran en el carousel de la página principal. Puedes reordenarlos, activarlos/desactivarlos y vincularlos a eventos o URLs externas."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={banners}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />

        {/* Mobile Cards View */}
        <div className="mobile-card-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : banners.length === 0 ? (
            <div className="mobile-empty-state">
              <PictureOutlined className="mobile-empty-state-icon" />
              <div className="mobile-empty-state-text">No hay banners disponibles</div>
            </div>
          ) : (
            banners.map((banner) => {
              const event = events.find(e => e.id === banner.event_id);
              const linkTypeDisplay = banner.link_type === 'event' 
                ? `Evento: ${event?.name || banner.event_id}`
                : banner.link_type === 'external'
                ? 'URL Externa'
                : 'Sin enlace';

              return (
                <MobileCardItem
                  key={banner.id}
                  title={banner.title}
                  badge={
                    <Tag color={banner.is_active ? 'green' : 'red'}>
                      {banner.is_active ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      {' '}
                      {banner.is_active ? 'Activo' : 'Inactivo'}
                    </Tag>
                  }
                  details={[
                    { 
                      label: 'Orden', 
                      value: banner.display_order
                    },
                    { 
                      label: 'Tipo de Link', 
                      value: linkTypeDisplay
                    },
                    { 
                      label: 'Descripción', 
                      value: banner.description || 'Sin descripción'
                    }
                  ]}
                  actions={[
                    {
                      label: 'Editar',
                      icon: <EditOutlined />,
                      type: 'primary',
                      onClick: () => handleEdit(banner)
                    },
                    {
                      label: banner.is_active ? 'Desactivar' : 'Activar',
                      icon: banner.is_active ? <EyeInvisibleOutlined /> : <EyeOutlined />,
                      onClick: () => handleToggleActive(banner.id)
                    },
                    {
                      label: 'Eliminar',
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () => handleDelete(banner.id)
                    }
                  ]}
                />
              );
            })
          )}
        </div>
      </Card>

      <Modal
        title={editingBanner ? 'Editar Banner' : 'Crear Banner'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            link_type: 'none',
            display_order: 0,
            is_active: false
          }}
        >
          <Form.Item
            label="Título"
            name="title"
            rules={[{ required: true, message: 'El título es obligatorio' }]}
          >
            <Input placeholder="Ej: Iron Maiden 2026" size="large" />
          </Form.Item>

          <Form.Item
            label="Descripción"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="Ej: Run For Your Lives Tour"
            />
          </Form.Item>

          <Form.Item
            label="Imagen del Banner"
            required={!editingBanner}
          >
            <Upload
              listType="picture-card"
              maxCount={1}
              beforeUpload={() => false}
              onChange={handleImageChange}
              accept="image/*"
            >
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Subir Imagen</div>
                </div>
              )}
            </Upload>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              Recomendado: 1920x600px, formato JPG/PNG, máximo 2MB
            </div>
          </Form.Item>

          <Form.Item
            label="Tipo de Enlace"
            name="link_type"
          >
            <Select size="large">
              <Option value="none">Sin enlace (solo visual)</Option>
              <Option value="event">Evento</Option>
              <Option value="external">URL Externa</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.link_type !== currentValues.link_type
            }
          >
            {({ getFieldValue }) => {
              const linkType = getFieldValue('link_type');

              if (linkType === 'event') {
                return (
                  <Form.Item
                    label="Seleccionar Evento"
                    name="event_id"
                    rules={[{ required: true, message: 'Selecciona un evento' }]}
                  >
                    <Select
                      size="large"
                      placeholder="Selecciona un evento"
                      showSearch
                      filterOption={(input, option) =>
                        option.children.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {events.map(event => (
                        <Option key={event.id} value={event.id}>
                          {event.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }

              if (linkType === 'external') {
                return (
                  <Form.Item
                    label="URL Externa"
                    name="link_url"
                    rules={[
                      { required: true, message: 'Ingresa una URL' },
                      { type: 'url', message: 'Ingresa una URL válida' }
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="https://ejemplo.com"
                    />
                  </Form.Item>
                );
              }

              return null;
            }}
          </Form.Item>

          <Form.Item
            label="Orden de Visualización"
            name="display_order"
            help="Número menor = aparece primero"
          >
            <InputNumber
              min={0}
              max={999}
              size="large"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="¿Activar banner?"
            name="is_active"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Activo"
              unCheckedChildren="Inactivo"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingBanner ? 'Actualizar' : 'Crear'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
