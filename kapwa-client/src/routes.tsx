import React from 'react';
import { ThemeProvider } from '@/lib/theme-context';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { ApiError } from './lib/api-error';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { IntakePage } from './pages/IntakePage';
import { CasesPage } from './pages/CasesPage';
import { BeneficiariesPage } from './pages/BeneficiariesPage';
import { BeneficiaryViewPage } from './pages/BeneficiaryViewPage';
import { InterventionsPage } from './pages/InterventionsPage';
import { MessagesPage } from './pages/MessagesPage';
import { CaseTrackerPage } from './pages/CaseTrackerPage';
import { CsrPage } from './pages/CsrPage';
import { AdminPage } from './pages/AdminPage';
import { ClaimantDashboardPage } from './pages/ClaimantDashboardPage';
import { FilingPage } from './pages/FilingPage';
import { ApprovalPipelinePage } from './pages/ApprovalPipelinePage';
import { MfaSetupPage } from './pages/MfaSetupPage';
import { CoordinatorDashboardPage } from './pages/CoordinatorDashboardPage';
import { MyAccessCardPage } from './pages/MyAccessCardPage';
import { MayorReportsPage } from './pages/MayorReportsPage';
import { AuditorPage } from './pages/AuditorPage';
import { IrfPage } from './pages/IrfPage';
import { IrfDetailPage } from './pages/IrfDetailPage';
import { AccessCardPage } from './pages/AccessCardPage';
import { AccessCardPrintView } from './pages/AccessCardPrintView';
import { ProgramsPage } from './pages/ProgramsPage';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './components/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { RegisterPage } from './pages/RegisterPage';
import { Toaster } from '@/components/ui/sonner';

function Private({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  return <ProtectedRoute roles={roles}><Layout>{children}</Layout></ProtectedRoute>;
}

// Auth-aware redirect for /
function LandingPageRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

const router = createBrowserRouter([
  // === PUBLIC ROUTES ===
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPageRedirect /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  // === PROTECTED ROUTES ===
  { path: 'dashboard', element: <Private><DashboardPage /></Private> },
  { path: '/intake', element: <Private roles={['admin','social_worker','coordinator']}><IntakePage /></Private> },
  { path: '/cases', element: <Private roles={['admin','social_worker','coordinator']}><CasesPage /></Private> },
  { path: '/beneficiaries', element: <Private roles={['admin','social_worker']}><BeneficiariesPage /></Private> },
  { path: '/beneficiaries/:id', element: <Private roles={['admin','social_worker']}><BeneficiaryViewPage /></Private> },
  { path: '/interventions', element: <Private roles={['admin','social_worker']}><InterventionsPage /></Private> },
  { path: '/tracker', element: <Private roles={['admin','social_worker','coordinator','mayor','auditor']}><CaseTrackerPage /></Private> },
  { path: '/csr', element: <Private roles={['admin','social_worker']}><CsrPage /></Private> },
  { path: '/admin', element: <Private roles={['admin']}><AdminPage /></Private> },
  { path: '/filing', element: <Private roles={['admin','social_worker']}><FilingPage /></Private> },
  { path: '/approvals', element: <Private roles={['admin','social_worker']}><ApprovalPipelinePage /></Private> },
  { path: '/settings/mfa', element: <Private roles={['admin','mayor','auditor']}><MfaSetupPage /></Private> },
  { path: '/irf', element: <Private roles={['admin','social_worker']}><IrfPage /></Private> },
  { path: '/irf/:id', element: <Private roles={['admin','social_worker']}><IrfDetailPage /></Private> },
  { path: '/access-cards', element: <Private roles={['admin','social_worker']}><AccessCardPage /></Private> },
  { path: '/beneficiaries/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> },
  { path: '/programs', element: <Private roles={['admin']}><ProgramsPage /></Private> },
  { path: '/coordinator', element: <Private roles={['coordinator']}><CoordinatorDashboardPage /></Private> },
  { path: '/messages', element: <Private roles={['admin','social_worker','coordinator']}><MessagesPage /></Private> },
  { path: '/my-access-card', element: <Private roles={['claimant']}><MyAccessCardPage /></Private> },
  { path: '/reports', element: <Private roles={['mayor']}><MayorReportsPage /></Private> },
  { path: '/audit-logs', element: <Private roles={['auditor']}><AuditorPage /></Private> },
  { path: '/my-dashboard', element: <Private roles={['claimant']}><ClaimantDashboardPage /></Private> },
  { path: '*', element: <Navigate to="/" /> },
]);

function swrErrorHandler(error: unknown) {
  if (error instanceof ApiError && error.status !== 401) {
    console.error('SWR fetch error:', error);
  }
  // 401s are handled by the api client's refresh interceptor — silent here.
}

export function MainRoutes() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" duration={Infinity} />
      <AuthProvider>
        <SWRConfig
          value={{
            fetcher: api.get,
            onError: swrErrorHandler,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 2000,
            refreshInterval: 0,
          }}
        >
          <RouterProvider router={router} />
        </SWRConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
