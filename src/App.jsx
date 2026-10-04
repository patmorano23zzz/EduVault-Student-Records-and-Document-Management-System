import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { RequireAuth } from './components/RouteGuards'

import PublicLayout from './layouts/PublicLayout'
import AdminLayout from './layouts/AdminLayout'
import TeacherLayout from './layouts/TeacherLayout'

import Home from './pages/public/Home'
import RequestFile from './pages/public/RequestFile'
import TrackRequest from './pages/public/TrackRequest'

import Login from './pages/auth/Login'

import AdminDashboard from './pages/admin/Dashboard'
import AdminStudents from './pages/admin/Students'
import AdminStudentDetail from './pages/admin/StudentDetail'
import AdminDocuments from './pages/admin/Documents'
import AdminRequests from './pages/admin/Requests'
import AdminTeachers from './pages/admin/Teachers'
import AdminAuditLogs from './pages/admin/AuditLogs'
import AdminSettings from './pages/admin/Settings'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyRecoveryEmail from './pages/auth/VerifyRecoveryEmail'

import TeacherStudents from './pages/teacher/Students'
import TeacherStudentDetail from './pages/teacher/StudentDetail'
import TeacherDocuments from './pages/teacher/Documents'
import TeacherMyRequests from './pages/teacher/MyRequests'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/request" element={<RequestFile />} />
                  <Route path="/track" element={<TrackRequest />} />
                </Route>

                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-recovery-email" element={<VerifyRecoveryEmail />} />

                <Route element={<RequireAuth role="admin" />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/students" element={<AdminStudents />} />
                    <Route path="/admin/students/:id" element={<AdminStudentDetail />} />
                    <Route path="/admin/documents" element={<AdminDocuments />} />
                    <Route path="/admin/requests" element={<AdminRequests />} />
                    <Route path="/admin/teachers" element={<AdminTeachers />} />
                    <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                  </Route>
                </Route>

                <Route element={<RequireAuth role="teacher" />}>
                  <Route element={<TeacherLayout />}>
                    <Route path="/teacher" element={<TeacherStudents />} />
                    <Route path="/teacher/students/:id" element={<TeacherStudentDetail />} />
                    <Route path="/teacher/documents" element={<TeacherDocuments />} />
                    <Route path="/teacher/requests" element={<TeacherMyRequests />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
