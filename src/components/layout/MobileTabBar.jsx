import React from 'react';
import { Ticket, Clock4 } from 'lucide-react';
import { MOBILE_TABS, allowedKeysForRole } from './navConfig';
import { useAuth } from '../../hooks/useAuth';

export default function MobileTabBar({ selectedKey, onNavigate, onOpenMenu }) {
  const { user } = useAuth();
  const role = user?.role;
  // Tabs filtradas por la misma matriz de roles del nav; el ítem "Más"
  // (drawer) queda siempre. BOLETERIA conserva su tab dedicada.
  let tabs;
  if (role === 'BOLETERIA') {
    tabs = [{ key: 'boxoffice', label: 'Boletería', icon: Ticket }, MOBILE_TABS.find((t) => t.key === 'menu')];
  } else if (role) {
    const allowed = allowedKeysForRole(role);
    tabs = MOBILE_TABS.filter((t) => t.key === 'menu' || allowed.has(t.key));
    // Productor: sus tabs útiles son Eventos y Funciones
    if (role === 'ORGANIZER' || role === 'PRODUCER') {
      tabs = [
        MOBILE_TABS.find((t) => t.key === 'events'),
        { key: 'shows', label: 'Funciones', icon: Clock4 },
        MOBILE_TABS.find((t) => t.key === 'menu')
      ].filter(Boolean);
    }
  } else {
    tabs = [];
  }

  return (
    <nav className="shell-tabbar" aria-label="Navegación móvil">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isMenu = tab.key === 'menu';
        const active = !isMenu && selectedKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className="shell-tabbar-item"
            aria-current={active ? 'page' : undefined}
            onClick={() => (isMenu ? onOpenMenu?.() : onNavigate?.(tab.key))}
          >
            <span className="shell-tabbar-icon">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
