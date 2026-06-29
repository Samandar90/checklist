import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import PageLoader from "@/components/PageLoader";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const BranchesPage = lazy(() => import("@/pages/BranchesPage"));
const AdminsPage = lazy(() => import("@/pages/AdminsPage"));
const RoomsPage = lazy(() => import("@/pages/RoomsPage"));
const SourcesPage = lazy(() => import("@/pages/SourcesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const DebtorsPage = lazy(() => import("@/pages/DebtorsPage"));
const GuestsPage = lazy(() => import("@/pages/GuestsPage"));
const HousekeepingPage = lazy(() => import("@/pages/HousekeepingPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const FinanceCenterPage = lazy(() => import("@/pages/FinanceCenterPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const BackupPage = lazy(() => import("@/pages/BackupPage"));
const MyReportsPage = lazy(() => import("@/pages/MyReportsPage"));
const MyExpensesPage = lazy(() => import("@/pages/MyExpensesPage"));
const CashRegisterPage = lazy(() => import("@/pages/CashRegisterPage"));
const SmartAssignPage = lazy(() => import("@/pages/SmartAssignPage"));
const TimelinePage = lazy(() => import("@/pages/TimelinePage"));
const WorkspacePage = lazy(() => import("@/pages/WorkspacePage"));
const StaffWorkspacePage = lazy(() => import("@/pages/StaffWorkspacePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute allow={["ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/staff" element={<StaffWorkspacePage />} />
                <Route path="/my-reports" element={<MyReportsPage />} />
                <Route path="/my-expenses" element={<MyExpensesPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allow={["SUPER_ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/branches" element={<BranchesPage />} />
                <Route path="/admins" element={<AdminsPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/sources" element={<SourcesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/debtors" element={<DebtorsPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/housekeeping" element={<HousekeepingPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/finance" element={<FinanceCenterPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/timeline" element={<TimelinePage />} />
                <Route path="/backups" element={<BackupPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allow={["SUPER_ADMIN", "ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/smart-assign" element={<SmartAssignPage />} />
                <Route path="/cash-register" element={<CashRegisterPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
