import { MonthlyReport, Room } from "@/types";

export interface RoomProfile {
  room: Room;
  floor: string;
  capacity: number;
  amenities: string[];
  tier: number; // 1 = standard .. 3 = premium, used for upgrade detection
  avgPrice: number;
  occupancyRate: number; // 0..1 over the trailing window
  available: boolean;
}

export interface RankedRoom extends RoomProfile {
  score: number;
  reasons: string[];
}

export interface AssignmentResult {
  best: RankedRoom | null;
  alternatives: RankedRoom[];
  upgrades: RankedRoom[];
}

export interface AssignmentCriteria {
  preferredType?: string;
  guests: number;
  nights: number;
}

const TYPE_PROFILES: { match: RegExp; capacity: number; amenities: string[]; tier: number }[] = [
  { match: /lux|suite|вип|vip/i, capacity: 4, amenities: ["Кондиционер", "Мини-бар", "Вид на город", "Балкон"], tier: 3 },
  { match: /twin|двух/i, capacity: 2, amenities: ["Кондиционер", "Wi-Fi", "Две кровати"], tier: 2 },
  { match: /dbl|double|двойн/i, capacity: 2, amenities: ["Кондиционер", "Wi-Fi"], tier: 2 },
  { match: /single|одномест/i, capacity: 1, amenities: ["Wi-Fi"], tier: 1 },
];

const DEFAULT_PROFILE = { capacity: 2, amenities: ["Wi-Fi"], tier: 1 };

export function floorOf(roomNumber: string): string {
  return roomNumber.trim().charAt(0) || "?";
}

function typeProfile(type: string | null | undefined) {
  if (!type) return DEFAULT_PROFILE;
  const found = TYPE_PROFILES.find((p) => p.match.test(type));
  return found ?? DEFAULT_PROFILE;
}

/** Builds derived profiles (capacity/amenities/price/occupancy) from existing room + booking history — no new backend fields. */
export function buildRoomProfiles(
  rooms: Room[],
  windowBookings: MonthlyReport[],
  rangeBookings: MonthlyReport[],
  windowNights: number
): RoomProfile[] {
  return rooms.map((room) => {
    const profile = typeProfile(room.type);
    const roomWindowBookings = windowBookings.filter((b) => b.roomId === room.id);
    const roomRangeBookings = rangeBookings.filter((b) => b.roomId === room.id);

    const avgPrice =
      roomWindowBookings.length > 0
        ? roomWindowBookings.reduce((sum, b) => sum + b.price, 0) / roomWindowBookings.length
        : 0;

    const occupiedNights = roomWindowBookings.length;
    const occupancyRate = windowNights > 0 ? Math.min(1, occupiedNights / windowNights) : 0;

    return {
      room,
      floor: floorOf(room.roomNumber),
      capacity: profile.capacity,
      amenities: profile.amenities,
      tier: profile.tier,
      avgPrice,
      occupancyRate,
      available: roomRangeBookings.length === 0,
    };
  });
}

function scoreRoom(p: RoomProfile, criteria: AssignmentCriteria, fallbackAvgPrice: number): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (criteria.preferredType && p.room.type === criteria.preferredType) {
    score += 40;
    reasons.push("Точное совпадение по типу номера");
  }

  if (p.capacity >= criteria.guests) {
    score += p.capacity === criteria.guests ? 25 : 15;
    reasons.push(p.capacity === criteria.guests ? "Вместимость точно соответствует гостям" : "Вместимость достаточна");
  } else {
    score -= 20;
  }

  const price = p.avgPrice || fallbackAvgPrice;
  if (criteria.nights >= 3) {
    const cheapBoost = price > 0 ? Math.max(0, 20 - price / 5000) : 10;
    score += cheapBoost;
    if (cheapBoost > 10) reasons.push("Выгодная цена для длительного проживания");
  } else {
    score += p.amenities.length * 3;
    reasons.push("Хороший набор удобств для короткого визита");
  }

  score += (1 - p.occupancyRate) * 15;
  if (p.occupancyRate < 0.3) reasons.push("Низкая загрузка номера — свободен чаще обычного");

  return { score: Math.round(score), reasons };
}

export function rankRooms(profiles: RoomProfile[], criteria: AssignmentCriteria): AssignmentResult {
  const available = profiles.filter((p) => p.available);
  const fallbackAvgPrice =
    available.length > 0
      ? available.reduce((sum, p) => sum + p.avgPrice, 0) / available.filter((p) => p.avgPrice > 0).length || 0
      : 0;

  const ranked: RankedRoom[] = available.map((p) => {
    const { score, reasons } = scoreRoom(p, criteria, fallbackAvgPrice);
    return { ...p, score, reasons };
  });

  ranked.sort((a, b) => b.score - a.score);

  const preferredTier = criteria.preferredType
    ? typeProfile(criteria.preferredType).tier
    : ranked[0]?.tier ?? 1;

  const sameTierOrLower = ranked.filter((r) => r.tier <= preferredTier);
  const higherTier = ranked.filter((r) => r.tier > preferredTier);

  const best = sameTierOrLower[0] ?? ranked[0] ?? null;
  const alternatives = sameTierOrLower.filter((r) => r.room.id !== best?.room.id).slice(0, 4);
  const upgrades = higherTier.slice(0, 3);

  return { best, alternatives, upgrades };
}
