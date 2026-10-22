import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import GlobalSearch from "./components/GlobalSearch";
import SurgeryConfirmModal from "./components/modals/SurgeryConfirmModal";
import CalendarSyncAlert from "./components/CalendarSyncAlert";

// Pages
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PatientsList from "./pages/PatientsList";
import PatientDetail from "./pages/PatientDetail";
import PlanningPage from "./pages/PlanningPage";
import CalendarPage from "./pages/CalendarPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import RhinoPlannerPage from "./pages/RhinoPlannerPage";
import UsersPage from "./pages/UsersPage";
import ControlsPage from "./pages/ControlsPage";
import SurveysPage from "./pages/SurveysPage";
import SurveyBuilderPage from "./pages/SurveyBuilderPage";
import SurveyFillPage from "./pages/SurveyFillPage";

// Layout component with sidebar
const AppLayout = ({ children }) => {
  const location = useLocation();
  return (
    <div className="flex max-lg:flex-col min-h-screen bg-slate-50">
      <Sidebar currentPath={location.pathname} />
      <main className="flex-1 overflow-auto max-lg:min-w-0 max-lg:overflow-x-hidden">
        <CalendarSyncAlert />
        <GlobalSearch />
        <SurgeryConfirmModal />
        {children}
      </main>
    </div>
  );
};

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <AppLayout>{children}</AppLayout>;
};

// Admin-only route wrapper
const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isAdmin()) return <Navigate to="/" />;
  return <AppLayout>{children}</AppLayout>;
};
function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPageWrapper />} />
          <Route path="/ankieta/:token" element={<SurveyFillPage />} />
          <Route path="/surveys" element={<ProtectedRoute><SurveysPage /></ProtectedRoute>} />
          <Route path="/surveys/builder" element={<ProtectedRoute><SurveyBuilderPage /></ProtectedRoute>} />
          <Route path="/surveys/builder/:id" element={<ProtectedRoute><SurveyBuilderPage /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><PatientsList /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
          <Route path="/planning" element={<ProtectedRoute><PlanningPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/stats" element={<AdminRoute><StatsPage /></AdminRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/controls" element={<ProtectedRoute><ControlsPage /></ProtectedRoute>} />
          <Route path="/rhinoplanner/:patientId" element={<ProtectedRoute><RhinoPlannerPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Wrapper for login page with redirect logic
function LoginPageWrapper() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" />;
  return <LoginPage />;
}

export default App;
