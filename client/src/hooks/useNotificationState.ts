import { useCallback, useEffect, useState } from "react";

const READ_KEY = "hotel_reports_notifications_read";
const ARCHIVED_KEY = "hotel_reports_notifications_archived";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function useNotificationState() {
  const [read, setRead] = useState<Set<string>>(() => readSet(READ_KEY));
  const [archived, setArchived] = useState<Set<string>>(() => readSet(ARCHIVED_KEY));

  useEffect(() => {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(read)));
  }, [read]);

  useEffect(() => {
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(Array.from(archived)));
  }, [archived]);

  const markRead = useCallback((id: string) => {
    setRead((prev) => new Set(prev).add(id));
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    setRead((prev) => new Set([...prev, ...ids]));
  }, []);

  const archive = useCallback((id: string) => {
    setArchived((prev) => new Set(prev).add(id));
    setRead((prev) => new Set(prev).add(id));
  }, []);

  const unarchive = useCallback((id: string) => {
    setArchived((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isRead = useCallback((id: string) => read.has(id), [read]);
  const isArchived = useCallback((id: string) => archived.has(id), [archived]);

  return { isRead, isArchived, markRead, markAllRead, archive, unarchive, read, archived };
}
