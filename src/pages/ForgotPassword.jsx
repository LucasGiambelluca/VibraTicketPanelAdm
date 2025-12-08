import React, { useState } from 'react';
import { Card, Typography, Form, Input, Button, Steps, message, Alert, Statistic } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, ArrowLeftOutlined, MailOutlined, NumberOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/apiService';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Countdown } = Statistic;

export default function ForgotPassword() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [error, setError] = useState(null);
  const [deadline, setDeadline] = useState(0);
  
  const [formEmail] = Form.useForm();
  const [formCode] = Form.useForm();
  const [formPassword] = Form.useForm();
  
  const navigate = useNavigate();

  // Paso 1: Solicitar código
  const handleRequestCode = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.requestPasswordReset(values.email);
      const data = response.data || response;
      
      setEmail(values.email);
      message.success('¡Código enviado! Revisa tu correo.');
      
      // Configurar cuenta regresiva (60 segundos o lo que diga el backend)
      const expiresIn = data.expiresIn || 60;
      setDeadline(Date.now() + expiresIn * 1000);
      
      setCurrentStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el código. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Verificar código
  const handleVerifyCode = async (values) => {
    setLoading(true);
    setError(null);
    try {
      // Opcional: Verificar código antes de pasar al siguiente paso
      // Si el backend lo permite, podemos saltar directo al paso 3 y enviar todo junto
      // Pero apiService tiene verifyResetCode, así que lo usaremos
      await authApi.verifyResetCode(email, values.code);
      
      setResetCode(values.code);
      message.success('Código verificado correctamente.');
      setCurrentStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Código inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: Cambiar contraseña
  const handleResetPassword = async (values) => {
    setLoading(true);
    setError(null);
    try {
      if (values.password !== values.confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }

      await authApi.resetPasswordWithCode(email, resetCode, values.password);
      
      message.success('¡Contraseña actualizada! Inicia sesión con tu nueva clave.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {
    setError('Por favor completa todos los campos requeridos.');
  };

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 450,
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: 'none'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <SafetyOutlined style={{ fontSize: 48, color: '#1e3c72', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 8 }}>Recuperar Contraseña</Title>
          <Text type="secondary">Sigue los pasos para restablecer tu acceso</Text>
        </div>

        <Steps current={currentStep} size="small" style={{ marginBottom: 32 }}>
          <Step title="Email" />
          <Step title="Código" />
          <Step title="Nueva Clave" />
        </Steps>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* PASO 1: EMAIL */}
        {currentStep === 0 && (
          <Form
            form={formEmail}
            layout="vertical"
            onFinish={handleRequestCode}
            onFinishFailed={onFinishFailed}
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Ingresa tu email' },
                { type: 'email', message: 'Email inválido' }
              ]}
            >
              <Input 
                prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="tu@email.com"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading}>
              Enviar Código
            </Button>
          </Form>
        )}

        {/* PASO 2: CÓDIGO */}
        {currentStep === 1 && (
          <Form
            form={formCode}
            layout="vertical"
            onFinish={handleVerifyCode}
            size="large"
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text>Hemos enviado un código de 6 dígitos a:</Text>
              <br />
              <Text strong>{email}</Text>
            </div>

            <Form.Item
              name="code"
              rules={[
                { required: true, message: 'Ingresa el código' },
                { len: 6, message: 'El código debe tener 6 dígitos' }
              ]}
              style={{ textAlign: 'center' }}
            >
              <Input 
                prefix={<NumberOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="123456"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
              />
            </Form.Item>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>El código expira en: </Text>
              <Countdown 
                value={deadline} 
                format="mm:ss" 
                valueStyle={{ fontSize: 14, color: '#cf1322' }}
                onFinish={() => setError('El código ha expirado. Por favor solicita uno nuevo.')}
              />
            </div>

            <Button type="primary" htmlType="submit" block loading={loading}>
              Verificar Código
            </Button>
            
            <Button 
              type="link" 
              block 
              onClick={() => setCurrentStep(0)}
              style={{ marginTop: 8 }}
            >
              Cambiar Email / Reenviar
            </Button>
          </Form>
        )}

        {/* PASO 3: NUEVA CONTRASEÑA */}
        {currentStep === 2 && (
          <Form
            form={formPassword}
            layout="vertical"
            onFinish={handleResetPassword}
            size="large"
          >
            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Ingresa tu nueva contraseña' },
                { min: 6, message: 'Mínimo 6 caracteres' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Nueva contraseña"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Confirma tu contraseña' },
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
                placeholder="Confirmar contraseña"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading}>
              Restablecer Contraseña
            </Button>
          </Form>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Link to="/login" style={{ color: '#595959' }}>
            <ArrowLeftOutlined /> Volver al Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
