import React from 'react';
import { List, Typography } from 'antd';

export default function SectorList({ sectors, activeSectorId, onSelect }) {
  return (
    <List
      size="small"
      header={<Typography.Text strong>Sectores ({sectors.length})</Typography.Text>}
      dataSource={sectors}
      renderItem={(s) => (
        <List.Item
          onClick={() => onSelect(s.id)}
          style={{ cursor: 'pointer', background: s.id === activeSectorId ? '#f3f7ff' : undefined, paddingInline: 8 }}
        >
          <span>{s.name}</span>
          <span style={{ color: s.kind === 'SEATED' ? '#007AFF' : '#00B69B' }}>{s.kind}</span>
        </List.Item>
      )}
    />
  );
}
