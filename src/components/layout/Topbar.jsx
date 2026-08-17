import React from 'react';
import { Tooltip } from 'antd';
import { Menu as MenuIcon, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function Topbar({ title, eyebrow, onOpenDrawer, actions }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="shell-topbar">
      <button
        type="button"
        className="shell-topbar-toggle"
        aria-label="Abrir menú"
        onClick={onOpenDrawer}
      >
        <MenuIcon size={18} strokeWidth={1.8} />
      </button>

      <div className="shell-topbar-title-block">
        {eyebrow && <span className="shell-topbar-sub">{eyebrow}</span>}
        <span className="shell-topbar-title">{title}</span>
      </div>

      <div className="shell-topbar-spacer" />

      <div className="shell-topbar-actions">
        {actions}
        <Tooltip title={isDark ? 'Tema claro' : 'Tema oscuro'} placement="bottom">
          <button
            type="button"
            className="shell-topbar-iconbtn"
            aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            onClick={toggle}
          >
            {isDark ? <Sun size={16} strokeWidth={1.7} /> : <Moon size={16} strokeWidth={1.7} />}
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
