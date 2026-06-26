import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import BranchesPage from "@/pages/BranchesPage";
import AdminsPage from "@/pages/AdminsPage";
import RoomsPage from "@/pages/RoomsPage";
import SourcesPage from "@/pages/SourcesPage";
import ReportsPage from "@/pages/ReportsPage";
import MyReportsPage from "@/pages/MyReportsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
