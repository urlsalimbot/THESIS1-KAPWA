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
import { IntakeReviewPage } from './pages/IntakeReviewPage';
import { CasesPage } from './pages/CasesPage';
import { CaseViewPage } from './pages/CaseViewPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { BeneficiariesPage } from './pages/BeneficiariesPage';
import { BeneficiaryViewPage } from './pages/BeneficiaryViewPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CaseTrackerPage } from './pages/CaseTrackerPage';
import { AdminPage } from './pages/AdminPage';
import { ClaimantDashboardPage } from './pages/ClaimantDashboardPage';
import { ApprovalPipelinePage } from './pages/ApprovalPipelinePage';
import { MfaSetupPage } from './pages/MfaSetupPage';
import { SettingsPage } from './pages/SettingsPage';
import { CoordinatorDashboardPage } from './pages/CoordinatorDashboardPage';
import { CoordinatorReferralFormPage } from './pages/CoordinatorReferralFormPage';
import { CoordinatorReferralListPage } from './pages/CoordinatorReferralListPage';
import { ReferralReviewPage } from './pages/ReferralReviewPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { AccessCardViewPage } from './pages/AccessCardViewPage';
import { CoordinatorAccessCardsPage } from './pages/CoordinatorAccessCardsPage';
import { AccessCardPrintView } from './pages/AccessCardPrintView';

import { MayorReportsPage } from './pages/MayorReportsPage';
import { AuditorPage } from './pages/AuditorPage';
import { IrfPage } from './pages/IrfPage';
import { IrfDetailPage } from './pages/IrfDetailPage';
import { CreateIrfPage } from './pages/CreateIrfPage';
import { CreateProgramPage } from './pages/CreateProgramPage';

import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './components/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
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
    ],
  },
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  { path: 'verify-email', element: <VerifyEmailPage /> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
  { path: 'reset-password', element: <ResetPasswordPage /> },
  // === PROTECTED ROUTES ===
  { path: 'dashboard', element: <Private><DashboardPage /></Private> },
  { path: '/intake', element: <Private roles={['admin','social_worker']}><IntakePage /></Private> },
  { path: '/intake/review', element: <Private roles={['admin','social_worker']}><IntakeReviewPage /></Private> },
  { path: '/cases', element: <Private roles={['admin','social_worker','coordinator']}><CasesPage /></Private> },
  { path: '/cases/:id', element: <Private roles={['admin','social_worker','coordinator']}><CaseViewPage /></Private> },
  { path: '/beneficiaries', element: <Private roles={['admin','social_worker']}><BeneficiariesPage /></Private> },
  { path: '/beneficiaries/:id', element: <Private roles={['admin','social_worker']}><BeneficiaryViewPage /></Private> },
  { path: '/tracker', element: <Private roles={['admin','social_worker','coordinator','mayor','auditor']}><CaseTrackerPage /></Private> },
  { path: '/admin', element: <Private roles={['admin']}><AdminPage /></Private> },
  { path: '/approvals', element: <Private roles={['admin','social_worker']}><ApprovalPipelinePage /></Private> },
  { path: '/settings/mfa', element: <Navigate to="/settings" replace /> },
  { path: '/settings', element: <Private><SettingsPage /></Private> },
  { path: '/irf/new', element: <Private roles={['admin','social_worker']}><CreateIrfPage /></Private> },
  { path: '/irf', element: <Private roles={['admin','social_worker']}><IrfPage /></Private> },
  { path: '/irf/:id', element: <Private roles={['admin','social_worker']}><IrfDetailPage /></Private> },

  { path: '/programs/new', element: <Private roles={['admin']}><CreateProgramPage /></Private> },
  { path: '/programs/:id', element: <Private roles={['admin']}><ProgramDetailPage /></Private> },
  { path: '/programs', element: <Private roles={['admin']}><ProgramsPage /></Private> },
  { path: '/coordinator', element: <Navigate to="/coordinator/dashboard" replace /> },
  { path: '/coordinator/dashboard', element: <Private roles={['coordinator']}><CoordinatorDashboardPage /></Private> },
  { path: '/coordinator/referrals', element: <Private roles={['coordinator']}><CoordinatorReferralListPage /></Private> },
  { path: '/coordinator/referrals/new', element: <Private roles={['coordinator']}><CoordinatorReferralFormPage /></Private> },
  { path: '/coordinator/access-cards', element: <Private roles={['coordinator']}><CoordinatorAccessCardsPage /></Private> },
  { path: '/referrals', element: <Private roles={['admin','social_worker','coordinator']}><ReferralsPage /></Private> },
  { path: '/beneficiary/:id/access-card', element: <Private roles={['admin','social_worker','claimant']}><AccessCardViewPage /></Private> },
  { path: '/beneficiary/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> },
  { path: '/intake/referrals', element: <Private roles={['admin','social_worker']}><ReferralReviewPage /></Private> },
  { path: '/messages', element: <Private roles={['admin','social_worker','coordinator','claimant']}><MessagesPage /></Private> },
  { path: '/messages/:userId', element: <Private roles={['admin','social_worker','coordinator','claimant']}><MessagesPage /></Private> },
  { path: '/search', element: <Private><SearchResultsPage /></Private> },
  { path: '/notifications', element: <Private><NotificationsPage /></Private> },

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
      <Toaster position="top-center" closeButton duration={6000} />
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
