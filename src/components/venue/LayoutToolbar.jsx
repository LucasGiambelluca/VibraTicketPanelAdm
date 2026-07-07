import React from 'react';
import { Space, Button, Tooltip, Upload } from 'antd';

const TOOLS = [
  { key: 'select', label: 'Seleccionar' },
  { key: 'draw', label: 'Dibujar sector' },
  { key: 'edit', label: 'Mover vértices' },
  { key: 'delete', label: 'Borrar' },
];

export default function LayoutToolbar({ tool, onToolChange, onUploadImage }) {
  return (
    <Space>
      {TOOLS.map((t) => (
        <Tooltip key={t.key} title={t.label}>
          <Button type={tool === t.key ? 'primary' : 'default'} onClick={() => onToolChange(t.key)}>
            {t.label}
          </Button>
        </Tooltip>
      ))}
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={(file) => { onUploadImage(file); return false; }}
      >
        <Button>Subir imagen de fondo</Button>
      </Upload>
    </Space>
  );
}
