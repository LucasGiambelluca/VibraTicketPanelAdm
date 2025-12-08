import React, { useState } from 'react';
import { Card, Typography, Form, Input, Button, Checkbox, Space, message, Alert } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './AdminLogin.css';
import logo from '../assets/VibraTicketLogo.png';

const { Title, Text } = Typography;

export default function AdminLogin() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);
    
    try {
      // Llamar a la API de autenticación
      const user = await login({
        email: values.email,
        password: values.password
      });
      
      // Validar que el usuario tenga rol de ADMIN, ORGANIZER, PRODUCER o DOOR
      const allowedRoles = ['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR'];
      if (!allowedRoles.includes(user.role)) {
        setError('Este acceso es solo para administradores, organizadores y personal autorizado.');
        message.error('Acceso denegado. Usa el login de clientes.');
        
        // Hacer logout automático
        await logout();
        return;
      }
      
      // Mostrar mensaje de éxito
      message.success(`¡Bienvenido ${user.name || user.email}!`);
      
      // Redirigir al panel de administración
      navigate('/admin');
      
    } catch (error) {
      console.error('❌ Error en login:', error);
      
      // Mostrar error específico
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Error al iniciar sesión. Verifica tus credenciales.';
      
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <Card className="admin-login-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img 
            src={logo} 
            alt="VibraTicket" 
            className="admin-login-logo"
          />
          <SafetyOutlined className="admin-login-icon" />
          <Title level={2} className="admin-login-title">
            Portal de Administración
          </Title>
          <Text type="secondary" className="admin-login-subtitle">
            Acceso para Staff y Organizadores
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          {error && (
            <Alert
              message="Error de autenticación"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

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
              placeholder="admin@ticketera.com"
              className="admin-login-input"
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
              className="admin-login-input"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>Recordarme</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={loading}
              block
              className="admin-login-button"
            >
              Iniciar Sesión
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Space direction="vertical" size={8}>
              <Link to="/forgot-password" style={{ color: '#1890ff' }}>
                ¿Olvidaste tu contraseña?
              </Link>
              <Text type="secondary">
                ¿Eres cliente?{' '}
                <Link to="/customerlogin" style={{ color: '#1890ff', fontWeight: 600 }}>
                  Ingresa aquí
                </Link>
              </Text>
            </Space>
          </div>
        </Form>

      </Card>

      {/* Footer */}
      <div className="admin-login-footer">
        <Text className="admin-login-footer-text">
          © {new Date().getFullYear()} VibraTicket | Portal de Administración
        </Text>
      </div>
    </div>
  );
}
