import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "hotel_reports_recent_pages";
const MAX_RECENT = 6;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useRecentPages() {
  const location = useLocation();
  const [recent, setRecent] = useState<string[]>(read);

  useEffect(() => {
    const path = location.pathname;
    setRecent((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [location.pathname]);

  const clearRecent = useCallback(() => {
    setRecent([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recent, clearRecent };
}
