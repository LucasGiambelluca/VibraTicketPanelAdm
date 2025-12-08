import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  DatePicker, 
  Select, 
  Button, 
  Upload, 
  message, 
  Row, 
  Col, 
  Typography, 
  Steps,
  Divider,
  Alert
} from 'antd';
import { UploadOutlined, SaveOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { eventsApi } from '../services/apiService';
import { useVenues } from '../hooks/useVenues';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

export default function CreateEvent() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [createdEventId, setCreatedEventId] = useState(null);
  
  // Use the hook to fetch venues
  const { venues, loading: venuesLoading } = useVenues({ limit: 100 });

  // Estado para imágenes
  const [images, setImages] = useState({
    cover_square: null,
    cover_horizontal: null,
    banner_main: null,
    banner_alt: null
  });

  const handleBasicInfoSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Preparar datos para el backend (snake_case)
      const eventData = {
        name: values.name,
        description: values.description,
        category: values.category,
        venue_id: Number(values.venueId), // Ensure it's a number
        address: values.address,
        starts_at: values.startsAt.toISOString(),
        ends_at: values.endsAt.toISOString(),
        status: 'DRAFT'
      };

      if (values.saleStart) {
        eventData.sale_start_date = values.saleStart.toISOString();
      }

      // Crear evento
      const response = await eventsApi.createEvent(eventData);
      const newEvent = response.data || response;
      
      if (newEvent && newEvent.id) {
        setCreatedEventId(newEvent.id);
        message.success('Evento creado exitosamente. Ahora sube las imágenes.');
        setCurrentStep(1);
      } else {
        throw new Error('No se recibió el ID del evento creado');
      }

    } catch (error) {
      console.error('Error creando evento:', error);
      message.error('Error al crear el evento: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (type, file) => {
    setImages(prev => ({ ...prev, [type]: file }));
    return false; // Prevenir subida automática
  };

  const submitImages = async () => {
    if (!createdEventId) return;
    
    try {
      setLoading(true);
      const uploadPromises = [];

      Object.entries(images).forEach(([type, file]) => {
        if (file) {
          uploadPromises.push(
            eventsApi.uploadEventImage(createdEventId, type, file)
              .then(() => message.success(`Imagen ${type} subida`))
              .catch(err => {
                console.error(`Error subiendo ${type}:`, err);
                message.error(`Error al subir ${type}`);
              })
          );
        }
      });

      await Promise.all(uploadPromises);
      
      message.success('Proceso finalizado correctamente');
      navigate('/admin/events'); // Redirigir a lista de eventos
      
    } catch (error) {
      message.error('Error al subir imágenes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <Title level={2}>Nuevo Evento</Title>
        <Steps current={currentStep} style={{ marginBottom: 40 }}>
          <Step title="Información Básica" description="Detalles del evento" />
          <Step title="Imágenes" description="Multimedia y Banners" />
        </Steps>

        {currentStep === 0 && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleBasicInfoSubmit}
            initialValues={{ category: 'MUSIC' }}
          >
            <Row gutter={24}>
              <Col xs={24} lg={16}>
                <Form.Item
                  name="name"
                  label="Nombre del Evento"
                  rules={[{ required: true, message: 'El nombre es obligatorio' }]}
                >
                  <Input placeholder="Ej: Coldplay 2025" size="large" />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Descripción"
                  rules={[{ required: true, message: 'La descripción es obligatoria' }]}
                >
                  <TextArea rows={4} placeholder="Detalles del evento..." />
                </Form.Item>
              </Col>
              
              <Col xs={24} lg={8}>
                <Form.Item
                  name="category"
                  label="Categoría"
                  rules={[{ required: true }]}
                >
                  <Select size="large">
                    <Option value="MUSIC">Música</Option>
                    <Option value="SPORTS">Deportes</Option>
                    <Option value="THEATER">Teatro</Option>
                    <Option value="CONFERENCE">Conferencia</Option>
                    <Option value="OTHER">Otro</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="venueId"
                  label="Venue (Lugar)"
                  rules={[{ required: true, message: 'Selecciona un lugar' }]}
                >
                  <Select 
                    placeholder="Selecciona un venue" 
                    loading={venuesLoading}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {venues.map(venue => (
                      <Option key={venue.id} value={venue.id}>
                        {venue.name} ({venue.city})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="address"
                  label="Dirección"
                >
                  <Input placeholder="Dirección del evento" />
                </Form.Item>
              </Col>
            </Row>

            <Divider>Fechas y Horarios</Divider>

            <Row gutter={[24, 24]}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="startsAt"
                  label="Inicio del Evento"
                  rules={[{ required: true, message: 'Fecha de inicio requerida' }]}
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="endsAt"
                  label="Fin del Evento"
                  dependencies={['startsAt']}
                  rules={[
                    { required: true, message: 'Fecha de fin requerida' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || !getFieldValue('startsAt') || value.isAfter(getFieldValue('startsAt'))) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('La fecha de fin debe ser posterior al inicio'));
                      },
                    }),
                  ]}
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="saleStart"
                  label="Inicio de Venta (Opcional)"
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" size="large" loading={loading} icon={<ArrowRightOutlined />}>
                Crear y Continuar
              </Button>
            </Form.Item>
          </Form>
        )}

        {currentStep === 1 && (
          <div>
            <Alert 
              message="Evento Creado" 
              description="El evento base ha sido creado. Ahora sube las imágenes requeridas." 
              type="success" 
              showIcon 
              style={{ marginBottom: 24 }} 
            />
            
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} lg={6}>
                <Card title="Cover Square (300x300)" size="small">
                  <Upload 
                    beforeUpload={(file) => handleImageUpload('cover_square', file)} 
                    maxCount={1}
                    listType="picture"
                  >
                    <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
                  </Upload>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card title="Cover Horizontal (626x300)" size="small">
                  <Upload 
                    beforeUpload={(file) => handleImageUpload('cover_horizontal', file)} 
                    maxCount={1}
                    listType="picture"
                  >
                    <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
                  </Upload>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card title="Banner Main (1620x720)" size="small">
                  <Upload 
                    beforeUpload={(file) => handleImageUpload('banner_main', file)} 
                    maxCount={1}
                    listType="picture"
                  >
                    <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
                  </Upload>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card title="Banner Alt (1620x700)" size="small">
                  <Upload 
                    beforeUpload={(file) => handleImageUpload('banner_alt', file)} 
                    maxCount={1}
                    listType="picture"
                  >
                    <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
                  </Upload>
                </Card>
              </Col>
            </Row>

            <div style={{ marginTop: 32, textAlign: 'right' }}>
              <Button onClick={() => navigate('/admin/events')} style={{ marginRight: 12 }}>
                Omitir Imágenes
              </Button>
              <Button type="primary" onClick={submitImages} loading={loading} icon={<SaveOutlined />} size="large">
                Finalizar y Guardar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
