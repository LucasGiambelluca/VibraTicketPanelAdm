import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Select, Space, ColorPicker, Divider, Button, message, Spin, Input } from 'antd';
import { BgColorsOutlined, FontColorsOutlined, FontSizeOutlined, CalendarOutlined } from '@ant-design/icons';
import { eventStylesApi } from '../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Fuentes disponibles (Google Fonts populares)
const FONT_OPTIONS = [
  { label: 'Por defecto (Sistema)', value: 'inherit', style: 'inherit' },
  { label: 'Roboto (Moderna)', value: '"Roboto", sans-serif', style: 'Roboto, sans-serif' },
  { label: 'Montserrat (Elegante)', value: '"Montserrat", sans-serif', style: 'Montserrat, sans-serif' },
  { label: 'Playfair Display (Clásica)', value: '"Playfair Display", serif', style: 'Playfair Display, serif' },
  { label: 'Poppins (Friendly)', value: '"Poppins", sans-serif', style: 'Poppins, sans-serif' },
  { label: 'Lato (Profesional)', value: '"Lato", sans-serif', style: 'Lato, sans-serif' },
  { label: 'Raleway (Fina)', value: '"Raleway", sans-serif', style: 'Raleway, sans-serif' },
  { label: 'Oswald (Bold)', value: '"Oswald", sans-serif', style: 'Oswald, sans-serif' },
  { label: 'Source Sans Pro (Limpia)', value: '"Source Sans Pro", sans-serif', style: 'Source Sans Pro, sans-serif' },
  { label: 'Open Sans (Universal)', value: '"Open Sans", sans-serif', style: 'Open Sans, sans-serif' }
];

/**
 * Componente para editar el estilo visual de un evento
 * @param {Object} props
 * @param {Object} props.initialStyles - Estilos iniciales { primary_color, secondary_color, text_color, font_family }
 * @param {Function} props.onChange - Callback cuando cambian los estilos
 * @param {boolean} props.showPreview - Mostrar preview de la card
 */
