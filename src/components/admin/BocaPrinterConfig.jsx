// Configuración de la impresora BOCA para la app de escritorio (Tauri).
// Persiste en localStorage.bocaConfig, que es lo que leen los comandos
// nativos boca_status/boca_print/boca_test (ver printAgentService.js).
// Sin esta pantalla la app queda clavada en el default (windows/\\localhost\BOCA)
// y nunca puede imprimir en una BOCA Ethernet.
import React, { useState } from 'react';
import { Radio, Input, InputNumber, Button, Space, Typography } from 'antd';
import { getBocaConfig, setBocaConfig } from '../../services/printAgentService';

const { Text } = Typography;

export default function BocaPrinterConfig({ onSaved }) {
  const [cfg, setCfg] = useState(getBocaConfig());

  const save = () => {
    setBocaConfig(cfg);
    onSaved?.();
  };

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Radio.Group
        value={cfg.transport}
        onChange={e => setCfg(c => ({ ...c, transport: e.target.value }))}
      >
        <Radio value="tcp">Ethernet (red)</Radio>
        <Radio value="windows">USB (impresora compartida)</Radio>
      </Radio.Group>

      {cfg.transport === 'tcp' && (
        <Space wrap>
          <Input
            aria-label="IP de la impresora"
            addonBefore="IP de la impresora"
            placeholder="ej. 10.0.0.192 (sale en el ticket del botón TEST)"
            style={{ width: 360 }}
            value={cfg.host}
            onChange={e => setCfg(c => ({ ...c, host: e.target.value.trim() }))}
          />
          <InputNumber
            aria-label="Puerto"
            addonBefore="Puerto"
            min={1}
            max={65535}
            value={cfg.port}
            onChange={v => setCfg(c => ({ ...c, port: v || 9100 }))}
          />
        </Space>
      )}

      {cfg.transport === 'windows' && (
        <Space direction="vertical" size={2}>
          <Input
            aria-label="Share de Windows"
            addonBefore="Share de Windows"
            placeholder="\\localhost\BOCA"
            style={{ width: 360 }}
            value={cfg.printer_share}
            onChange={e => setCfg(c => ({ ...c, printer_share: e.target.value.trim() }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            La impresora debe estar compartida en Windows con ese nombre
            (Propiedades → Compartir). El estado real se ve al imprimir la prueba.
          </Text>
        </Space>
      )}

      <Button type="primary" size="small" onClick={save}>
        Guardar y probar conexión
      </Button>
    </Space>
  );
}
