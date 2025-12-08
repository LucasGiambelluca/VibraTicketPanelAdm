import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  DatePicker, 
  Button, 
  message, 
  Row, 
  Col, 
  Typography,
  Divider,
  Tooltip
} from 'antd';
import { SaveOutlined, TagOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { discountService } from '../../services/discountService';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

export default function DiscountCodeForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [discountType, setDiscountType] = useState('PERCENTAGE');

  const onFinish = async (values) => {
    try {
      setLoading(true);
      
      const discountData = {
        code: values.code.toUpperCase(),
        description: values.description,
        discountType: values.discountType,
        discountValue: values.discountValue,
        minimumPurchase: values.minimumPurchase,
        usageLimit: values.usageLimit,
        userUsageLimit: values.userUsageLimit,
        validFrom: values.validity ? values.validity[0].toISOString() : null,
        validUntil: values.validity ? values.validity[1].toISOString() : null,
        isActive: true
      };

      // Si es porcentaje, añadir tope de reintegro si existe
      if (values.discountType === 'PERCENTAGE' && values.maxDiscountAmount) {
        discountData.maxDiscountAmount = values.maxDiscountAmount;
      }

      await discountService.create(discountData);
      
      message.success('Código de descuento creado exitosamente');
      navigate('/admin/discounts'); // Asumiendo que existe esta ruta
      
    } catch (error) {
      console.error('Error creando descuento:', error);
      message.error('Error al crear el código: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <TagOutlined style={{ fontSize: 24, marginRight: 12, color: '#667eea' }} />
          <Title level={2} style={{ margin: 0 }}>Nuevo Código de Descuento</Title>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            discountType: 'PERCENTAGE',
            userUsageLimit: 1
          }}
          onValuesChange={(changedValues) => {
            if (changedValues.discountType) {
              setDiscountType(changedValues.discountType);
            }
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Código"
                rules={[
                  { required: true, message: 'El código es obligatorio' },
                  { pattern: /^[A-Z0-9]+$/, message: 'Solo mayúsculas y números' }
                ]}
                extra="Ej: VERANO2025 (Solo mayúsculas y números)"
              >
                <Input prefix={<TagOutlined />} placeholder="CÓDIGO" size="large" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="description"
                label="Descripción Interna"
                rules={[{ required: true, message: 'La descripción es obligatoria' }]}
              >
                <Input placeholder="Ej: Descuento para campaña de verano" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Configuración del Beneficio</Divider>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="discountType"
                label="Tipo de Descuento"
                rules={[{ required: true }]}
              >
                <Select size="large">
                  <Option value="PERCENTAGE">Porcentaje (%)</Option>
                  <Option value="FIXED_AMOUNT">Monto Fijo ($)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="discountValue"
                label={discountType === 'PERCENTAGE' ? "Porcentaje de Descuento" : "Monto a Descontar"}
                rules={[
                  { required: true, message: 'El valor es obligatorio' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (getFieldValue('discountType') === 'PERCENTAGE' && (value < 1 || value > 100)) {
                        return Promise.reject(new Error('El porcentaje debe estar entre 1 y 100'));
                      }
                      if (value <= 0) {
                        return Promise.reject(new Error('El valor debe ser mayor a 0'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  size="large"
                  formatter={value => discountType === 'PERCENTAGE' ? `${value}%` : `$ ${value}`}
                  parser={value => value.replace(/[%$ ]/g, '')}
                />
              </Form.Item>
            </Col>
            {discountType === 'PERCENTAGE' && (
              <Col span={8}>
                <Form.Item
                  name="maxDiscountAmount"
                  label={
                    <span>
                      Tope de Reintegro <Tooltip title="Monto máximo a descontar por compra"><InfoCircleOutlined /></Tooltip>
                    </span>
                  }
                >
                  <InputNumber 
                    style={{ width: '100%' }} 
                    size="large"
                    prefix="$"
                    placeholder="Opcional"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Divider>Restricciones y Límites</Divider>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="minimumPurchase"
                label="Compra Mínima"
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  size="large"
                  prefix="$"
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="usageLimit"
                label="Límite Total de Usos"
                rules={[{ type: 'number', min: 1, message: 'Debe ser mayor a 0' }]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  size="large"
                  placeholder="Ej: 100"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="userUsageLimit"
                label="Límite por Usuario"
                rules={[{ required: true, type: 'number', min: 1 }]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="validity"
                label="Vigencia"
                rules={[{ required: true, message: 'Selecciona el rango de fechas' }]}
              >
                <RangePicker 
                  showTime 
                  format="YYYY-MM-DD HH:mm" 
                  style={{ width: '100%' }} 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Button onClick={() => navigate('/admin/discounts')} style={{ marginRight: 12 }} size="large">
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} size="large">
              Crear Código
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
