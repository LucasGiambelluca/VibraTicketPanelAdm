import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  DatePicker, 
  Button, 
  Typography, 
  message, 
  Alert,
  Spin
} from 'antd';
import { CalendarOutlined, SaveOutlined } from '@ant-design/icons';
import { useEvents } from '../hooks/useEvents';
import { showsApi } from '../services/apiService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CreateShow() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { events, loading: eventsLoading, error: eventsError } = useEvents({ limit: 100 });

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      
      const showData = {
        eventId: values.eventId,
        startsAt: values.startsAt.toISOString()
      };

      await showsApi.createShow(showData);
      
      message.success('Show creado exitosamente');
      form.resetFields();
      
    } catch (error) {
      console.error('Error creating show:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error al crear el show';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Card className="glass-card" bordered={false}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Title level={2}>
            <CalendarOutlined style={{ marginRight: 12, color: '#667eea' }} />
            Crear Nuevo Show
          </Title>
          <Text type="secondary">
            Programa una nueva fecha para un evento existente
          </Text>
        </div>

        {eventsError && (
          <Alert 
            message="Error cargando eventos" 
            description={eventsError} 
            type="error" 
            showIcon 
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="eventId"
            label="Seleccionar Evento"
            rules={[{ required: true, message: 'Por favor selecciona un evento' }]}
          >
            <Select
              placeholder="Busca un evento..."
              loading={eventsLoading}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              notFoundContent={eventsLoading ? <Spin size="small" /> : null}
            >
              {events.map(event => (
                <Option key={event.id} value={event.id}>
                  {event.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="startsAt"
            label="Fecha y Hora del Show"
            rules={[{ required: true, message: 'Por favor selecciona la fecha y hora' }]}
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm" 
              style={{ width: '100%' }} 
              placeholder="Selecciona fecha y hora"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              block
              icon={<SaveOutlined />}
              style={{ height: 48, fontSize: 16 }}
            >
              Crear Show
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
