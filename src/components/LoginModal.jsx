import React, { useState } from 'react';
import { Modal,  Form, Input, Button, Typography, message, Divider } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined, FacebookOutlined } from '@ant-design/icons';
import { useLoginModal } from '../contexts/LoginModalContext';
import { useAuth } from '../hooks/useAuth';

const { Title, Text, Link } = Typography;

/**
 * Modal de Login - Diseño responsive y centrado
 */
export default function LoginModal() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isLoginModalVisible, closeLoginModal, handleLoginSuccess } = useLoginModal();
  const { login } = useAuth();

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      const user = await login({
        email: values.email,
        password: values.password
      });
      
      message.success(`¡Bienvenido ${user.name || user.email}!`);
      
      // IMPORTANTE: Dar tiempo a que el estado se propague
      // antes de cerrar el modal y ejecutar callbacks
      await new Promise(resolve => setTimeout(resolve, 100));
      
      handleLoginSuccess(user);
      form.resetFields();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Error al iniciar sesión. Verifica tus credenciales.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    closeLoginModal();
  };

  return (
    <Modal
      open={isLoginModalVisible}
      onCancel={handleCancel}
      footer={null}
      centered
      width={420}
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
          Ingresar a VibraTicket
        </Title>
        <Text type="secondary">Accede a tu cuenta para continuar</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        size="large"
      >
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Ingrese su email' },
            { type: 'email', message: 'Email inválido' }
          ]}
        >
          <Input 
            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="tu@email.com"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          label="Contraseña"
          name="password"
          rules={[{ required: true, message: 'Ingrese su contraseña' }]}
        >
          <Input.Password 
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="••••••••"
            style={{ borderRadius: 8 }}
          />
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
            Iniciar Sesión
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Link style={{ color: '#667eea' }}>¿Olvidaste tu contraseña?</Link>
        </div>

        <Divider>O continúa con</Divider>

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
            ¿No tienes cuenta?{' '}
            <Link style={{ color: '#667eea', fontWeight: 600 }}>
              Regístrate aquí
            </Link>
          </Text>
        </div>
      </Form>
    </Modal>
  );
}
