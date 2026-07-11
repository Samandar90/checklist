import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Hotel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
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

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#4e94d8] to-[#2d6cb3] text-white shadow-[0_8px_24px_rgba(45,108,179,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-white">Hotel Reports</h1>
            <p className="mt-0.5 text-[13px] text-white/55">Система управления сетью отелей</p>
          </div>
        </div>

        <Card className="border-white/10 shadow-[0_24px_60px_rgba(5,12,26,0.5)] hover:border-white/10">
          <CardContent className="p-7">
            <h2 className="font-display mb-5 text-[16px] font-bold text-foreground">С возвращением 👋</h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="например, admin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Вход..." : "Войти"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-white/35">Доступ выдаёт главный администратор сети</p>
      </div>
    </div>
  );
}
