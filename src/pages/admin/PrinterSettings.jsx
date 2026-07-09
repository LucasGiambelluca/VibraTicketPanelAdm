import React, { useEffect, useState, useCallback } from 'react';
import { Card, Select, Button, Space, Alert, Typography, message, Divider } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { isTauri, listPrinters, printTest, printTicket } from '../../lib/tauri';
import TicketDesigner from '../../components/admin/TicketDesigner';

const { Title, Text, Paragraph } = Typography;

// Clave de persistencia de la impresora elegida (reusable desde otros flujos).
export const SELECTED_PRINTER_KEY = 'vt_selected_printer';

export function getSelectedPrinter() {
  return localStorage.getItem(SELECTED_PRINTER_KEY) || '';
}

export default function PrinterSettings() {
  const desktop = isTauri();
  const [printers, setPrinters] = useState([]);
  const [selected, setSelected] = useState(getSelectedPrinter());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listPrinters();
      setPrinters(list);
      // Si no hay elegida, tomar la default del sistema.
      if (!getSelectedPrinter()) {
        const def = list.find((p) => p.is_default) || list[0];
        if (def) {
          setSelected(def.name);
          localStorage.setItem(SELECTED_PRINTER_KEY, def.name);
        }
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [desktop]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = (value) => {
    setSelected(value);
    localStorage.setItem(SELECTED_PRINTER_KEY, value);
  };

  const onTest = async () => {
    if (!selected) {
      message.warning('Elegí una impresora primero.');
      return;
    }
    setError(null);
    try {
      await printTest(selected);
      message.success('Ticket de prueba enviado.');
    } catch (e) {
      // Nunca tragar el error: mostrarlo explícito.
      const msg = String(e?.message || e);
      setError(msg);
      message.error(`No se pudo imprimir: ${msg}`);
    }
  };

  const onSampleTicket = async () => {
    if (!selected) {
      message.warning('Elegí una impresora primero.');
      return;
    }
    setError(null);
    try {
      await printTicket({
        printer: selected,
        title: 'EVENTO DE PRUEBA',
        lines: [
          { text: 'Sector: General', align: 'left' },
          { text: 'Fila: -  Asiento: -', align: 'left' },
          { text: 'Orden #DEMO-0001', align: 'left' },
        ],
        qr_data: 'VIBRATICKETS-DEMO-SIGNED-PAYLOAD',
        total_cents: 1500000, // $15.000,00 -> entero en centavos
        footer: 'Gracias por tu compra',
      });
      message.success('Ticket de muestra enviado.');
    } catch (e) {
      const msg = String(e?.message || e);
      setError(msg);
      message.error(`No se pudo imprimir: ${msg}`);
    }
  };

  if (!desktop) {
    return (
      <>
        <Card style={{ maxWidth: 720, margin: '24px auto' }}>
          <Title level={4}>
            <PrinterOutlined /> Impresora de tickets
          </Title>
          <Alert
            type="info"
            showIcon
            message="Solo en la app de escritorio"
            description="La impresión de tickets ESC/POS está disponible únicamente en la aplicación VibraTickets Admin para Windows/macOS, no en el navegador."
          />
        </Card>
        <Card
          title="Diseño del ticket impreso (default para todos los eventos)"
          style={{ maxWidth: 1100, margin: '16px auto 0' }}
        >
          <TicketDesigner />
        </Card>
      </>
    );
  }

  return (
    <>
      <Card style={{ maxWidth: 720, margin: '24px auto' }}>
        <Title level={4}>
          <PrinterOutlined /> Impresora de tickets
        </Title>
        <Paragraph type="secondary">
          Elegí la impresora térmica ESC/POS y probá la impresión antes de usarla en
          el flujo real.
        </Paragraph>

        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Seleccioná una impresora"
            value={selected || undefined}
            onChange={onSelect}
            loading={loading}
            options={printers.map((p) => ({
              value: p.name,
              label: p.is_default ? `${p.name}  (predeterminada)` : p.name,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            Actualizar
          </Button>
        </Space.Compact>

        <Divider />

        <Space wrap>
          <Button type="default" icon={<PrinterOutlined />} onClick={onTest} disabled={!selected}>
            Imprimir ticket de prueba
          </Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={onSampleTicket} disabled={!selected}>
            Imprimir ticket de muestra
          </Button>
        </Space>

        {error && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            message="Error de impresión"
            description={error}
            closable
            onClose={() => setError(null)}
          />
        )}

        {printers.length === 0 && !loading && !error && (
          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="No se detectaron impresoras"
            description="Conectá una impresora y tocá Actualizar."
          />
        )}

        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          El contenido firmado del QR lo genera el backend; el desktop solo lo imprime.
        </Text>
      </Card>

      <Card
        title="Diseño del ticket impreso (default para todos los eventos)"
        style={{ maxWidth: 1100, margin: '16px auto 0' }}
      >
        <TicketDesigner />
      </Card>
    </>
  );
}
