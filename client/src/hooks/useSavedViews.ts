import { useEffect, useState } from "react";

export interface SavedView<T> {
  name: string;
  filters: T;
}

export function useSavedViews<T>(storageKey: string) {
  const [views, setViews] = useState<SavedView<T>[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as SavedView<T>[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(views));
  }, [views, storageKey]);

  function save(name: string, filters: T) {
    setViews((prev) => [...prev.filter((v) => v.name !== name), { name, filters }]);
  }

  function remove(name: string) {
    setViews((prev) => prev.filter((v) => v.name !== name));
  }

  return { views, save, remove };
}
