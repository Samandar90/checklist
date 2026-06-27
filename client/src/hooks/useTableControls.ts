import { useMemo, useState, useEffect } from "react";

/**
 * Client-side search + pagination over an in-memory list.
 * `matches` decides whether an item satisfies the lowercased query.
 */
export function useTableControls<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  pageSize = 10
) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => matches(item, q));
  }, [items, search, matches]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Keep the current page within bounds when the result set shrinks.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems: filtered.length,
    pageItems,
  };
}
