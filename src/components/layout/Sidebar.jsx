import React from 'react';
import { Tooltip } from 'antd';
import { navSectionsForRole } from './navConfig';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from './ThemeProvider';
import logoLight from '../../assets/brand/vibra-logo-light.png';
import logoDark from '../../assets/brand/vibra-logo-dark.png';

export default function Sidebar({ collapsed, onToggle, selectedKey, onNavigate, embedded }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  // Wordmark blanco sobre fondo oscuro; negro sobre papel claro
  const brandLogo = theme === 'light' ? logoDark : logoLight;
  const initial = (user?.name || user?.email || 'A').trim().charAt(0).toUpperCase();
  const roleLabel = (user?.role || 'staff').toLowerCase();
  const isCollapsed = collapsed && !embedded;

  // Cada rol ve solo sus ítems (matriz en navConfig). Un productor administra
  // sus eventos/funciones y no toca el panel general. Mientras el rol no cargó
  // (primer render) no se muestra NADA — default cerrado, nunca abierto.
  const visibleSections = user?.role ? navSectionsForRole(user.role) : [];

  return (
    <aside className="shell-sidebar" data-collapsed={isCollapsed ? 'true' : 'false'}>
      {!embedded && (
        <div className="shell-brand">
          <img src={brandLogo} alt="Vibra Tickets" className="shell-brand-logo" />
        </div>
      )}

      <nav className="shell-nav" aria-label="Navegación principal">
        {visibleSections.map((section) => (
          <React.Fragment key={section.label}>
            <div className="shell-nav-section">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = selectedKey === item.key;
              const button = (
                <button
                  type="button"
                  className="shell-nav-item"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate?.(item.key)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="shell-nav-icon">
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="shell-nav-label">{item.label}</span>
                </button>
              );
              return isCollapsed
                ? <Tooltip key={item.key} placement="right" title={item.label}>{button}</Tooltip>
                : <React.Fragment key={item.key}>{button}</React.Fragment>;
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="shell-sidebar-foot">
        <div className="shell-foot-avatar" aria-hidden>{initial}</div>
        <div className="shell-foot-meta">
          <div className="shell-foot-name">{user?.name || user?.email || 'Usuario'}</div>
          <div className="shell-foot-role">{roleLabel}</div>
        </div>
        <div className="shell-foot-actions">
          <Tooltip title="Cerrar sesión" placement="top">
            <button type="button" className="shell-topbar-iconbtn" onClick={logout} aria-label="Cerrar sesión">
              <LogOut size={16} strokeWidth={1.7} />
            </button>
          </Tooltip>
          {!embedded && (
            <Tooltip title={collapsed ? 'Expandir' : 'Colapsar'} placement="top">
              <button type="button" className="shell-topbar-iconbtn" onClick={onToggle} aria-label="Toggle sidebar">
                {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
