import {
  LayoutDashboard,
  CalendarDays,
  Clock4,
  MapPin,
  Image as ImageIcon,
  Ticket,
  ShoppingBag,
  Handshake,
  Users,
  LineChart,
  TicketPercent,
  CreditCard,
  Activity,
  Settings,
  Sparkles,
  DoorOpen,
} from 'lucide-react';

// keys must match AdminDashboard's selectedKey routing
//
// `roles`: quién ve cada ítem. Sin `roles` = solo ADMIN (default cerrado).
// Roles reales del backend: ADMIN, ORGANIZER (=productor; PRODUCER es alias),
// DOOR, BOLETERIA. Un productor administra SUS eventos y funciones y nada del
// panel general (órdenes/reportes/config siguen siendo globales → solo ADMIN
// hasta que tengan scope por evento).
const A = 'ADMIN';
const ORG = ['ADMIN', 'ORGANIZER', 'PRODUCER'];

export const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard, roles: [A] },
      { key: 'events', label: 'Eventos', icon: CalendarDays, roles: ORG },
      { key: 'shows', label: 'Funciones', icon: Clock4, roles: ORG },
      { key: 'venues', label: 'Venues', icon: MapPin, roles: [A] },
      { key: 'banners', label: 'Banners', icon: ImageIcon, roles: [A] },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { key: 'orders', label: 'Órdenes', icon: ShoppingBag, roles: [A] },
      { key: 'boxoffice', label: 'Boletería', icon: Ticket, roles: [A, 'BOLETERIA'] },
      { key: 'discount-codes', label: 'Códigos', icon: TicketPercent, roles: [A] },
      { key: 'payments-monitor', label: 'Pagos', icon: CreditCard, roles: [A] },
      { key: 'producers', label: 'Productoras', icon: Handshake, roles: [A] },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { key: 'reports', label: 'Reportes', icon: LineChart, roles: [A] },
      // Puertas del evento y personal de cada fecha. Va en Operaciones y no en
      // General porque se usa el día del show, no al cargar el evento.
      // El backend ya scopea gates/asignaciones por organizador.
      { key: 'access-gates', label: 'Puertas', icon: DoorOpen, roles: [...ORG, 'DOOR'] },
      { key: 'users', label: 'Usuarios', icon: Users, roles: [A] },
      { key: 'health', label: 'Salud', icon: Activity, roles: [A] },
      { key: 'mercadopago', label: 'MercadoPago', icon: Sparkles, roles: [A] },
      { key: 'settings', label: 'Configuración', icon: Settings, roles: [A] },
    ],
  },
];

export const FLAT_NAV = NAV_SECTIONS.flatMap((s) => s.items);

const itemVisible = (item, role) => (item.roles || ['ADMIN']).includes(role);

// Secciones del nav filtradas por rol (secciones vacías desaparecen)
export const navSectionsForRole = (role) =>
  NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => itemVisible(i, role)) }))
    .filter((s) => s.items.length > 0);

// Set de keys que un rol puede abrir (guard de renderContent)
export const allowedKeysForRole = (role) =>
  new Set(FLAT_NAV.filter((i) => itemVisible(i, role)).map((i) => i.key));

// Pantalla inicial por rol
export const defaultKeyForRole = (role) => {
  if (role === 'BOLETERIA') return 'boxoffice';
  if (role === 'ORGANIZER' || role === 'PRODUCER') return 'events';
  if (role === 'DOOR') return 'access-gates';
  return 'dashboard';
};

// 5 items shown in mobile bottom tab bar
export const MOBILE_TABS = [
  { key: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { key: 'events', label: 'Eventos', icon: CalendarDays },
  { key: 'orders', label: 'Órdenes', icon: ShoppingBag },
  { key: 'reports', label: 'Reportes', icon: LineChart },
  { key: 'menu', label: 'Más', icon: Settings }, // opens drawer
];
