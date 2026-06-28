import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  History,
  DatabaseBackup,
  Banknote,
  Hotel,
  LogOut,
  KeyRound,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

const superAdminNavItems = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard },
  { to: "/branches", label: "Филиалы", icon: Building2 },
  { to: "/admins", label: "Администраторы", icon: Users },
  { to: "/rooms", label: "Номера", icon: BedDouble },
  { to: "/sources", label: "Источники бронирования", icon: Megaphone },
  { to: "/reports", label: "Ежемесячные отчёты", icon: ClipboardList },
  { to: "/calendar", label: "Шахматка", icon: CalendarRange },
  { to: "/cash-register", label: "Касса", icon: Banknote },
  { to: "/expenses", label: "Расходы", icon: Wallet },
  { to: "/debtors", label: "Должники", icon: AlertTriangle },
  { to: "/audit", label: "Журнал изменений", icon: History },
  { to: "/backups", label: "Резервные копии", icon: DatabaseBackup },
];

const adminNavItems = [
  { to: "/calendar", label: "Шахматка", icon: CalendarRange },
  { to: "/cash-register", label: "Касса", icon: Banknote },
  { to: "/my-reports", label: "Мои отчёты", icon: ClipboardList },
  { to: "/my-expenses", label: "Расходы за смену", icon: Wallet },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const navItems = isSuperAdmin ? superAdminNavItems : adminNavItems;
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/80 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Hotel className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight text-foreground">Hotel Reports</span>
            <span className="text-[11px] text-muted-foreground">Система отчётности</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "bg-primary/[0.09] text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border/80 px-3 py-3">
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
              {(user?.fullName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-foreground">
                {user?.fullName ?? user?.username}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {isSuperAdmin ? "Главный аккаунт" : user?.branchName}
              </p>
            </div>
          </div>
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
            {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setPasswordDialogOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <KeyRound className="h-[15px] w-[15px]" />
              Сменить пароль
            </button>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-[15px] w-[15px]" />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col md:pl-64">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground">
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
          {navItems.map((item) => (
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
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
}
