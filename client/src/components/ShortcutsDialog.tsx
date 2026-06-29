import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl/⌘ + K", label: "Открыть командный центр" },
  { keys: "↑ / ↓", label: "Навигация по списку" },
  { keys: "Enter", label: "Выполнить команду / перейти" },
  { keys: "Backspace", label: "Выйти из режима заселения/выселения" },
  { keys: "?", label: "Показать клавиатурные сочетания" },
  { keys: "Esc", label: "Закрыть диалог" },
];

export default function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Клавиатурные сочетания</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-foreground">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
