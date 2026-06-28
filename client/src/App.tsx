import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const BackupPage = lazy(() => import("@/pages/BackupPage"));
const MyReportsPage = lazy(() => import("@/pages/MyReportsPage"));
const MyExpensesPage = lazy(() => import("@/pages/MyExpensesPage"));
const CashRegisterPage = lazy(() => import("@/pages/CashRegisterPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute allow={["ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/my-reports" element={<MyReportsPage />} />
                <Route path="/my-expenses" element={<MyExpensesPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allow={["SUPER_ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/branches" element={<BranchesPage />} />
                <Route path="/admins" element={<AdminsPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/sources" element={<SourcesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/debtors" element={<DebtorsPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/housekeeping" element={<HousekeepingPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/backups" element={<BackupPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allow={["SUPER_ADMIN", "ADMIN"]} />}>
              <Route element={<Layout />}>
                <Route path="/calendar" element={<CalendarPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
