import { useEffect, useState } from "react";

export function useColumnVisibility(storageKey: string, columnIds: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(hidden)));
  }, [hidden, storageKey]);

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isVisible(id: string) {
    return !hidden.has(id);
  }

  return { isVisible, toggle, columnIds };
}
