import {
  LayoutDashboard,
  CalendarDays,
  Clock4,
  MapPin,
  Image as ImageIcon,
  Ticket,
  ShoppingBag,
  Users,
  LineChart,
  TicketPercent,
  CreditCard,
  Activity,
  Settings,
  Sparkles,
} from 'lucide-react';

// keys must match AdminDashboard's selectedKey routing
export const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
      { key: 'events', label: 'Eventos', icon: CalendarDays },
      { key: 'shows', label: 'Funciones', icon: Clock4 },
      { key: 'venues', label: 'Venues', icon: MapPin },
      { key: 'banners', label: 'Banners', icon: ImageIcon },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { key: 'orders', label: 'Órdenes', icon: ShoppingBag },
      { key: 'boxoffice', label: 'Boletería', icon: Ticket },
      { key: 'discount-codes', label: 'Códigos', icon: TicketPercent },
      { key: 'payments-monitor', label: 'Pagos', icon: CreditCard },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { key: 'reports', label: 'Reportes', icon: LineChart },
      { key: 'users', label: 'Usuarios', icon: Users },
      { key: 'health', label: 'Salud', icon: Activity },
      { key: 'mercadopago', label: 'MercadoPago', icon: Sparkles },
      { key: 'settings', label: 'Configuración', icon: Settings },
    ],
  },
];

export const FLAT_NAV = NAV_SECTIONS.flatMap((s) => s.items);

// 5 items shown in mobile bottom tab bar
export const MOBILE_TABS = [
  { key: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { key: 'events', label: 'Eventos', icon: CalendarDays },
  { key: 'orders', label: 'Órdenes', icon: ShoppingBag },
  { key: 'reports', label: 'Reportes', icon: LineChart },
  { key: 'menu', label: 'Más', icon: Settings }, // opens drawer
];
