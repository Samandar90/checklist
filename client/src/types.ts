export interface Branch {
  id: string;
  name: string;
  createdAt: string;
  _count?: { admins: number; rooms: number; reports: number };
}

export interface Admin {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
  username?: string | null;
  createdAt: string;
  branch?: Branch;
}

export type Role = "SUPER_ADMIN" | "ADMIN";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  adminId: string | null;
  branchId: string | null;
  fullName: string | null;
  branchName: string | null;
}

export interface Room {
  id: string;
  roomNumber: string;
  branchId: string;
  createdAt: string;
  branch?: Branch;
}

export interface BookingSource {
  id: string;
  name: string;
  createdAt: string;
}

export const paymentMethods = ["Наличные", "Карта", "Терминал"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export interface MonthlyReport {
  id: string;
  date: string;
  branchId: string;
  adminId: string;
  roomId: string;
  sourceId: string;
  price: number;
  currency: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  createdAt: string;
  branch: Branch;
  admin: Admin;
  room: Room;
  source: BookingSource;
}

export interface DashboardStats {
  totalBranches: number;
  totalAdmins: number;
  totalRooms: number;
  totalReports: number;
  totalRevenue: number;
}

export interface ReportSummary {
  totalRevenue: number;
  totalReports: number;
  byBranch: { name: string; total: number; count: number }[];
  byAdmin: { name: string; total: number; count: number }[];
  bySource: { name: string; total: number; count: number }[];
}

export interface ReportFilters {
  month?: string;
  year?: string;
  branchId?: string;
  adminId?: string;
  sourceId?: string;
}
