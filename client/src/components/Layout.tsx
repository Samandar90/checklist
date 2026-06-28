import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
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
  Hotel,
  LogOut,
  KeyRound,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const superAdminSections: NavSection[] = [
  { label: null, items: [{ to: "/", label: "Дашборд", icon: LayoutDashboard }, { to: "/analytics", label: "Аналитика", icon: BarChart3 }] },
  {
    label: "Операции",
    items: [
      { to: "/calendar", label: "Шахматка", icon: CalendarRange },
      { to: "/cash-register", label: "Касса", icon: Banknote },
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
      { to: "/audit", label: "Журнал изменений", icon: History },
      { to: "/backups", label: "Резервные копии", icon: DatabaseBackup },
    ],
  },
];

const adminSections: NavSection[] = [
  {
    label: null,
    items: [
      { to: "/calendar", label: "Шахматка", icon: CalendarRange },
      { to: "/cash-register", label: "Касса", icon: Banknote },
      { to: "/my-reports", label: "Мои отчёты", icon: ClipboardList },
      { to: "/my-expenses", label: "Расходы за смену", icon: Wallet },
    ],
  },
];

const ALL_ITEMS: NavItem[] = [...superAdminSections, ...adminSections].flatMap((s) => s.items);

const SIDEBAR_W = 248;
const SIDEBAR_W_COLLAPSED = 72;

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const sections = isSuperAdmin ? superAdminSections : adminSections;
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "1");
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const currentLabel =
    ALL_ITEMS.find((i) => (i.to === "/" ? location.pathname === "/" : location.pathname.startsWith(i.to)))?.label ??
    "Hotel Reports";

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  return (
    <div className="flex min-h-screen bg-background">
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }}
        className="fixed inset-y-3 left-3 z-30 hidden flex-col overflow-hidden rounded-2xl border border-border bg-card/85 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)] backdrop-blur-xl md:flex"
      >
        <div className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Hotel className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">Hotel Reports</span>
              <span className="truncate text-[11px] text-muted-foreground">Система отчётности</span>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-1">
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <p className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-primary/[0.09] text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "h-[15px] w-[15px] shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/80 p-2.5">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <ChevronRight className="h-[15px] w-[15px]" /> : <ChevronsLeft className="h-[15px] w-[15px]" />}
            {!collapsed && "Свернуть"}
          </button>
        </div>
      </motion.aside>

      <div
        className="flex w-full flex-1 flex-col transition-[padding-left] duration-200 md:pl-[var(--sidebar-pad)]"
        style={{ "--sidebar-pad": `${sidebarWidth + 24}px` } as React.CSSProperties}
      >
        {/* Верхний бар: хлебная крошка + профиль (только десктоп) */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-border/70 bg-background/80 px-2 backdrop-blur-xl md:flex">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Hotel Reports</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggle}
              aria-label="Переключить тему"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-[16px] w-[16px]" /> : <Moon className="h-[16px] w-[16px]" />}
            </button>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                  {(user?.fullName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden flex-col items-start leading-tight lg:flex">
                  <span className="max-w-[140px] truncate text-[13px] font-medium text-foreground">
                    {user?.fullName ?? user?.username}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isSuperAdmin ? "Главный аккаунт" : user?.branchName}
                  </span>
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", profileOpen && "rotate-180")} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-52 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl animate-pop-in">
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setPasswordDialogOpen(true);
                        setProfileOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
                    >
                      <KeyRound className="h-[15px] w-[15px] text-muted-foreground" />
                      Сменить пароль
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
                  >
                    <LogOut className="h-[15px] w-[15px] text-muted-foreground" />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Мобильный хедер */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hotel className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Hotel Reports</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Переключить тему"
              className="flex items-center rounded-lg p-1.5 text-muted-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setPasswordDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Пароль
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {sections.flatMap((s) => s.items).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-8">
          <PageTransition path={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
}

function PageTransition({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <motion.div
      key={path}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }}
    >
      {children}
    </motion.div>
  );
}
