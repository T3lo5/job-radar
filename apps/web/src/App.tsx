import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthGate } from './components/auth-gate';
import { Layout } from './components/layout';
import { ToastProvider } from './components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const DashboardPage = lazy(() =>
  import('./pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const ProfilePage = lazy(() => import('./pages/profile').then((m) => ({ default: m.ProfilePage })));
const JobsPage = lazy(() => import('./pages/jobs').then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() =>
  import('./pages/job-detail').then((m) => ({ default: m.JobDetailPage })),
);
const ApplicationKitPage = lazy(() =>
  import('./pages/application-kit').then((m) => ({ default: m.ApplicationKitPage })),
);
const CvOptimizerPage = lazy(() =>
  import('./pages/cv-optimizer').then((m) => ({ default: m.CvOptimizerPage })),
);
const ApplicationsPage = lazy(() =>
  import('./pages/applications').then((m) => ({ default: m.ApplicationsPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/analytics').then((m) => ({ default: m.AnalyticsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings').then((m) => ({ default: m.SettingsPage })),
);
const SetupPage = lazy(() => import('./pages/setup').then((m) => ({ default: m.SetupPage })));
const LoginPage = lazy(() => import('./pages/login').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/signup').then((m) => ({ default: m.SignupPage })));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <Routes>
            {/* Públicas: sem sessão nenhuma */}
            <Route path="/login" element={<LazyRoute element={<LoginPage />} />} />
            <Route path="/signup" element={<LazyRoute element={<SignupPage />} />} />
            <Route path="/setup" element={<LazyRoute element={<SetupPage />} />} />

            {/* Protegidas: exigem sessão válida */}
            <Route
              element={
                <AuthGate>
                  <Layout />
                </AuthGate>
              }
            >
              <Route path="/" element={<LazyRoute element={<DashboardPage />} />} />
              <Route path="/profile" element={<LazyRoute element={<ProfilePage />} />} />
              <Route path="/jobs" element={<LazyRoute element={<JobsPage />} />} />
              <Route path="/jobs/:id" element={<LazyRoute element={<JobDetailPage />} />} />
              <Route
                path="/jobs/:id/kit"
                element={<LazyRoute element={<ApplicationKitPage />} />}
              />
              <Route path="/cv-optimizer" element={<LazyRoute element={<CvOptimizerPage />} />} />
              <Route path="/applications" element={<LazyRoute element={<ApplicationsPage />} />} />
              <Route path="/analytics" element={<LazyRoute element={<AnalyticsPage />} />} />
              <Route path="/settings" element={<LazyRoute element={<SettingsPage />} />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function LazyRoute({ element }: { element: JSX.Element }) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

export default App;
