import React from 'react';
import { Ticket } from 'lucide-react';
import { MOBILE_TABS } from './navConfig';
import { useAuth } from '../../hooks/useAuth';

export default function MobileTabBar({ selectedKey, onNavigate, onOpenMenu }) {
  const { user } = useAuth();
  const isBoleteria = user?.role === 'BOLETERIA';
  const tabs = isBoleteria
    ? [{ key: 'boxoffice', label: 'Boletería', icon: Ticket }, MOBILE_TABS.find((t) => t.key === 'menu')]
    : MOBILE_TABS;

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
