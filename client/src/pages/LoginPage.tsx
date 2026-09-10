import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Hotel,
  ShieldCheck,
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";

const FEATURES = [
  {
    icon: Building2,
    title: "Единая сеть отелей",
    desc: "Все филиалы, номера и бронирования — в одном рабочем пространстве.",
  },
  {
    icon: BarChart3,
    title: "Финансы и отчёты в реальном времени",
    desc: "Касса, расходы, должники и аналитика без ручных сверок.",
  },
  {
    icon: ShieldCheck,
    title: "Разграниченный доступ",
    desc: "Роли и права выдаёт главный администратор сети.",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen w-full bg-background text-foreground lg:grid-cols-2">
        {/* ЛЕВАЯ ПАНЕЛЬ — брендовый hero (скрыта на мобильных) */}
        <div className="relative hidden flex-col justify-between bg-black p-12 text-white lg:flex xl:p-16">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Hotel Reports</div>
              <div className="text-[12px] text-white/55">Система управления сетью отелей</div>
            </div>
          </div>

          <div className="max-w-md">
            <h2
              className="text-[32px] font-semibold leading-[1.15] tracking-tight animate-fade-in xl:text-[38px]"
              style={{ animationDelay: "60ms" }}
            >
              Управляйте отелями с одного экрана
            </h2>
            <p
              className="mt-4 text-[15px] leading-relaxed text-white/55 animate-fade-in"
              style={{ animationDelay: "120ms" }}
            >
              Бронирования, касса, финансы и аналитика — быстро, наглядно и под контролем.
            </p>

            <ul className="mt-9 space-y-5">
              {FEATURES.map((f, i) => (
                <li
                  key={f.title}
                  className="flex items-start gap-4 animate-fade-in"
                  style={{ animationDelay: `${180 + i * 80}ms` }}
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
                    <f.icon className="h-[18px] w-[18px] text-white/70" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-white/90">{f.title}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-white/45">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[12px] text-white/30 animate-fade-in" style={{ animationDelay: "440ms" }}>
            © {new Date().getFullYear()} Hotel Reports · Все права защищены
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ — форма входа */}
        <div className="relative flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm animate-fade-in" style={{ animationDelay: "80ms" }}>
            {/* компактный логотип для мобильных */}
            <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                <Hotel className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Hotel Reports</h1>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Система управления сетью отелей</p>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 sm:p-9">
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">С возвращением 👋</h2>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                Войдите в систему, чтобы продолжить работу.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Логин</Label>
                  <Input
                    id="username"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="например, admin"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      aria-pressed={showPassword}
                      tabIndex={-1}
                      className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="animate-fade-in rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="group w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    <>
                      Войти
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              Доступ выдаёт главный администратор сети
            </p>
          </div>
        </div>
    </div>
  );
}
