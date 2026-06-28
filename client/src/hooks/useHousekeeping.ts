import { useEffect, useState } from "react";

export type HKStatus = "Clean" | "Dirty" | "Cleaning" | "Inspection" | "OutOfOrder" | "Maintenance";
export type HKPriority = "Low" | "Medium" | "High";

export interface HKRoomState {
  status: HKStatus;
  priority: HKPriority;
  housekeeper: string;
  lastCleaned: string | null;
}

const DEFAULT_STATE: HKRoomState = { status: "Dirty", priority: "Medium", housekeeper: "", lastCleaned: null };

/**
 * Housekeeping status has no backend table — Room only has roomNumber/type/branchId.
 * Persisted client-side per browser so the board is usable without a schema change;
 * it will not sync across devices/users until a real housekeeping API exists.
 */
const STORAGE_KEY = "housekeeping-rooms";

/** Room IDs are globally unique, so one shared bucket keeps Rooms/Housekeeping pages in sync. */
export function useHousekeeping() {
  const [state, setState] = useState<Record<string, HKRoomState>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      try {
        setState(e.newValue ? JSON.parse(e.newValue) : {});
      } catch {
        setState({});
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function persist(next: Record<string, HKRoomState>) {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function get(roomId: string): HKRoomState {
    return state[roomId] ?? DEFAULT_STATE;
  }

  function setStatus(roomId: string, status: HKStatus) {
    const cur = get(roomId);
    persist({ ...state, [roomId]: { ...cur, status, lastCleaned: status === "Clean" ? new Date().toISOString() : cur.lastCleaned } });
  }

  function setPriority(roomId: string, priority: HKPriority) {
    persist({ ...state, [roomId]: { ...get(roomId), priority } });
  }

  function setHousekeeper(roomId: string, housekeeper: string) {
    persist({ ...state, [roomId]: { ...get(roomId), housekeeper } });
  }

  return { get, setStatus, setPriority, setHousekeeper };
}
