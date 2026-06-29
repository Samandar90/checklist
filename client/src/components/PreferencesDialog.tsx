import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { useTheme } from "@/contexts/ThemeContext";
import { usePreferences } from "@/hooks/usePreferences";

export default function PreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, toggle } = useTheme();
  const { density, setDensity } = usePreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Настройки интерфейса</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Тема</p>
            <Segmented
              options={[
                { value: "light", label: "Светлая" },
                { value: "dark", label: "Тёмная" },
              ]}
              value={theme}
              onChange={(v) => {
                if (v !== theme) toggle();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Плотность интерфейса</p>
            <Segmented
              options={[
                { value: "comfortable", label: "Обычная" },
                { value: "compact", label: "Компактная" },
              ]}
              value={density}
              onChange={setDensity}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
