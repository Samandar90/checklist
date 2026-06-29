import {
  LayoutDashboard,
  Building2,
  Users,
  BedDouble,
  Megaphone,
  ClipboardList,
  CalendarRange,
  Wallet,
  AlertTriangle,
  User2,
  History,
  DatabaseBackup,
  Banknote,
  Sparkles,
  BarChart3,
  Wand2,
  GanttChartSquare,
  LayoutGrid,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

export const superAdminSections: NavSection[] = [
  {
    label: null,
    items: [
      { to: "/", label: "Дашборд", icon: LayoutDashboard },
      { to: "/workspace", label: "Воркспейс", icon: LayoutGrid },
      { to: "/analytics", label: "Аналитика", icon: BarChart3 },
    ],
  },
  {
    label: "Операции",
    items: [
      { to: "/calendar", label: "Шахматка", icon: CalendarRange },
      { to: "/smart-assign", label: "Умное распределение номеров", icon: Wand2 },
      { to: "/finance", label: "Финансовый центр", icon: Banknote },
      { to: "/cash-register", label: "Касса (смены)", icon: Banknote },
      { to: "/reports", label: "Ежемесячные отчёты", icon: ClipboardList },
      { to: "/expenses", label: "Расходы", icon: Wallet },
      { to: "/debtors", label: "Должники", icon: AlertTriangle },
      { to: "/guests", label: "Гости", icon: User2 },
      { to: "/housekeeping", label: "Уборка номеров", icon: Sparkles },
    ],
  },
  {
    label: "Структура",
    items: [
      { to: "/branches", label: "Филиалы", icon: Building2 },
      { to: "/admins", label: "Администраторы", icon: Users },
      { to: "/rooms", label: "Номера", icon: BedDouble },
      { to: "/sources", label: "Источники бронирования", icon: Megaphone },
    ],
  },
  {
    label: "Система",
    items: [
      { to: "/timeline", label: "Хронология", icon: GanttChartSquare },
      { to: "/audit", label: "Журнал изменений", icon: History },
      { to: "/backups", label: "Резервные копии", icon: DatabaseBackup },
    ],
  },
];

export const adminSections: NavSection[] = [
  {
    label: null,
    items: [
      { to: "/calendar", label: "Шахматка", icon: CalendarRange },
      { to: "/smart-assign", label: "Умное распределение номеров", icon: Wand2 },
      { to: "/cash-register", label: "Касса", icon: Banknote },
      { to: "/my-reports", label: "Мои отчёты", icon: ClipboardList },
      { to: "/my-expenses", label: "Расходы за смену", icon: Wallet },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [...superAdminSections, ...adminSections].flatMap((s) => s.items);

export interface QuickAction {
  id: string;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-booking", label: "Новое бронирование", to: "/calendar?new=1", icon: CalendarRange },
  { id: "new-expense", label: "Добавить расход", to: "/expenses?new=1", icon: Wallet },
  { id: "new-guest", label: "Новый гость", to: "/guests?new=1", icon: User2 },
];
