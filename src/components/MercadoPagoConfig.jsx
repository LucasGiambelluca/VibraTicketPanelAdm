import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Switch, 
  message, 
  Space, 
  Alert,
  Divider,
  Typography,
  Spin,
  Tag,
  Tooltip
} from 'antd';
import { 
  DollarOutlined, 
  SaveOutlined, 
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { adminApi } from '../services/apiService';

const { Title, Text, Paragraph } = Typography;

export default function MercadoPagoConfig() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [config, setConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getMercadoPagoConfig();

      // Extract config from response (handle different response structures)
      const configData = response?.data?.data || response?.data || response;
      setConfig(configData);

      // Set form values (mask sensitive data)
      form.setFieldsValue({
        accessToken: configData.accessToken && configData.accessToken !== '' ? '••••••••' : '',
        publicKey: configData.publicKey || '',
        webhookSecret: configData.webhookSecret && configData.webhookSecret !== '' ? '••••••••' : '',
        isSandbox: configData.isSandbox || false
      });

      setIsActive(configData.isConfigured && configData.isActive);
    } catch (error) {
      console.error('Error loading MercadoPago config:', error);
      if (error.response?.status !== 404) {
        message.error('Error al cargar configuración de MercadoPago');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      
      const configData = {
        accessToken: values.accessToken !== '••••••••' ? values.accessToken : undefined,
        publicKey: values.publicKey,
        webhookSecret: values.webhookSecret !== '••••••••' ? values.webhookSecret : undefined,
        isSandbox: values.isSandbox
      };

      // Remove undefined fields
      Object.keys(configData).forEach(key => 
        configData[key] === undefined && delete configData[key]
      );

      await adminApi.setMercadoPagoConfig(configData);
      message.success('Configuración guardada correctamente');
      setTestResult(null); // Clear previous test results
      await loadConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      message.error(error.response?.data?.message || 'Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const response = await adminApi.testMercadoPagoConnection();
      
      const result = response?.data || response;
      setTestResult({
        success: true,
        message: result.message || 'Conexión exitosa con MercadoPago',
        accountInfo: result.accountInfo
      });
      message.success('Conexión exitosa con MercadoPago');
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al probar conexión'
      });
      message.error('Error al probar conexión con MercadoPago');
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (checked) => {
    try {
      setToggling(true);
      await adminApi.toggleMercadoPago(checked);
      setIsActive(checked);
      message.success(`Pagos ${checked ? 'activados' : 'desactivados'} correctamente`);
    } catch (error) {
      console.error('Error toggling MercadoPago:', error);
      message.error(error.response?.data?.message || 'Error al cambiar estado');
      setIsActive(!checked); // Revert on error
    } finally {
      setToggling(false);
    }
  };

  if (loading && !config) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>Cargando configuración...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      style={{ maxWidth: 900, margin: '0 auto' }}
      className="glass-card"
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#fff' }}>
              <DollarOutlined style={{ marginRight: 12, color: '#667eea' }} />
              Configuración de MercadoPago
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
              Configura tus credenciales para procesar pagos de forma segura
            </Text>
          </div>
          {config?.isConfigured && (
            <Tooltip title={isActive ? 'Desactivar pagos' : 'Activar pagos'}>
              <Switch
                checked={isActive}
                loading={toggling}
                onChange={handleToggle}
                checkedChildren="Activo"
                unCheckedChildren="Inactivo"
                size="default"
                style={{ marginLeft: 16 }}
              />
            </Tooltip>
          )}
        </div>
      </div>

      <Alert
        message={
          <div>
            <InfoCircleOutlined /> Información Importante
          </div>
        }
        description={
          <div>
            <Paragraph style={{ marginBottom: 8 }}>
              Necesitas configurar los siguientes valores desde tu cuenta de MercadoPago:
            </Paragraph>
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li><strong>Access Token:</strong> Credencial privada (empieza con APP_USR- o TEST-)</li>
              <li><strong>Public Key:</strong> Cr edencial pública para frontend</li>
              <li><strong>Webhook Secret:</strong> <span style={{ color: '#ff4d4f' }}>Crítico para seguridad</span> - Valida que los webhooks vienen de MercadoPago</li>
            </ul>
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          isSandbox: false
        }}
      >
        <Form.Item
          label={
            <span>
              Access Token{' '}
              <Tooltip title="Tu Access Token privado de MercadoPago">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </span>
          }
          name="accessToken"
          rules={[
            { required: true, message: 'El Access Token es obligatorio' }
          ]}
          help="Debe empezar con APP_USR- (Producción) o TEST- (Sandbox)"
        >
          <Input.Password 
            placeholder="APP_USR-... o TEST-..." 
            size="large"
            disabled={loading}
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              Public Key{' '}
              <Tooltip title="Tu Public Key para el frontend">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </span>
          }
          name="publicKey"
          help="Debe empezar con APP_USR- o TEST-"
        >
          <Input 
            placeholder="APP_USR-... o TEST-..." 
            size="large"
            disabled={loading}
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              Webhook Secret{' '}
              <Tag color="red">CRÍTICO</Tag>
              <Tooltip title="Se obtiene del panel de desarrolladores de MercadoPago, sección Webhooks. Valida que las notificaciones de pago son auténticas.">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            </span>
          }
          name="webhookSecret"
          rules={[
            { required: true, message: 'El Webhook Secret es obligatorio para seguridad' }
          ]}
          help="Obténlo del panel de MercadoPago > Webhooks"
        >
          <Input.Password 
            placeholder="your_webhook_secret_from_mp" 
            size="large"
            disabled={loading}
          />
        </Form.Item>

        <Divider />

        <Form.Item
          label={
            <span>
              Modo Sandbox{' '}
              <ExperimentOutlined style={{ color: '#faad14' }} />
            </span>
          }
          name="isSandbox"
          valuePropName="checked"
          help="Activa esto para usar el entorno de pruebas de MercadoPago"
        >
          <Switch
            checkedChildren="Sandbox"
            unCheckedChildren="Producción"
            disabled={loading}
          />
        </Form.Item>

        {testResult && (
          <Alert
            message={testResult.success ? 'Prueba Exitosa' : 'Prueba Fallida'}
            description={
              <div>
                <div>{testResult.message}</div>
                {testResult.accountInfo && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      Cuenta: {testResult.accountInfo.nickname || testResult.accountInfo.siteId}
                    </Text>
                  </div>
                )}
              </div>
            }
            type={testResult.success ? 'success' : 'error'}
            showIcon
            icon={testResult.success ? <CheckCircleOutlined /> : <WarningOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none'
              }}
            >
              Guardar Configuración
            </Button>
            <Button
              onClick={handleTest}
              loading={testing}
              disabled={!config?.isConfigured && !form.getFieldValue('accessToken')}
              size="large"
            >
              Probar Conexión
            </Button>
            <Button
              onClick={loadConfig}
              disabled={loading}
              size="large"
            >
              Recargar
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
