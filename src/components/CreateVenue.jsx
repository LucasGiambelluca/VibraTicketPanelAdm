import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  message, 
  Row, 
  Col, 
  Typography,
  InputNumber
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { venuesApi } from '../services/apiService';

const { Title, Text } = Typography;

export default function CreateVenue({ onVenueCreated, onCancel }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      
      const venueData = {
        name: values.name,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country || 'Argentina',
        max_capacity: values.max_capacity,
      };

      const response = await venuesApi.createVenue(venueData);
      message.success('Venue creado exitosamente');
      
      if (onVenueCreated) {
        onVenueCreated(response.data || response);
      }
      
      form.resetFields();
    } catch (error) {
      console.error('Error creando venue:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error desconocido';
      message.error('Error al crear el venue: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card bordered={false}>
      <Title level={4} style={{ marginBottom: 24 }}>Nuevo Venue</Title>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ country: 'Argentina' }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="name"
              label="Nombre del Venue"
              rules={[{ required: true, message: 'El nombre es obligatorio' }]}
            >
              <Input placeholder="Ej: Teatro Gran Rex" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="address"
              label="Dirección"
              rules={[{ required: true, message: 'La dirección es obligatoria' }]}
            >
              <Input placeholder="Ej: Av. Corrientes 857" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="city"
              label="Ciudad"
              rules={[{ required: true, message: 'La ciudad es obligatoria' }]}
            >
              <Input placeholder="Ej: CABA" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="state"
              label="Provincia/Estado"
            >
              <Input placeholder="Ej: Buenos Aires" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="max_capacity"
              label="Capacidad Máxima"
              rules={[{ required: true, message: 'Ingresa la capacidad' }]}
            >
              <InputNumber style={{ width: '100%' }} min={1} placeholder="Ej: 3200" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="country"
              label="País"
            >
              <Input placeholder="Ej: Argentina" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {onCancel && (
            <Button onClick={onCancel} icon={<ArrowLeftOutlined />}>
              Cancelar
            </Button>
          )}
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading} 
            icon={<SaveOutlined />}
            size="large"
            style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none'
            }}
          >
            Guardar Venue
          </Button>
        </div>
      </Form>
    </Card>
  );
}
