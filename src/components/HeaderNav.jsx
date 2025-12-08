import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, message, Drawer, Grid, Space, Divider } from 'antd';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  FileText,
  LayoutDashboard,
  User,
  LogOut,
  LogIn,
  UserPlus,
  ShoppingCart,
  Users,
  Menu as MenuIcon,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../contexts/LoginModalContext';
import { useRegisterModal } from '../contexts/RegisterModalContext';
import logo from '../assets/VibraTicketLogo.png';

const { Header } = Layout;

export default function HeaderNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, isAdmin, isOrganizer } = useAuth();
  const { openLoginModal } = useLoginModal();
  const { openRegisterModal } = useRegisterModal();
  
  // Responsive
  const screens = Grid.useBreakpoint();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Detectar si estamos en ruta admin
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    message.success('¡Hasta pronto!');
    navigate('/');
    setMobileMenuOpen(false);
  };

  const handleMobileMenuClick = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Menú del usuario autenticado
  const userMenuItems = [
    {
      key: 'profile',
      icon: <User size={16} />,
      label: 'Mi Perfil',
      onClick: () => navigate('/profile')
    },
    {
      key: 'tickets',
      icon: <FileText size={16} />,
      label: 'Mis Entradas',
      onClick: () => navigate('/mis-entradas')
    }
  ];

  // Agregar opción admin si el usuario es admin u organizador
  if (isAdmin || isOrganizer) {
    userMenuItems.push({
      key: 'admin',
      icon: <LayoutDashboard size={16} />,
      label: 'Panel Admin',
      onClick: () => navigate('/admin')
    });
  }

  // Agregar divider y logout
  userMenuItems.push(
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: 'Cerrar Sesión',
      onClick: handleLogout
    }
  );

  // Items del menú principal
  const menuItems = [
    {
      key: '/',
      icon: <Home size={16} />,
      label: <Link to="/">Inicio</Link>
    },
    {
      key: '/events',
      icon: <Calendar size={16} />,
      label: <Link to="/events">Eventos</Link>
    }
  ];

  if (isAuthenticated) {
    menuItems.push({
      key: '/mis-entradas',
      icon: <FileText size={16} />,
      label: <Link to="/mis-entradas">Mis Entradas</Link>
    });
  }

  if (isAdmin || isOrganizer) {
    const adminSubMenuItems = [
      {
        key: '/admin',
        icon: <LayoutDashboard size={16} />,
        label: <Link to="/admin">Dashboard</Link>
      },
      {
        key: '/admin/orders',
        icon: <ShoppingCart size={16} />,
        label: <Link to="/admin/orders">Órdenes</Link>
      }
    ];
    
    // Solo admins pueden ver usuarios
    if (isAdmin) {
      adminSubMenuItems.push({
        key: '/admin/users',
        icon: <Users size={16} />,
        label: <Link to="/admin/users">Usuarios</Link>
      });
    }
    
    menuItems.push({
      key: 'admin',
      icon: <LayoutDashboard size={16} />,
      label: 'Admin',
      children: adminSubMenuItems
    });
  }

  // ===== ESTILOS CONDICIONALES =====
  const headerStyle = isAdminRoute 
    ? {
        // Admin: diseño oscuro actual
        position: 'fixed',
        zIndex: 1000,
        width: '100%',
        background: 'rgba(17, 24, 39, 0.98)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
      }
    : {
        // Customer: diseño minimalista blanco
        position: 'fixed',
        zIndex: 1000,
        width: '100%',
        background: '#FFFFFF',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        borderBottom: '1px solid var(--border-light)',
        height: 64
      };

  return (
    <Header style={headerStyle}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={logo}
            alt="VibraTicket"
            style={{
              height: 50,
              width: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
        </Link>
      </div>

      {/* Menú de navegación Desktop */}
      {screens.md && isAdminRoute ? (
        // Solo mostrar menú completo en rutas admin
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            marginLeft: 24
          }}
        />
      ) : (
       // Customer: solo espaciador
        <div style={{ flex: 1 }} />
      )}

      {/* Botones de usuario / Hamburger Mobile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {screens.md ? (
          // Desktop User Actions
          isAdminRoute ? (
            // Admin: mostrar menú completo
            isAuthenticated ? (
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s'
                }}>
                  <Avatar
                    size="small"
                    icon={<User size={16} />}
                    style={{
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                    }}
                  />
                  <span style={{ color: 'white', fontSize: 14 }}>
                    {user?.name || user?.email?.split('@')[0] || 'Usuario'}
                  </span>
                </div>
              </Dropdown>
            ) : (
              <>
                <Button
                  type="default"
                  icon={<LogIn size={16} />}
                  onClick={() => openLoginModal()}
                  style={{
                    borderColor: 'white',
                    color: 'white',
                    background: 'transparent'
                  }}
                >
                  Ingresar
                </Button>
                <Button
                  type="primary"
                  icon={<UserPlus size={16} />}
                  onClick={() => openRegisterModal()}
                  style={{
                    background: 'white',
                    color: '#764ba2',
                    border: 'none',
                    fontWeight: 600
                  }}
                >
                  Registrarse
                </Button>
              </>
            )
          ) : (
            // Customer: Botones de acción
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Admin Link for Customer View (if role allows) */}
              {(isAdmin || isOrganizer) && (
                <Button
                  type="default"
                  icon={<LayoutDashboard size={16} />}
                  onClick={() => navigate('/admin')}
                  style={{
                    borderColor: 'var(--primary-color)',
                    color: 'var(--primary-color)',
                    borderRadius: 'var(--border-radius-sm)',
                    fontWeight: 500
                  }}
                >
                  Panel Admin
                </Button>
              )}

              {isAuthenticated ? (
                <>
                  <Button
                    type="primary"
                    onClick={() => navigate('/mis-entradas')}
                    style={{
                      background: 'var(--primary-color)',
                      border: 'none',
                      borderRadius: 'var(--border-radius-sm)',
                      fontWeight: 500,
                      color: 'white',
                      height: 40,
                      padding: '0 24px'
                    }}
                  >
                    Mis Entradas
                  </Button>
                  <Button
                    type="text"
                    icon={<LogOut size={20} />}
                    onClick={handleLogout}
                    title="Cerrar Sesión"
                    style={{ color: '#666' }}
                  />
                </>
              ) : (
                <Button
                  type="primary"
                  onClick={() => openLoginModal()}
                  style={{
                    background: 'var(--primary-color)',
                    border: 'none',
                    borderRadius: 'var(--border-radius-sm)',
                    fontWeight: 500,
                    color: 'white',
                    height: 40,
                    padding: '0 24px'
                  }}
                >
                  Ingresar
                </Button>
              )}
            </div>
          )
        ) : (
          // Mobile Hamburger
          <Button 
            type="text" 
            icon={<MenuIcon size={24} color="white" />} 
            onClick={() => setMobileMenuOpen(true)}
          />
        )}
      </div>

      {/* Mobile Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <img src={logo} alt="VibraTicket" style={{ height: 32 }} />
            <Button 
              type="text" 
              icon={<X size={20} />} 
              onClick={() => setMobileMenuOpen(false)} 
            />
          </div>
        }
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0 } }}
        width={300}
        closeIcon={null}
        className="mobile-nav-drawer"
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {isAuthenticated && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Avatar
                size={64}
                icon={<User size={32} />}
                style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  marginBottom: 12
                }}
              />
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {user?.name || user?.email?.split('@')[0] || 'Usuario'}
              </div>
              <div style={{ color: '#666' }}>{user?.email}</div>
            </div>
          )}

          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => {
              if (key.startsWith('/')) {
                handleMobileMenuClick(key);
              }
            }}
            style={{ border: 'none', fontSize: 16 }}
          />

          <Divider />

          {isAuthenticated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button 
                block 
                size="large" 
                icon={<User size={20} />} 
                onClick={() => handleMobileMenuClick('/profile')}
              >
                Mi Perfil
              </Button>
              <Button 
                block 
                size="large" 
                icon={<FileText size={20} />} 
                onClick={() => handleMobileMenuClick('/mis-entradas')}
              >
                Mis Entradas
              </Button>
              <Button 
                block 
                size="large" 
                danger 
                icon={<LogOut size={20} />} 
                onClick={handleLogout}
                style={{ marginTop: 16 }}
              >
                Cerrar Sesión
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Button
                block
                size="large"
                type="primary"
                icon={<LogIn size={20} />}
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLoginModal();
                }}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: 48,
                  fontSize: 16
                }}
              >
                Ingresar
              </Button>
              <Button
                block
                size="large"
                icon={<UserPlus size={20} />}
                onClick={() => {
                  setMobileMenuOpen(false);
                  openRegisterModal();
                }}
                style={{ height: 48, fontSize: 16 }}
              >
                Registrarse
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </Header>
  );
}
