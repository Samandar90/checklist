/** Horizontal size of the slanted check-in / check-out edge, px. */
export const SLANT = 12;
/** Width of the solid accent stripe along the check-in edge, px. */
export const STRIPE = 3;

export interface BarGeometry {
  left: number;
  width: number;
  slantLeft: boolean;
  slantRight: boolean;
  /** Slant width actually drawn on the left / right edge (0 when clipped by the month). */
  lt: number;
  rb: number;
  clipStripe: string;
  clipBody: string;
}

/**
 * Half-day convention shared by stays and room blocks on the chessboard: a bar
 * runs from the middle of its first cell to the middle of the cell it ends on,
 * clipped to the visible month. The start edge rises "/" and the end edge falls
 * "/" through the middle of their cells, so two adjacent bars (checkout + same-day
 * check-in, or a block followed by a stay) tessellate along one diagonal. A bar
 * cut by the month boundary gets a straight edge there. Returns null when nothing
 * of the bar falls inside the month.
 */
export function barGeometry(startIdx: number, endIdx: number, daysInMonth: number, cellWidth: number): BarGeometry | null {
  const rawStart = startIdx + 0.5;
  const rawEnd = endIdx + 0.5;
  const startUnit = Math.max(0, rawStart);
  const endUnit = Math.min(daysInMonth, rawEnd);
  if (endUnit <= startUnit) return null;

  const slantLeft = rawStart >= 0;
  const slantRight = rawEnd <= daysInMonth;

  // The slant is centered on the half-cell line so neighbouring bars share one
  // diagonal; ±1px keeps a hairline gap between them.
  const leftBase = startUnit * cellWidth - (slantLeft ? SLANT / 2 : 0);
  const rightBase = endUnit * cellWidth + (slantRight ? SLANT / 2 : 0);
  const left = leftBase + 1;
  const width = rightBase - leftBase - 2;

  const lt = slantLeft ? SLANT : 0;
  const rb = slantRight ? SLANT : 0;
  // The stripe alone (a 3px band parallel to the start edge) and the body —
  // the block with its left edge pushed right by the stripe.
  const clipStripe = `polygon(${lt}px 0%, ${lt + STRIPE}px 0%, ${STRIPE}px 100%, 0% 100%)`;
  const clipBody = `polygon(${lt + STRIPE}px 0%, 100% 0%, calc(100% - ${rb}px) 100%, ${STRIPE}px 100%)`;

  return { left, width, slantLeft, slantRight, lt, rb, clipStripe, clipBody };
}
