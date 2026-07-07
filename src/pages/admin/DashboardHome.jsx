import React, { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, Tag, Tooltip } from 'antd';
import {
  ArrowUpRight,
  CalendarDays,
  Clock4,
  ShoppingBag,
  Users,
  Sparkles,
  Plus,
  Image as ImageIcon,
  LineChart,
  TrendingUp,
  TrendingDown,
  Activity,
  MapPin,
  TicketPercent,
  CreditCard,
} from 'lucide-react';
import { eventsApi, ordersApi, reportsApi } from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth';

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat('es-AR');

function pickArray(payload, ...keys) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const k of keys) {
    if (Array.isArray(payload[k])) return payload[k];
    if (payload[k] && Array.isArray(payload[k]?.data)) return payload[k].data;
  }
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === 'object') {
    for (const k of keys) {
      if (Array.isArray(payload.data[k])) return payload.data[k];
    }
  }
  return [];
}

export default function DashboardHome({ onNavigate }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [financial, setFinancial] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        eventsApi.getEvents({ limit: 50, sortBy: 'created_at', sortOrder: 'DESC' }),
        ordersApi.getAllOrders
          ? ordersApi.getAllOrders({ limit: 10, sortBy: 'created_at', sortOrder: 'DESC' })
          : (ordersApi.getOrders?.({ limit: 10 }) ?? Promise.resolve(null)),
        reportsApi.getFinancialReport ? reportsApi.getFinancialReport({}) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const [evRes, ordRes, finRes] = results;
      setEvents(evRes.status === 'fulfilled' ? pickArray(evRes.value, 'events') : []);
      setOrders(ordRes.status === 'fulfilled' ? pickArray(ordRes.value, 'orders') : []);
      setFinancial(finRes.status === 'fulfilled' ? (finRes.value?.data || finRes.value || null) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const totalEvents = events.length;
    const liveEvents = events.filter((e) => (e.status || '').toUpperCase() === 'PUBLISHED').length;
    const draftEvents = events.filter((e) => (e.status || '').toUpperCase() === 'DRAFT').length;
    // financial.summary trae los agregados REALES de todas las órdenes pagadas.
    // `orders` es solo una muestra reciente (limit) para la tabla; NO sirve para totales.
    const fin = financial?.summary || {};
    const paidOrders = fin.ordersCount != null
      ? Number(fin.ordersCount)
      : orders.filter((o) => ['PAID', 'COMPLETED'].includes((o.status || '').toUpperCase())).length;
    const totalOrders = fin.ordersCount != null ? Number(fin.ordersCount) : orders.length;
    const ticketsSold = fin.ticketsSold != null ? Number(fin.ticketsSold) : 0;
    const revenue =
      fin.totalCollected != null ? Number(fin.totalCollected)
      : fin.grossSales != null ? Number(fin.grossSales)
      : orders.reduce((acc, o) => acc + Number(o.total_cents || o.totalCents || 0), 0) / 100;
    return { totalEvents, liveEvents, draftEvents, totalOrders, paidOrders, ticketsSold, revenue };
  }, [events, orders, financial]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Buenas noches';
    if (hour < 13) return 'Buen día';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => e.shows && e.shows.length > 0)
        .sort((a, b) => {
          const da = new Date(a.shows?.[0]?.starts_at || 0).getTime();
          const db = new Date(b.shows?.[0]?.starts_at || 0).getTime();
          return da - db;
        })
        .slice(0, 4),
    [events]
  );

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);

  const firstName = (user?.name || user?.email || 'admin').split(/[\s@]/)[0];

  return (
    <>
      <header className="page-header">
        <span className="page-eyebrow">{today}</span>
        <div className="page-header-row">
          <div>
            <h1 className="page-title">
              {greeting}, <em>{firstName}</em>.
            </h1>
            <p className="page-subtitle">
              Tu control room en tiempo real. Lo que importa hoy, primero.
            </p>
          </div>
          <div className="page-actions">
            <Button type="default" icon={<ImageIcon size={14} strokeWidth={1.75} />} onClick={() => onNavigate?.('banners')}>
              Banners
            </Button>
            <Button type="primary" icon={<Plus size={14} strokeWidth={2} />} onClick={() => onNavigate?.('events')}>
              Nuevo evento
            </Button>
          </div>
        </div>
      </header>

      <section className="bento stagger" aria-label="Indicadores">
        <article className="bento-cell bento-hero">
          <div className="bento-label">Ingresos · este mes</div>
          <div className="bento-value">{loading ? '—' : ARS.format(totals.revenue || 0)}</div>
          <div className="bento-delta up">
            <TrendingUp size={12} strokeWidth={2} />
            {totals.paidOrders > 0
              ? `${totals.paidOrders} pagadas / ${totals.totalOrders} órdenes`
              : 'Sin movimientos · esperando primera venta'}
          </div>
        </article>

        <article className="bento-cell bento-lime">
          <div className="bento-label">Eventos vivos</div>
          <div className="bento-value">{loading ? '—' : NUM.format(totals.liveEvents)}</div>
          <div className="bento-delta">{totals.draftEvents} en borrador</div>
        </article>

        <article className="bento-cell bento-stat">
          <div className="bento-label">Órdenes pagadas</div>
          <div className="bento-value">{loading ? '—' : NUM.format(totals.totalOrders)}</div>
          <div className="bento-delta">{totals.ticketsSold} tickets vendidos</div>
        </article>

        <article className="bento-cell bento-cyan">
          <div className="bento-label">Total eventos</div>
          <div className="bento-value">{loading ? '—' : NUM.format(totals.totalEvents)}</div>
          <div className="bento-delta">{totals.liveEvents} publicados</div>
        </article>

        <article className="bento-cell bento-ok">
          <div className="bento-label">Salud</div>
          <div className="bento-value">OK</div>
          <div className="bento-delta up">
            <Activity size={12} strokeWidth={2} />
            servicios prod
          </div>
        </article>
      </section>

      <div className="dash-grid stagger">
        <article className="surface dash-block">
          <div className="section-head">
            <div>
              <div className="eyebrow">próximos shows</div>
              <h2>Cartelera</h2>
            </div>
            <Button
              type="link"
              icon={<ArrowUpRight size={14} strokeWidth={2} />}
              onClick={() => onNavigate?.('shows')}
            >
              Ver todos
            </Button>
          </div>

          {loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : upcoming.length === 0 ? (
            <div className="empty-state">
              <h3>Sin shows programados</h3>
              <p>Creá un evento y asignale fechas para empezar a vender.</p>
            </div>
          ) : (
            <ul className="dash-list">
              {upcoming.map((ev) => {
                const next = ev.shows?.[0];
                const date = next ? new Date(next.starts_at) : null;
                return (
                  <li key={ev.id} className="dash-list-item">
                    <div className="dash-list-date">
                      {date ? (
                        <>
                          <span className="d">{date.getDate().toString().padStart(2, '0')}</span>
                          <span className="m">{date.toLocaleString('es-AR', { month: 'short' }).replace('.', '')}</span>
                        </>
                      ) : (
                        <span className="d">—</span>
                      )}
                    </div>
                    <div className="dash-list-body">
                      <div className="dash-list-title">{ev.name}</div>
                      <div className="dash-list-meta">
                        <MapPin size={11} strokeWidth={1.75} aria-hidden />
                        {ev.venue_name || ev.venue || ev.location || 'Sede por confirmar'}
                        {next && (
                          <>
                            <span className="dot" />
                            {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                          </>
                        )}
                      </div>
                    </div>
                    <Tag>{(ev.status || 'draft').toLowerCase()}</Tag>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="surface dash-block">
          <div className="section-head">
            <div>
              <div className="eyebrow">última actividad</div>
              <h2>Órdenes</h2>
            </div>
            <Button
              type="link"
              icon={<ArrowUpRight size={14} strokeWidth={2} />}
              onClick={() => onNavigate?.('orders')}
            >
              Ver órdenes
            </Button>
          </div>

          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : recentOrders.length === 0 ? (
            <div className="empty-state">
              <h3>Sin órdenes todavía</h3>
              <p>Cuando se concrete una compra aparece acá.</p>
            </div>
          ) : (
            <ul className="dash-list">
              {recentOrders.map((o) => {
                const total = Number(o.total_cents || o.totalCents || 0) / 100;
                const ts = o.created_at || o.createdAt;
                const dt = ts ? new Date(ts) : null;
                return (
                  <li key={o.id || o.orderId} className="dash-list-item">
                    <div className="dash-list-id">
                      <span className="kicker">#{o.id || o.orderId}</span>
                    </div>
                    <div className="dash-list-body">
                      <div className="dash-list-title">
                        {o.customer_email || o.customerEmail || o.user_email || 'Cliente'}
                      </div>
                      <div className="dash-list-meta">
                        {dt
                          ? dt.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                        <span className="dot" />
                        {ARS.format(total)}
                      </div>
                    </div>
                    <Tag>{(o.status || 'pending').toLowerCase()}</Tag>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="surface dash-block">
          <div className="section-head">
            <div>
              <div className="eyebrow">atajos</div>
              <h2>Operaciones</h2>
            </div>
          </div>
          <div className="dash-shortcuts">
            <Shortcut variant="lime" icon={<CalendarDays size={18} strokeWidth={1.75} />} label="Eventos" hint="crud" onClick={() => onNavigate?.('events')} />
            <Shortcut variant="cyan" icon={<Clock4 size={18} strokeWidth={1.75} />} label="Funciones" hint="agenda" onClick={() => onNavigate?.('shows')} />
            <Shortcut icon={<ShoppingBag size={18} strokeWidth={1.75} />} label="Órdenes" hint="ventas" onClick={() => onNavigate?.('orders')} />
            <Shortcut icon={<LineChart size={18} strokeWidth={1.75} />} label="Reportes" hint="finanzas" onClick={() => onNavigate?.('reports')} />
            <Shortcut icon={<TicketPercent size={18} strokeWidth={1.75} />} label="Códigos" hint="promo" onClick={() => onNavigate?.('discount-codes')} />
            <Shortcut icon={<CreditCard size={18} strokeWidth={1.75} />} label="Pagos" hint="MP" onClick={() => onNavigate?.('payments-monitor')} />
            <Shortcut icon={<Users size={18} strokeWidth={1.75} />} label="Usuarios" hint="roles" onClick={() => onNavigate?.('users')} />
            <Shortcut icon={<Sparkles size={18} strokeWidth={1.75} />} label="MercadoPago" hint="config" onClick={() => onNavigate?.('mercadopago')} />
          </div>
        </article>
      </div>

      <style>{`
        .dash-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: var(--sp-4);
          margin-top: var(--sp-6);
        }
        .dash-grid > .dash-block:nth-child(3) { grid-column: 1 / -1; }
        @media (max-width: 960px) {
          .dash-grid { grid-template-columns: 1fr; }
          .dash-grid > .dash-block:nth-child(3) { grid-column: 1; }
        }
        .dash-block { padding: var(--sp-5); }
        .dash-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .dash-list-item {
          display: flex; align-items: center; gap: var(--sp-4);
          padding: var(--sp-3) 0;
          border-bottom: 1px solid var(--color-border);
        }
        .dash-list-item:last-child { border-bottom: 0; }
        .dash-list-date {
          flex-shrink: 0;
          width: 54px;
          text-align: center;
          padding: 10px 4px;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          line-height: 1;
        }
        .dash-list-date .d {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 24px;
          letter-spacing: -0.04em;
          display: block;
          color: var(--color-text);
        }
        .dash-list-date .m {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-info);
          margin-top: 3px;
          display: block;
        }
        .dash-list-id { width: 56px; flex-shrink: 0; }
        .dash-list-body { flex: 1; min-width: 0; }
        .dash-list-title {
          font-family: var(--font-display);
          font-size: var(--fs-md);
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--color-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dash-list-meta {
          margin-top: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-muted);
          letter-spacing: 0.04em;
          display: inline-flex; align-items: center; gap: var(--sp-2);
        }
        .dash-list-meta .dot {
          display: inline-block; width: 3px; height: 3px;
          border-radius: 50%; background: currentColor; opacity: 0.6;
        }
        .dash-shortcuts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--sp-3);
        }
      `}</style>
    </>
  );
}

function Shortcut({ icon, label, hint, onClick, variant }) {
  return (
    <button type="button" className={`dash-shortcut ${variant || ''}`} onClick={onClick}>
      <span className="dash-shortcut-icon">{icon}</span>
      <span className="dash-shortcut-text">
        <span className="dash-shortcut-label">{label}</span>
        <span className="dash-shortcut-hint">{hint}</span>
      </span>
      <ArrowUpRight size={14} strokeWidth={2} className="dash-shortcut-arrow" />
      <style>{`
        .dash-shortcut {
          display: flex; align-items: center; gap: var(--sp-3);
          padding: var(--sp-4);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          transition: all 0.18s var(--ease-out);
          color: var(--color-text);
          width: 100%;
        }
        .dash-shortcut:hover {
          border-color: var(--color-info);
          transform: translateY(-2px);
        }
        .dash-shortcut-icon {
          width: 36px; height: 36px;
          flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--color-surface-2);
          color: var(--color-info);
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
        }
        .dash-shortcut.lime .dash-shortcut-icon {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          border-color: transparent;
        }
        .dash-shortcut.cyan .dash-shortcut-icon {
          background: var(--color-info);
          color: var(--color-text-inverse);
          border-color: transparent;
        }
        .dash-shortcut-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; line-height: 1.1; }
        .dash-shortcut-label {
          font-family: var(--font-display);
          font-size: var(--fs-md);
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .dash-shortcut-hint {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .dash-shortcut-arrow { color: var(--color-text-muted); transition: all 0.18s var(--ease-out); flex-shrink: 0; }
        .dash-shortcut:hover .dash-shortcut-arrow { color: var(--color-accent); transform: translate(2px, -2px); }
      `}</style>
    </button>
  );
}
