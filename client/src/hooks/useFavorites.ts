import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hotel_reports_favorites";

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const isFavorite = useCallback((to: string) => favorites.includes(to), [favorites]);

  const toggleFavorite = useCallback((to: string) => {
    setFavorites((prev) => (prev.includes(to) ? prev.filter((p) => p !== to) : [...prev, to]));
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
