import { Routes, Route } from 'react-router-dom'
import { AlarmProvider } from './context/AlarmContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ProtectedRoute, AdminRoute, GuestOnlyRoute } from './components/ProtectedRoute'
import AlarmOverlay from './components/AlarmOverlay'
import UpdateNotification from './components/UpdateNotification'
import AppShell from './components/layout/AppShell'
import LandingPage from './pages/guest/LandingPage'
import LoginPage from './pages/guest/LoginPage'
import RegisterPage from './pages/guest/RegisterPage'
import ForgotPasswordPage from './pages/guest/ForgotPasswordPage'
import ResetPasswordPage from './pages/guest/ResetPasswordPage'
import PricingPage from './pages/guest/PricingPage'
import OAuthCallbackPage from './pages/guest/OAuthCallbackPage'
import DashboardPage from './pages/user/DashboardPage'
import BillingPage from './pages/user/BillingPage'
import AiAssistantPage from './pages/user/AiAssistantPage'
import TaskListPage from './pages/user/TaskListPage'
import TaskDetailPage from './pages/user/TaskDetailPage'
import TaskFormPage from './pages/user/TaskFormPage'
import CalendarPage from './pages/user/CalendarPage'
import CategoriesPage from './pages/user/CategoriesPage'
import NotificationHistoryPage from './pages/user/NotificationHistoryPage'
import SettingsPage from './pages/user/SettingsPage'
import ProfilePage from './pages/user/ProfilePage'
import ChangePasswordPage from './pages/user/ChangePasswordPage'
import AdminShell from './components/layout/AdminShell'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <ThemeProvider>
    <LanguageProvider>
    <AlarmProvider>
      <Routes>
        {/* Guest */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnlyRoute>
              <ForgotPasswordPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestOnlyRoute>
              <ResetPasswordPage />
            </GuestOnlyRoute>
          }
        />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

        {/* User */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/new" element={<TaskFormPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="tasks/:id/edit" element={<TaskFormPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="notifications" element={<NotificationHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="ai" element={<AiAssistantPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminShell />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Overlay báo thức toàn màn hình – độc lập với route (SCR-U-07) */}
      <AlarmOverlay />
      
      {/* Thông báo bản cập nhật mới */}
      <UpdateNotification />
    </AlarmProvider>
    </LanguageProvider>
    </ThemeProvider>
  )
}
