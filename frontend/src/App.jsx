import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import MemberProfilePage from './pages/MemberProfilePage';
import BranchesPage from './pages/BranchesPage';
import EventsPage from './pages/EventsPage';
import ProjectsPage from './pages/ProjectsPage';
import FinancePage from './pages/FinancePage';
import DocumentsPage from './pages/DocumentsPage';
import SponsorsPage from './pages/SponsorsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';

const ProtectedRoute = ({ children, module, action = 'read' }) => {
  const { user, loading, can } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-surface-950">
      <div className="animate-pulse-soft text-brand-400 font-display text-xl">Loading...</div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (module && !can(module, action)) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-950 text-center p-8">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-display text-white mb-2">Access Denied</h2>
      <p className="text-slate-400 text-sm">You don't have permission to view this page.</p>
    </div>
  );

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="members" element={<ProtectedRoute module="members"><MembersPage /></ProtectedRoute>} />
        <Route path="members/:uddami_id" element={<ProtectedRoute module="members"><MemberProfilePage /></ProtectedRoute>} />
        <Route path="branches" element={<ProtectedRoute module="branches"><BranchesPage /></ProtectedRoute>} />
        <Route path="events" element={<ProtectedRoute module="events"><EventsPage /></ProtectedRoute>} />
        <Route path="projects" element={<ProtectedRoute module="projects"><ProjectsPage /></ProtectedRoute>} />
        <Route path="finance" element={<ProtectedRoute module="finance"><FinancePage /></ProtectedRoute>} />
        <Route path="documents" element={<ProtectedRoute module="documents"><DocumentsPage /></ProtectedRoute>} />
        <Route path="sponsors" element={<ProtectedRoute module="sponsors"><SponsorsPage /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute module="analytics"><AnalyticsPage /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute module="audit"><AuditPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute module="users"><UsersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
