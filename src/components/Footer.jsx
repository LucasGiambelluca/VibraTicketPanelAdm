import React from 'react';
import { Layout, Row, Col, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import logo from '../assets/VibraTicketLogo2.png';
import {
  FacebookOutlined,
  TwitterOutlined,
  InstagramOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';

const { Footer: AntFooter } = Layout;
const { Text, Title } = Typography;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <AntFooter
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        padding: '48px 24px 24px',
        marginTop: 'auto',
        borderTop: '1px solid rgba(59, 130, 246, 0.2)'
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Row gutter={[32, 32]}>
          {/* Columna 1: Sobre nosotros */}
          <Col xs={24} sm={12} md={6}>
            <img 
              src={logo} 
              alt="VibraTicket" 
              style={{ 
                height: 40, 
                width: 'auto', 
                marginBottom: 16,
                filter: 'brightness(0) invert(1)'
              }} 
            />
            <Text style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 12 }}>
              Tu plataforma de tickets para vivir experiencias únicas.
            </Text>
            <Space size="middle">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', fontSize: 20 }}
              >
                <FacebookOutlined />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', fontSize: 20 }}
              >
                <TwitterOutlined />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', fontSize: 20 }}
              >
                <InstagramOutlined />
              </a>
            </Space>
          </Col>

          {/* Columna 2: Enlaces rápidos */}
          <Col xs={24} sm={12} md={6}>
            <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
              Enlaces Rápidos
            </Title>
            <Space direction="vertical" size="small">
              <Link to="/" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Inicio
              </Link>
              <Link to="/events" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Eventos
              </Link>
              <Link to="/help" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Ayuda
              </Link>
              <Link to="/soporte" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Soporte
              </Link>
            </Space>
          </Col>

          {/* Columna 3: Legal */}
          <Col xs={24} sm={12} md={6}>
            <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
              Legal
            </Title>
            <Space direction="vertical" size="small">
              <Link to="/terms" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Términos y Condiciones
              </Link>
              <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Política de Privacidad
              </Link>
              <Link to="/soporte" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Contacto
              </Link>
            </Space>
          </Col>

          {/* Columna 4: Contacto */}
          <Col xs={24} sm={12} md={6}>
            <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
              Contacto
            </Title>
            <Space direction="vertical" size="small">
              <Space>
                <MailOutlined />
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                  info@rstickets.com
                </Text>
              </Space>
              <Space>
                <PhoneOutlined />
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                  +54 11 1234-5678
                </Text>
              </Space>
              <Space>
                <EnvironmentOutlined />
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Buenos Aires, Argentina
                </Text>
              </Space>
            </Space>
          </Col>
        </Row>

        {/* Copyright */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.2)',
            marginTop: 32,
            paddingTop: 24,
            textAlign: 'center'
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            © {currentYear} VibraTicket. Todos los derechos reservados.
          </Text>
        </div>
      </div>
    </AntFooter>
  );
}
