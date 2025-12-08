import React from 'react';
import { Button, Tag, Space } from 'antd';

/**
 * MobileCardItem - Componente de card responsive para reemplazar tablas en móvil
 * Cards anchas > altas, sin scroll horizontal
 */
export default function MobileCardItem({ 
  title, 
  badge, 
  details = [], 
  actions = [],
  onClick 
}) {
  return (
    <div 
      className="mobile-item-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Header: Título + Badge/Estado */}
      {(title || badge) && (
        <div className="mobile-card-header">
          {title && <h3 className="mobile-card-title">{title}</h3>}
          {badge && <div className="mobile-card-badge">{badge}</div>}
        </div>
      )}

      {/* Details: Grid 2 columnas */}
      {details.length > 0 && (
        <div className="mobile-card-details">
          {details.map((detail, index) => (
            <div key={index} className="mobile-card-detail-item">
              <span className="mobile-card-detail-label">{detail.label}</span>
              <span className="mobile-card-detail-value">{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions: Botones */}
      {actions.length > 0 && (
        <div className="mobile-card-actions">
          {actions.map((action, index) => (
            <Button
              key={index}
              {...action}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
