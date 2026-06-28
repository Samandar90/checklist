export type TintColor = "indigo" | "violet" | "sky" | "emerald" | "amber" | "rose" | "slate";

/** Theme-aware accent classes for icon chips/badges — see .tint-* in index.css. */
export const TINTS: Record<TintColor, string> = {
  indigo: "tint-indigo",
  violet: "tint-violet",
  sky: "tint-sky",
  emerald: "tint-emerald",
  amber: "tint-amber",
  rose: "tint-rose",
  slate: "tint-slate",
};
