import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Hotel,
  LogOut,
  KeyRound,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Menu,
  Command,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import PreferencesDialog from "@/components/PreferencesDialog";
import ShortcutsDialog from "@/components/ShortcutsDialog";
import CommandPalette from "@/components/CommandPalette";
import NotificationCenter from "@/components/NotificationCenter";
import BranchSwitcher from "@/components/BranchSwitcher";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { superAdminSections, adminSections, ALL_NAV_ITEMS, NavItem } from "@/lib/nav";

const ALL_ITEMS = ALL_NAV_ITEMS;

function NavItemLink({
  item,
  collapsed,
  showStar,
  favorited,
  onToggleFavorite,
}: {
  item: NavItem;
  collapsed: boolean;
  showStar?: boolean;
  favorited?: boolean;
  onToggleFavorite: (to: string) => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-white/[0.09] text-sidebar-active shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "text-sidebar-foreground hover:bg-white/[0.05] hover:text-sidebar-active"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* активный пункт помечен коротким брендовым штрихом слева */}
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[#5ea1e6]" />
          )}
          <item.icon
            className={cn(
              "h-[15px] w-[15px] shrink-0 transition-colors",
              isActive ? "text-[#5ea1e6]" : "text-sidebar-foreground/70 group-hover:text-sidebar-active"
            )}
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && showStar && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(item.to);
              }}
              className={cn(
                "shrink-0 rounded-md p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                favorited && "opacity-100"
              )}
              aria-label="Закрепить в избранном"
            >
              <Star className={cn("h-3 w-3", favorited ? "fill-[#5ea1e6] text-[#5ea1e6]" : "text-sidebar-foreground/60")} />
            </button>
          )}
        </>
      )}
    </NavLink>
  );
}

const SIDEBAR_W = 248;
const SIDEBAR_W_COLLAPSED = 72;

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isMultiBranchAdmin = !isSuperAdmin && (user?.branchIds?.length ?? 0) > 1;
  const sections = isSuperAdmin ? superAdminSections : adminSections;
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "1");
  const profileRef = useRef<HTMLDivElement>(null);
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { recent } = useRecentPages();

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(true),
    onShortcutsHelp: () => setShortcutsOpen(true),
  });

  const pinnedItems = favorites
    .map((to) => ALL_ITEMS.find((i) => i.to === to))
    .filter((i): i is (typeof ALL_ITEMS)[number] => !!i);

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
        className="fixed inset-y-3 left-3 z-30 hidden flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-sidebar shadow-[0_1px_2px_rgba(8,15,30,0.2),0_16px_40px_rgba(8,15,30,0.25)] md:flex"
      >
        <div className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-white shadow-[0_2px_6px_rgba(45,108,179,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Hotel className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-[13.5px] font-bold tracking-tight text-white">Hotel Reports</span>
              <span className="truncate text-[11px] text-sidebar-foreground">Система отчётности</span>
            </div>
          )}
        </div>

        <nav className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-1">
          {pinnedItems.length > 0 && (
            <div>
              {!collapsed && (
                <p className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  Избранное
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {pinnedItems.map((item) => (
                  <NavItemLink key={item.to} item={item} collapsed={collapsed} showStar favorited onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            </div>
          )}
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <p className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    showStar
                    favorited={isFavorite(item.to)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-2.5">
          {/* мини-профиль — кто сейчас за стойкой */}
          {!collapsed && (
            <div className="mb-1.5 flex items-center gap-2.5 rounded-[10px] bg-white/[0.04] px-2.5 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-[11px] font-bold text-white">
                {(user?.fullName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[12.5px] font-semibold text-white">{user?.fullName ?? user?.username}</span>
                <span className="truncate text-[10.5px] text-sidebar-foreground">
                  {isSuperAdmin ? "Главный аккаунт" : user?.branchName}
                </span>
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13px] text-sidebar-foreground transition-colors hover:bg-white/[0.05] hover:text-sidebar-active",
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
        <header className="glass-bar sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-border/60 px-2 md:flex">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Hotel Reports</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {(isSuperAdmin || isMultiBranchAdmin) && <BranchSwitcher forAdmin={isMultiBranchAdmin} />}

            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:border-primary/30 hover:text-foreground"
            >
              <Command className="h-[13px] w-[13px]" />
              Поиск
              <kbd className="rounded border border-border bg-secondary px-1 text-[10px]">Ctrl K</kbd>
            </button>

            <NotificationCenter />

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
                  <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                    {isSuperAdmin
                      ? "Главный аккаунт"
                      : (user?.branchIds?.length ?? 0) > 1
                        ? `${user?.branchName} +${(user?.branchIds?.length ?? 1) - 1}`
                        : user?.branchName}
                  </span>
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", profileOpen && "rotate-180")} />
              </button>

              {profileOpen && (
                <div className="glass-strong absolute right-0 top-[calc(100%+6px)] w-52 overflow-hidden rounded-2xl py-1 text-sm animate-pop-in">
                  <button
                    onClick={() => {
                      setPreferencesOpen(true);
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
                  >
                    <SlidersHorizontal className="h-[15px] w-[15px] text-muted-foreground" />
                    Настройки интерфейса
                  </button>
                  <button
                    onClick={() => {
                      setShortcutsOpen(true);
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
                  >
                    <Command className="h-[15px] w-[15px] text-muted-foreground" />
                    Клавиатурные сочетания
                  </button>
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
        <header className="glass-bar sticky top-0 z-20 flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-white">
              <Hotel className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-bold">Hotel Reports</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Поиск"
              className="flex items-center rounded-lg p-1.5 text-muted-foreground"
            >
              <Command className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              aria-label="Переключить тему"
              className="flex items-center rounded-lg p-1.5 text-muted-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Меню"
              className="flex items-center rounded-lg p-1.5 text-muted-foreground"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>

        <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DrawerContent className="max-w-[300px]">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <Hotel className="h-4 w-4" />
              </div>
              <span className="text-[13px] font-semibold text-foreground">Hotel Reports</span>
            </div>
            <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3">
              {sections.map((section, si) => (
                <div key={si}>
                  {section.label && (
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
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium",
                            isActive ? "bg-primary/[0.09] text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )
                        }
                      >
                        <item.icon className="h-[15px] w-[15px] shrink-0" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-border p-2.5">
              <button
                onClick={() => {
                  setPasswordDialogOpen(true);
                  setMobileNavOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-secondary"
              >
                <KeyRound className="h-[15px] w-[15px]" />
                Сменить пароль
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-[15px] w-[15px]" />
                Выйти
              </button>
            </div>
          </DrawerContent>
        </Drawer>

        <main className="flex-1 p-4 md:p-8">
          <PageTransition path={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} favorites={favorites} recent={recent} />
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
