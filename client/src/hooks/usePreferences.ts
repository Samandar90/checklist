import { useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "hotel_reports_density";

function getInitialDensity(): Density {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "compact" ? "compact" : "comfortable";
}

export function usePreferences() {
  const [density, setDensity] = useState<Density>(getInitialDensity);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(STORAGE_KEY, density);
  }, [density]);

  return { density, setDensity };
}
