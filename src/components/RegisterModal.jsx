import React, { useState } from 'react';
import { Modal, Form, Input, Button, Typography, message, Divider, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined, FacebookOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useRegisterModal } from '../contexts/RegisterModalContext';
import { useAuth } from '../hooks/useAuth';

const { Title, Text, Link } = Typography;

/**
 * Modal de Registro - Diseño responsive y centrado
 */
export default function RegisterModal() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isRegisterModalVisible, closeRegisterModal, handleRegisterSuccess } = useRegisterModal();
  const { register } = useAuth();

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      const user = await register({
        email: values.email,
        password: values.password,
        name: values.name,
        phone: values.phone
      });
      
      message.success(`¡Bienvenido ${user.name}! Tu cuenta ha sido creada.`);
      handleRegisterSuccess(user);
      form.resetFields();
    } catch (error) {
      console.error('❌ Error en registro:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Error al crear la cuenta. Por favor intenta nuevamente.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    closeRegisterModal();
  };

  return (
    <Modal
      open={isRegisterModalVisible}
      onCancel={handleCancel}
      footer={null}
      centered
      width={480}
      styles={{
        body: { 
          padding: '32px 24px',
          maxHeight: '80vh',
          overflowY: 'auto'
        }
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <UserOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
        <Title level={3} style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8
        }}>
          Crear Cuenta
        </Title>
        <Text type="secondary">Únete a VibraTicket</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        size="large"
      >
        <Form.Item
          label="Nombre completo"
          name="name"
          rules={[{ required: true, message: 'Ingrese su nombre' }]}
        >
          <Input 
            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Juan Pérez"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Ingrese su email' },
            { type: 'email', message: 'Email inválido' }
          ]}
        >
          <Input 
            prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="tu@email.com"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          label="Teléfono"
          name="phone"
        >
          <Input 
            prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="+54 9 11 1234-5678"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          label="Contraseña"
          name="password"
          rules={[
            { required: true, message: 'Ingrese una contraseña' },
            { min: 6, message: 'Mínimo 6 caracteres' }
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="••••••••"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          label="Confirmar contraseña"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Confirme su contraseña' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Las contraseñas no coinciden'));
              },
            }),
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="••••••••"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="terms"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject(new Error('Debe aceptar los términos')),
            },
          ]}
        >
          <Checkbox>
            Acepto los <Link style={{ color: '#667eea' }}>Términos y Condiciones</Link>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit"
            loading={loading}
            block
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              height: 48
            }}
          >
            Crear Cuenta
          </Button>
        </Form.Item>

        <Divider>O regístrate con</Divider>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Button 
            icon={<GoogleOutlined />} 
            block 
            style={{ borderRadius: 8, height: 40 }}
          >
            Google
          </Button>
          <Button 
            icon={<FacebookOutlined />} 
            block 
            style={{ borderRadius: 8, height: 40 }}
          >
            Facebook
          </Button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            ¿Ya tienes cuenta?{' '}
            <Link style={{ color: '#667eea', fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </Text>
        </div>
      </Form>
    </Modal>
  );
}
