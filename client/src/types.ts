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
  type?: string | null;
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

export const paymentStatuses = ["Оплачено", "Частично", "Долг"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export interface MonthlyReport {
  id: string;
  date: string;
  checkOut?: string | null;
  guestName?: string | null;
  branchId: string;
  adminId: string;
  roomId: string;
  sourceId: string;
  price: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  branch: Branch;
  admin: Admin;
  room: Room;
  source: BookingSource;
}

export const expenseCategories = [
  "Зарплата",
  "Аренда",
  "Коммунальные",
  "Снабжение",
  "Ремонт",
  "Маркетинг",
  "Прочее",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export interface Expense {
  id: string;
  date: string;
  branchId: string;
  adminId?: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  note?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  branch: Branch;
  admin?: Admin | null;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  branchId?: string;
  adminId?: string;
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  summary: string;
  changes: string | null;
  createdAt: string;
}

export interface AuditFilters {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CalendarResponse {
  rooms: Room[];
  bookings: MonthlyReport[];
}

export interface BackupSnapshot {
  name: string;
  size: number;
  createdAt: string;
}

export interface DebtorReport extends MonthlyReport {
  debt: number;
}

export interface DebtorsResponse {
  items: DebtorReport[];
  totalDebt: number;
  byBranch: DashboardBucket[];
}

export interface DashboardBucket {
  name: string;
  total: number;
  count: number;
}

export interface DashboardStats {
  totals: { branches: number; admins: number; rooms: number };
  range: { from: string; to: string };
  revenue: number;
  reports: number;
  avgCheck: number;
  totalExpenses: number;
  netProfit: number;
  totalDebt: number;
  occupancy: number;
  today: { revenue: number; reports: number };
  previous: { revenue: number; deltaPct: number | null };
  timeSeries: { date: string; total: number; count: number }[];
  byBranch: DashboardBucket[];
  byAdmin: DashboardBucket[];
  bySource: DashboardBucket[];
  byPayment: DashboardBucket[];
  byExpense: DashboardBucket[];
}

export interface DashboardFilters {
  from?: string;
  to?: string;
  branchId?: string;
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
