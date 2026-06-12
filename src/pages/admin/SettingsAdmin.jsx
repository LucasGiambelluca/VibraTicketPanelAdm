import React, { useState, useEffect } from 'react';
import {
  Card, Input, InputNumber, Button, Tag, Typography, Space, message, Spin, Alert,
} from 'antd';
import { GoogleOutlined, DollarOutlined, SaveOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

export default function SettingsAdmin() {
  const [loading, setLoading] = useState(true);

  // Google Client ID
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);

  // Tarifa de servicio (en centavos en la API; se edita en pesos)
  const [fixedFeePesos, setFixedFeePesos] = useState(0);
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [googleRes, feeRes] = await Promise.allSettled([
          adminApi.getGoogleClientId(),
          adminApi.getFixedFee(),
        ]);
        if (googleRes.status === 'fulfilled') {
          const d = googleRes.value.data;
          setGoogleClientId(d.googleClientId || '');
          setGoogleConfigured(!!d.isConfigured);
        }
        if (feeRes.status === 'fulfilled') {
          setFixedFeePesos((Number(feeRes.value.data.fixedFeeCents) || 0) / 100);
        }
      } catch (e) {
        console.error('Error cargando configuración:', e);
        message.error('No se pudo cargar la configuración');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveGoogle = async () => {
    setSavingGoogle(true);
    try {
      const { data } = await adminApi.setGoogleClientId(googleClientId.trim());
      setGoogleConfigured(!!data.isConfigured);
      message.success(
        data.isConfigured
          ? 'Client ID guardado — el botón de Google ya está activo en el sitio'
          : 'Login con Google desactivado'
      );
    } catch (e) {
      message.error(e.response?.data?.message || 'Error guardando el Client ID');
    } finally {
      setSavingGoogle(false);
    }
  };

  const saveFee = async () => {
    setSavingFee(true);
    try {
      await adminApi.setFixedFee(Math.round((fixedFeePesos || 0) * 100));
      message.success('Tarifa de servicio guardada');
    } catch (e) {
      message.error(e.response?.data?.message || 'Error guardando la tarifa');
    } finally {
      setSavingFee(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div>
      <Title level={3}>Configuración</Title>

      <Card
        title={
          <Space>
            <GoogleOutlined />
            Login con Google
            <Tag color={googleConfigured ? 'green' : 'default'}>
              {googleConfigured ? 'Activo' : 'No configurado'}
            </Tag>
          </Space>
        }
        style={{ marginBottom: 16, maxWidth: 720 }}
      >
        <Paragraph type="secondary">
          Pegá el OAuth Client ID de Google Cloud Console (tipo &quot;Aplicación
          web&quot;, origen autorizado <Text code>https://vibratickets.com</Text>).
          Se aplica al instante en el sitio, sin redeploy. Dejarlo vacío desactiva
          el botón de Google.
        </Paragraph>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            onPressEnter={saveGoogle}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingGoogle}
            onClick={saveGoogle}
          >
            Guardar
          </Button>
        </Space.Compact>
      </Card>

      <Card
        title={
          <Space>
            <DollarOutlined />
            Tarifa de servicio
          </Space>
        }
        style={{ marginBottom: 16, maxWidth: 720 }}
      >
        <Paragraph type="secondary">
          Cargo fijo por ticket que se suma al precio en el checkout online.
        </Paragraph>
        <Space>
          <InputNumber
            min={0}
            step={50}
            precision={2}
            prefix="$"
            value={fixedFeePesos}
            onChange={(v) => setFixedFeePesos(v || 0)}
            style={{ width: 160 }}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingFee}
            onClick={saveFee}
          >
            Guardar
          </Button>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ maxWidth: 720 }}
        message="Las credenciales de MercadoPago se gestionan en su propia sección del menú."
      />
    </div>
  );
}
