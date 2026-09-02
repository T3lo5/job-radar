import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout'
import { ToastProvider } from './components/ui/toast'
import { DashboardPage } from './pages/dashboard'
import { ProfilePage } from './pages/profile'
import { JobsPage } from './pages/jobs'
import { JobDetailPage } from './pages/job-detail'
import { ApplicationsPage } from './pages/applications'
import { AnalyticsPage } from './pages/analytics'
import { SettingsPage } from './pages/settings'
import { CvOptimizerPage } from './pages/cv-optimizer'
import { SetupPage } from './pages/setup'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <Routes>
            <Route path="/setup" element={<SetupPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/cv-optimizer" element={<CvOptimizerPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
