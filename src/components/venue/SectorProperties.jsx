import React, { useEffect } from 'react';
import { Form, Input, Select, InputNumber, Button, Space, Typography } from 'antd';

// value: the sector being edited, or null for a new sector (then `geometry` prop carries the drawn polygon).
// onSave(body) -> { name, kind, geometry, defaultColor, defaultCapacity, defaultPriceCents, defaultRows }
export default function SectorProperties({ value, geometry, onSave, onDelete, saving }) {
  const [form] = Form.useForm();
  const isNew = !value?.id;

  useEffect(() => {
    form.setFieldsValue({
      name: value?.name ?? '',
      kind: value?.kind ?? 'GA',
      defaultColor: value?.defaultColor ?? '#00B69B',
      defaultCapacity: value?.defaultCapacity ?? 100,
      defaultPriceCents: value?.defaultPriceCents ? Number(value.defaultPriceCents) : 0,
      defaultRows: value?.defaultRows ?? null,
    });
  }, [value, form]);

  const submit = (vals) => {
    onSave({ ...vals, geometry: geometry ?? value?.geometry });
  };

  return (
    <Form form={form} layout="vertical" onFinish={submit}>
      <Typography.Text strong>{isNew ? 'Nuevo sector' : 'Editar sector'}</Typography.Text>
      <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="kind" label="Tipo" rules={[{ required: true }]}>
        <Select options={[{ value: 'GA', label: 'General' }, { value: 'SEATED', label: 'Numerado' }]} />
      </Form.Item>
      <Form.Item shouldUpdate noStyle>
        {() => form.getFieldValue('kind') === 'SEATED' && (
          <Form.Item name="defaultRows" label="Filas" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form.Item>
      <Form.Item name="defaultCapacity" label="Capacidad" rules={[{ required: true, type: 'number', min: 1 }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="defaultPriceCents" label="Precio (centavos)" rules={[{ required: true, type: 'number', min: 0 }]}>
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="defaultColor" label="Color">
        <Input type="color" style={{ width: 60 }} />
      </Form.Item>
      <Space>
        <Button type="primary" htmlType="submit" loading={saving}>Guardar</Button>
        {!isNew && <Button danger onClick={() => onDelete(value.id)}>Borrar</Button>}
      </Space>
    </Form>
  );
}
