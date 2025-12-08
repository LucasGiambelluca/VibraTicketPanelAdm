import React, { useState, useEffect } from 'react';
import { Card, Button, Upload, message, Row, Col, Typography, Spin, Modal, Image } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { eventImagesApi } from '../services/apiService';
import { getImageUrl } from '../utils/imageUtils';

const { Title, Text } = Typography;

const IMAGE_TYPES = [
  { key: 'cover_square', label: 'Cover Square', size: '300x300', description: 'Para listados en grilla' },
  { key: 'cover_horizontal', label: 'Cover Horizontal', size: '626x300', description: 'Para tarjetas horizontales' },
  { key: 'banner_main', label: 'Banner Principal', size: '1620x720', description: 'Banner grande en detalle' },
  { key: 'banner_alt', label: 'Banner Alternativo', size: '1620x700', description: 'Banner secundario' }
];

export default function EventImageUpload({ eventId, showExisting = true, allowUpload = true }) {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({});

  const fetchImages = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const response = await eventImagesApi.getEventImages(eventId);
      // El backend devuelve un objeto con las URLs de las imágenes
      const imagesData = response.data || response;
      setImages(imagesData || {});
    } catch (error) {
      console.error('Error fetching images:', error);
      message.error('Error al cargar imágenes actuales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [eventId]);

  const handleUpload = async (type, file) => {
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      
      const formData = new FormData();
      formData.append('image', file); // El backend espera 'image' como key para single upload

      await eventImagesApi.uploadSingleImage(eventId, type, formData);
      
      message.success(`${type} subida correctamente`);
      await fetchImages(); // Recargar para ver la nueva URL
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      message.error(`Error al subir ${type}`);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
    return false; // Prevent default upload behavior
  };

  const handleDelete = async (type) => {
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      await eventImagesApi.deleteEventImage(eventId, type);
      message.success('Imagen eliminada');
      await fetchImages();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      message.error('Error al eliminar imagen');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div style={{ padding: '10px 0' }}>
      {loading && !Object.keys(images).length ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Cargando imágenes...</Text>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {IMAGE_TYPES.map((type) => {
            const imageUrl = images[type.key];
            const isUploading = uploading[type.key];

            return (
              <Col xs={24} sm={12} lg={6} key={type.key}>
                <Card 
                  size="small" 
                  title={type.label} 
                  extra={<Text type="secondary" style={{ fontSize: 11 }}>{type.size}</Text>}
                  bodyStyle={{ padding: 0 }}
                >
                  <div style={{ 
                    height: 180, 
                    background: '#f5f5f5', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    {imageUrl ? (
                      <Image
                        src={getImageUrl(imageUrl)}
                        alt={type.label}
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        height={180}
                        width="100%"
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <Text type="secondary" style={{ display: 'block' }}>Sin imagen</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{type.description}</Text>
                      </div>
                    )}
                    
                    {isUploading && (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}>
                        <Spin />
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {allowUpload && (
                      <Upload
                        beforeUpload={(file) => handleUpload(type.key, file)}
                        showUploadList={false}
                        disabled={isUploading}
                        accept="image/*"
                      >
                        <Button 
                          icon={<UploadOutlined />} 
                          size="small" 
                          loading={isUploading}
                        >
                          {imageUrl ? 'Cambiar' : 'Subir'}
                        </Button>
                      </Upload>
                    )}

                    {imageUrl && allowUpload && (
                      <Button 
                        danger 
                        type="text" 
                        icon={<DeleteOutlined />} 
                        size="small"
                        onClick={() => handleDelete(type.key)}
                        loading={isUploading}
                      />
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
