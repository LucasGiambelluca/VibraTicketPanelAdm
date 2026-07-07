import React from 'react';
import { Menu as MenuIcon } from 'lucide-react';

export default function Topbar({ title, eyebrow, onOpenDrawer, actions }) {
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
      </div>
    </header>
  );
}
