import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import BranchesPage from "@/pages/BranchesPage";
import AdminsPage from "@/pages/AdminsPage";
import RoomsPage from "@/pages/RoomsPage";
import SourcesPage from "@/pages/SourcesPage";
import ReportsPage from "@/pages/ReportsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/admins" element={<AdminsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