export default function EventStyleEditor({ 
  initialStyles = {}, 
  onChange = null,
  showPreview = true
}) {
  const [styles, setStyles] = useState({
    primary_color: initialStyles.primary_color || '#4F46E5',
    secondary_color: initialStyles.secondary_color || '#818CF8',
    text_color: initialStyles.text_color || '#1F2937',
    font_family: initialStyles.font_family || 'inherit',
    description: initialStyles.description || ''
  });
  
  // Estado para paletas del backend
  const [palettes, setPalettes] = useState([]);
  const [loadingPalettes, setLoadingPalettes] = useState(true);

  // Cargar paletas desde el backend
  useEffect(() => {
    const loadPalettes = async () => {
      try {
        setLoadingPalettes(true);
        const response = await eventStylesApi.getPalettes();
        
        // Extracción segura de datos
        let palettesData = [];
        if (Array.isArray(response)) {
          palettesData = response;
        } else if (response && Array.isArray(response.palettes)) {
          palettesData = response.palettes;
        } else if (response && Array.isArray(response.data)) {
          palettesData = response.data;
        }
        
        setPalettes(palettesData);
      } catch (error) {
        console.error('Error cargando paletas:', error);
        // No mostrar error al usuario si es solo un fallo de carga de presets
        setPalettes([]); 
      } finally {
        setLoadingPalettes(false);
      }
    };
    
    loadPalettes();
  }, []);

  // Cargar Google Fonts dinámicamente
  useEffect(() => {
    const fontFamilies = FONT_OPTIONS
      .filter(f => f.value !== 'inherit')
      .map(f => f.value.replace(/"/g, '').split(',')[0])
      .join('|');
    
    if (fontFamilies) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies.split('|').join('&family=')}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      return () => {
        // No remover el link al desmontar para evitar re-cargas
      };
    }
  }, []);

  // Notificar cambios al padre
  useEffect(() => {
    if (onChange) {
      onChange(styles);
    }
  }, [styles, onChange]);

  const handleColorChange = (key, color) => {
    // Extraer el valor hex del ColorPicker de Ant Design
    let hexColor;
    if (typeof color === 'string') {
      hexColor = color;
    } else if (color && typeof color.toHexString === 'function') {
      hexColor = color.toHexString();
    } else if (color && color.metaColor && color.metaColor.toHexString) {
      hexColor = color.metaColor.toHexString();
    } else {
      hexColor = '#4F46E5'; // Fallback
    }
    
    setStyles(prev => {
      const newStyles = { ...prev, [key]: hexColor };
      return newStyles;
    });
  };

  const handleFontChange = (fontFamily) => {
    setStyles(prev => ({ ...prev, font_family: fontFamily }));
  };

  const applyPreset = (paletteId) => {
    const palette = palettes.find(p => p.id === paletteId);
    if (palette) {
      setStyles(prev => ({
        ...prev,
        primary_color: palette.primary_color,
        secondary_color: palette.secondary_color,
        text_color: palette.text_color,
        font_family: palette.font_family || prev.font_family
      }));
      message.success(`Paleta "${palette.name}" aplicada`);
    }
  };
  
  const handleDescriptionChange = (e) => {
    const description = e.target.value;
    setStyles(prev => ({ ...prev, description }));
  };

  return (
    <div>
      <Title level={4}>
        <BgColorsOutlined /> Personalización Visual
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Personalizá el estilo visual de tu evento para destacarlo y darle personalidad única.
      </Text>

      <Row gutter={[16, 16]}>
        {/* Descripción del Evento */}
        <Col xs={24}>
          <Card size="small" title="📝 Descripción del Evento">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Descripción Larga
              </Text>
              <TextArea
                value={styles.description}
                onChange={handleDescriptionChange}
                placeholder="Agrega una descripción detallada del evento. Esta se mostrará en las cards y en la página de detalle."
                rows={4}
                maxLength={65535}
                showCount
                style={{ marginBottom: 8 }}
              />
              <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                La descripción se truncará automáticamente en las vistas de listado.
              </Text>
            </div>
          </Card>
        </Col>
        
        {/* Selección de Colores */}
        <Col xs={24} lg={12}>
          <Card size="small" title="🎨 Colores del Evento">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              
              {/* Paletas Predefinidas */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Paletas Rápidas
                </Text>
                {loadingPalettes ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                      Cargando paletas...
                    </Text>
                  </div>
                ) : (
                  <Select
                    placeholder="Elegir paleta predefinida"
                    style={{ width: '100%' }}
                    onChange={applyPreset}
                    allowClear
                  >
                    {Array.isArray(palettes) && palettes.map(palette => (
                      <Option key={palette.id} value={palette.id}>
                        <Space>
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            background: `linear-gradient(90deg, ${palette.primary_color}, ${palette.secondary_color})`
                          }} />
                          {palette.emoji} {palette.name}
                          {palette.category && (
                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                              ({palette.category})
                            </Text>
                          )}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                )}
              </div>

              <Divider style={{ margin: '8px 0' }}>O elegí colores personalizados</Divider>

              {/* Color Primario */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Color Primario
                </Text>
                <Space>
                  <ColorPicker
                    value={styles.primary_color}
                    onChange={(color) => handleColorChange('primary_color', color)}
                    format="hex"
                    showText
                    size="large"
                  />
                  <Text type="secondary">Usado en botones y tags</Text>
                </Space>
              </div>

              {/* Color Secundario */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Color Secundario
                </Text>
                <Space>
                  <ColorPicker
                    value={styles.secondary_color}
                    onChange={(color) => handleColorChange('secondary_color', color)}
                    format="hex"
                    showText
                    size="large"
                  />
                  <Text type="secondary">Usado en degradados</Text>
                </Space>
              </div>

              {/* Color de Texto */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Color de Texto Principal
                </Text>
                <Space>
                  <ColorPicker
                    value={styles.text_color}
                    onChange={(color) => handleColorChange('text_color', color)}
                    format="hex"
                    showText
                    size="large"
                  />
                  <Text type="secondary">Título del evento</Text>
                </Space>
              </div>

            </Space>
          </Card>
        </Col>

        {/* Selección de Tipografía */}
        <Col xs={24} lg={12}>
          <Card size="small" title={<><FontSizeOutlined /> Tipografía</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Fuente del Evento
                </Text>
                <Select
                  value={styles.font_family}
                  onChange={handleFontChange}
                  style={{ width: '100%' }}
                  size="large"
                >
                  {FONT_OPTIONS.map(font => (
                    <Option key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.style }}>
                        {font.label}
                      </span>
                    </Option>
                  ))}
                </Select>
                <Text type="secondary" style={{ fontSize: '0.85rem', marginTop: 4, display: 'block' }}>
                  La fuente se aplicará al nombre del evento y botones
                </Text>
              </div>

              {/* Preview de la fuente */}
              <div style={{ 
                padding: 16, 
                background: '#F9FAFB', 
                borderRadius: 8,
                border: '1px dashed #D1D5DB'
              }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Vista previa de tipografía:
                </Text>
                <div style={{ fontFamily: styles.font_family, fontSize: '1.5rem', color: styles.text_color }}>
                  Nombre del Evento
                </div>
                <div style={{ fontFamily: styles.font_family, fontSize: '1rem', marginTop: 8 }}>
                  Comprar Entradas
                </div>
              </div>

            </Space>
          </Card>
        </Col>

        {/* Preview de la Card */}
        {showPreview && (
          <Col xs={24}>
            <Card size="small" title="👁️ Vista Previa de la Card">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                padding: '20px 0'
              }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 350,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    background: 'white',
                    border: `2px solid ${styles.primary_color}15`,
                    fontFamily: styles.font_family
                  }}
                >
                  {/* Imagen simulada */}
                  <div style={{ 
                    position: 'relative',
                    height: 200,
                    background: `linear-gradient(135deg, ${styles.primary_color}, ${styles.secondary_color})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: styles.primary_color,
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}>
                      Disponible
                    </div>
                    <Text style={{ color: 'white', fontSize: '1rem', opacity: 0.7 }}>
                      Imagen del Evento
                    </Text>
                  </div>

                  {/* Contenido */}
                  <div style={{ padding: '16px 20px' }}>
                    <Title 
                      level={4} 
                      style={{ 
                        marginBottom: 8,
                        color: styles.text_color,
                        fontFamily: styles.font_family,
                        fontSize: '1.25rem'
                      }}
                    >
                      Ejemplo de Evento
                    </Title>
                    
                    <Text 
                      type="secondary" 
                      style={{ 
                        fontSize: '0.875rem',
                        display: 'block',
                        marginBottom: 12
                      }}
                    >
                      Esta es una descripción de ejemplo para mostrar cómo se verá el texto...
                    </Text>

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: styles.primary_color,
                      marginBottom: 8,
                      fontWeight: 500
                    }}>
                      <CalendarOutlined style={{ marginRight: 8 }} />
                      <Text style={{ color: styles.primary_color }}>
                        25 de diciembre, 2025
                      </Text>
                    </div>

                    <Button
                      type="primary"
                      block
                      size="large"
                      style={{
                        borderRadius: 12,
                        fontWeight: 'bold',
                        background: `linear-gradient(90deg, ${styles.primary_color}, ${styles.secondary_color})`,
                        borderColor: 'transparent',
                        fontFamily: styles.font_family,
                        marginTop: 16
                      }}
                    >
                      Comprar Entradas
                    </Button>
                  </div>
                </div>
              </div>
              
              <Divider />
              
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">
                  💡 <strong>Tip:</strong> Los cambios se aplicarán automáticamente al evento
                </Text>
              </div>
            </Card>
          </Col>
        )}

      </Row>
    </div>
  );
}
