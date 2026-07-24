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
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(120% 160% at 100% 0%, rgba(94,161,230,0.35), transparent 55%), radial-gradient(90% 140% at 0% 100%, rgba(45,108,179,0.5), transparent 60%), linear-gradient(135deg, #0e1626 0%, #16305a 60%, #24578f 100%)",
      }}
    >
      {/* тонкая сетка-текстура, как на hero-панелях внутри системы */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      {/* парящие световые орбы */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#4e94d8]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-[#8b5cf6]/25 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* ЛЕВАЯ ПАНЕЛЬ — брендовый hero (скрыта на мобильных) */}
        <div className="relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-white shadow-[0_8px_24px_rgba(45,108,179,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight">Hotel Reports</div>
              <div className="text-[12px] text-white/55">Система управления сетью отелей</div>
            </div>
          </div>

          <div className="max-w-md">
            <h2
              className="font-display text-[34px] font-extrabold leading-[1.1] tracking-tight animate-fade-in xl:text-[40px]"
              style={{ animationDelay: "60ms" }}
            >
              Управляйте отелями
              <br />
              <span className="bg-gradient-to-r from-white via-[#bcd8f5] to-[#8fbdf0] bg-clip-text text-transparent">
                с одного экрана
              </span>
            </h2>
            <p
              className="mt-4 text-[15px] leading-relaxed text-white/60 animate-fade-in"
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
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur-md">
                    <f.icon className="h-5 w-5 text-[#bcd8f5]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-white/90">{f.title}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-white/50">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="text-[12px] text-white/35 animate-fade-in"
            style={{ animationDelay: "440ms" }}
          >
            © {new Date().getFullYear()} Hotel Reports · Все права защищены
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ — форма входа */}
        <div className="relative flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm animate-fade-in" style={{ animationDelay: "80ms" }}>
            {/* компактный логотип для мобильных */}
            <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-white shadow-[0_8px_24px_rgba(45,108,179,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]">
                <Hotel className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-[22px] font-extrabold tracking-tight text-white">
                  Hotel Reports
                </h1>
                <p className="mt-0.5 text-[13px] text-white/55">Система управления сетью отелей</p>
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-7 sm:p-8">
              <h2 className="font-display text-[20px] font-bold text-foreground">С возвращением 👋</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
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

            <p className="mt-6 text-center text-[11px] text-white/35">
              Доступ выдаёт главный администратор сети
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
