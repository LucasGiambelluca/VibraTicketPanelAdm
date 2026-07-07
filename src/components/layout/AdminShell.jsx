import React, { useEffect, useState } from 'react';
import { Drawer } from 'antd';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import { FLAT_NAV } from './navConfig';

const COLLAPSE_KEY = 'vibra-admin-sidebar-collapsed';

export default function AdminShell({ selectedKey, onNavigate, children, topbarActions }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const current = FLAT_NAV.find((n) => n.key === selectedKey);
  const pageTitle = current?.label || 'Panel';

  const handleNav = (key) => {
    setDrawerOpen(false);
    onNavigate?.(key);
  };

  return (
    <div className="shell">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        selectedKey={selectedKey}
        onNavigate={handleNav}
      />

      <Drawer
        className="shell-drawer"
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={288}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 32, height: 32, display: 'grid', placeItems: 'center',
                background: 'var(--color-accent)', color: 'var(--color-text-inverse)',
                borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
              }}
            >V</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>VibraTickets</span>
          </span>
        }
      >
        <Sidebar
          collapsed={false}
          embedded
          selectedKey={selectedKey}
          onNavigate={handleNav}
        />
      </Drawer>

      <main className="shell-main">
        <Topbar
          title={pageTitle}
          eyebrow="VibraTickets · control"
          onOpenDrawer={() => setDrawerOpen(true)}
          actions={topbarActions}
        />
        <div className="shell-content fade-in" key={selectedKey}>
          {children}
        </div>
      </main>

      <MobileTabBar
        selectedKey={selectedKey}
        onNavigate={handleNav}
        onOpenMenu={() => setDrawerOpen(true)}
      />
    </div>
  );
}
