import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import Login from './pages/auth/Login'
import AuthRedirect from './pages/auth/AuthRedirect'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import ManagerAnalytics from './pages/manager/ManagerAnalytics'
import AdminDashboard from './pages/admin/AdminDashboard'
import Analytics from './pages/admin/Analytics'
import Users from './pages/admin/Users'
import AuditLog from './pages/admin/AuditLog'
import Cycles from './pages/admin/Cycles'

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />

        {/* Employee routes */}
        <Route path="/employee" element={
          <ProtectedRoute roles={['employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        } />

        {/* Manager routes */}
        <Route path="/manager" element={
          <ProtectedRoute roles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/manager/approvals" element={
          <ProtectedRoute roles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/manager/analytics" element={
          <ProtectedRoute roles={['manager']}>
            <ManagerAnalytics />
          </ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['admin']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="/admin/cycles" element={
          <ProtectedRoute roles={['admin']}>
            <Cycles />
          </ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute roles={['admin']}>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="/admin/audit" element={
          <ProtectedRoute roles={['admin']}>
            <AuditLog />
          </ProtectedRoute>
        } />

        {/* Azure SSO popup redirect — must be public, no auth guard */}
        <Route path="/auth-redirect" element={<AuthRedirect />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
