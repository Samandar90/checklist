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
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const MyReportsPage = lazy(() => import("@/pages/MyReportsPage"));
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
                <Route path="/audit" element={<AuditPage />} />
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
