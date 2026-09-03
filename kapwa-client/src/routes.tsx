import React from 'react';
import { ThemeProvider } from '@/lib/theme-context';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { ApiError } from './lib/api-error';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ROLE_REDIRECT_MAP } from './lib/role-access';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './components/PublicLayout';
import { Toaster } from '@/components/ui/sonner';
import { lazy, Suspense } from 'react';

// Route-level code splitting: heavy page modules are loaded lazily per-route
// so the initial bundle stays small (the RouterProvider below is wrapped in a
// Suspense fallback). Layout/ProtectedRoute/PublicLayout/Toaster stay static —
// they are small and needed on the first paint.
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const IntakePage = lazy(() => import('./pages/IntakePage').then(m => ({ default: m.IntakePage })));
const IntakeReviewPage = lazy(() => import('./pages/IntakeReviewPage').then(m => ({ default: m.IntakeReviewPage })));
const CasesPage = lazy(() => import('./pages/CasesPage').then(m => ({ default: m.CasesPage })));
const CaseViewPage = lazy(() => import('./pages/CaseViewPage').then(m => ({ default: m.CaseViewPage })));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage').then(m => ({ default: m.SearchResultsPage })));
const BeneficiariesPage = lazy(() => import('./pages/BeneficiariesPage').then(m => ({ default: m.BeneficiariesPage })));
const BeneficiaryViewPage = lazy(() => import('./pages/BeneficiaryViewPage').then(m => ({ default: m.BeneficiaryViewPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const CaseTrackerPage = lazy(() => import('./pages/CaseTrackerPage').then(m => ({ default: m.CaseTrackerPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const NewUserPage = lazy(() => import('./pages/NewUserPage').then(m => ({ default: m.NewUserPage })));
const ClaimantDashboardPage = lazy(() => import('./pages/ClaimantDashboardPage').then(m => ({ default: m.ClaimantDashboardPage })));
const ApprovalPipelinePage = lazy(() => import('./pages/ApprovalPipelinePage').then(m => ({ default: m.ApprovalPipelinePage })));
const MfaSetupPage = lazy(() => import('./pages/MfaSetupPage').then(m => ({ default: m.MfaSetupPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const CoordinatorDashboardPage = lazy(() => import('./pages/CoordinatorDashboardPage').then(m => ({ default: m.CoordinatorDashboardPage })));
const CoordinatorReferralFormPage = lazy(() => import('./pages/CoordinatorReferralFormPage').then(m => ({ default: m.CoordinatorReferralFormPage })));
const CoordinatorReferralListPage = lazy(() => import('./pages/CoordinatorReferralListPage').then(m => ({ default: m.CoordinatorReferralListPage })));
const ReferralReviewPage = lazy(() => import('./pages/ReferralReviewPage').then(m => ({ default: m.ReferralReviewPage })));
const ReferralsPage = lazy(() => import('./pages/ReferralsPage').then(m => ({ default: m.ReferralsPage })));
const AgencyDashboardPage = lazy(() => import('./pages/AgencyDashboardPage').then(m => ({ default: m.AgencyDashboardPage })));
const AgencyReferralsPage = lazy(() => import('./pages/AgencyReferralsPage').then(m => ({ default: m.AgencyReferralsPage })));
const AgencyReferralDetailPage = lazy(() => import('./pages/AgencyReferralDetailPage').then(m => ({ default: m.AgencyReferralDetailPage })));
const AgencyCardActivitiesPage = lazy(() => import('./pages/AgencyCardActivitiesPage').then(m => ({ default: m.AgencyCardActivitiesPage })));
const AgencyProfilePage = lazy(() => import('./pages/AgencyProfilePage').then(m => ({ default: m.AgencyProfilePage })));
const AccessCardViewPage = lazy(() => import('./pages/AccessCardViewPage').then(m => ({ default: m.AccessCardViewPage })));
const CoordinatorAccessCardsPage = lazy(() => import('./pages/CoordinatorAccessCardsPage').then(m => ({ default: m.CoordinatorAccessCardsPage })));
const AccessCardPrintView = lazy(() => import('./pages/AccessCardPrintView').then(m => ({ default: m.AccessCardPrintView })));
const AnnouncementPage = lazy(() => import('./pages/AnnouncementPage').then(m => ({ default: m.AnnouncementPage })));
const AnnouncementsPage = lazy(() => import('./components/announcements/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const AnnouncementEditPage = lazy(() => import('./components/announcements/AnnouncementEditPage').then(m => ({ default: m.AnnouncementEditPage })));
const CreateAnnouncementPage = lazy(() => import('./components/announcements/CreateAnnouncementPage').then(m => ({ default: m.CreateAnnouncementPage })));
const AnnouncementDetailPage = lazy(() => import('./components/announcements/AnnouncementDetailPage').then(m => ({ default: m.AnnouncementDetailPage })));
const ClaimantAccessCardPage = lazy(() => import('./pages/ClaimantAccessCardPage').then(m => ({ default: m.ClaimantAccessCardPage })));
const MayorReportsPage = lazy(() => import('./pages/MayorReportsPage').then(m => ({ default: m.MayorReportsPage })));
const AuditorPage = lazy(() => import('./pages/AuditorPage').then(m => ({ default: m.AuditorPage })));
const IrfPage = lazy(() => import('./pages/IrfPage').then(m => ({ default: m.IrfPage })));
const IrfDetailPage = lazy(() => import('./pages/IrfDetailPage').then(m => ({ default: m.IrfDetailPage })));
const CreateIrfPage = lazy(() => import('./pages/CreateIrfPage').then(m => ({ default: m.CreateIrfPage })));
const CreateProgramPage = lazy(() => import('./pages/CreateProgramPage').then(m => ({ default: m.CreateProgramPage })));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage').then(m => ({ default: m.ProgramDetailPage })));
const ProgramsPage = lazy(() => import('./pages/ProgramsPage').then(m => ({ default: m.ProgramsPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const PublicProgramsPage = lazy(() => import('./pages/PublicProgramsPage').then(m => ({ default: m.PublicProgramsPage })));
const PublicAnnouncementsPage = lazy(() => import('./pages/PublicAnnouncementsPage').then(m => ({ default: m.PublicAnnouncementsPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const AccessibilityPage = lazy(() => import('./pages/AccessibilityPage').then(m => ({ default: m.AccessibilityPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

function Private({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  return <ProtectedRoute roles={roles}><Layout>{children}</Layout></ProtectedRoute>;
}

// Auth-aware redirect for /
function LandingPageRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={ROLE_REDIRECT_MAP[user.role] ?? '/dashboard'} replace /> : <LandingPage />;
}

const router = createBrowserRouter([
  // === PUBLIC ROUTES ===
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPageRedirect /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'announcements', element: <PublicAnnouncementsPage /> },
      { path: 'announcements/:slug', element: <AnnouncementPage /> },
      { path: 'programs', element: <PublicProgramsPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'accessibility', element: <AccessibilityPage /> },
      { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
    ],
  },
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  { path: 'verify-email', element: <VerifyEmailPage /> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
  { path: 'reset-password', element: <ResetPasswordPage /> },
  // === PROTECTED ROUTES ===
  { path: 'dashboard', element: <Private roles={['admin','social_worker']}><DashboardPage /></Private> },
  { path: '/intake', element: <Private roles={['admin','social_worker']}><IntakePage /></Private> },
  { path: '/intake/review', element: <Private roles={['admin','social_worker']}><IntakeReviewPage /></Private> },
  { path: '/cases', element: <Private roles={['admin','social_worker']}><CasesPage /></Private> },
  { path: '/cases/:id', element: <Private roles={['admin','social_worker']}><CaseViewPage /></Private> },
  { path: '/beneficiaries', element: <Private roles={['admin','social_worker']}><BeneficiariesPage /></Private> },
  { path: '/beneficiaries/:id', element: <Private roles={['admin','social_worker']}><BeneficiaryViewPage /></Private> },
  { path: '/tracker', element: <Private roles={['admin','social_worker','mayor','auditor']}><CaseTrackerPage /></Private> },
  { path: '/admin', element: <Private roles={['admin']}><AdminPage /></Private> },
  { path: '/admin/users/new', element: <Private roles={['admin']}><NewUserPage /></Private> },
  { path: '/approvals', element: <Private roles={['admin','social_worker']}><ApprovalPipelinePage /></Private> },
  { path: '/settings/mfa', element: <Navigate to="/settings" replace /> },
  { path: '/settings', element: <Private><SettingsPage /></Private> },
  { path: '/irf/new', element: <Private roles={['admin','social_worker']}><CreateIrfPage /></Private> },
  { path: '/irf', element: <Private roles={['admin','social_worker']}><IrfPage /></Private> },
  { path: '/irf/:id', element: <Private roles={['admin','social_worker']}><IrfDetailPage /></Private> },

  { path: '/admin/programs/new', element: <Private roles={['admin']}><CreateProgramPage /></Private> },
  { path: '/admin/programs/:id', element: <Private roles={['admin']}><ProgramDetailPage /></Private> },
  { path: '/admin/programs', element: <Private roles={['admin']}><ProgramsPage /></Private> },
  { path: '/coordinator', element: <Navigate to="/coordinator/dashboard" replace /> },
  { path: '/coordinator/dashboard', element: <Private roles={['coordinator']}><CoordinatorDashboardPage /></Private> },
  { path: '/coordinator/referrals', element: <Private roles={['coordinator']}><CoordinatorReferralListPage /></Private> },
  { path: '/coordinator/referrals/new', element: <Private roles={['coordinator']}><CoordinatorReferralFormPage /></Private> },
  { path: '/coordinator/access-cards', element: <Private roles={['coordinator']}><CoordinatorAccessCardsPage /></Private> },
  { path: '/referrals', element: <Private roles={['admin','social_worker','coordinator']}><ReferralsPage /></Private> },
  { path: '/beneficiary/:id/access-card', element: <Private roles={['admin','social_worker','claimant']}><AccessCardViewPage /></Private> },
  { path: '/beneficiary/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> },
  { path: '/intake/referrals', element: <Private roles={['admin','social_worker']}><ReferralReviewPage /></Private> },
  { path: '/agency', element: <Navigate to="/agency/dashboard" replace /> },
  { path: '/agency/dashboard', element: <Private roles={['agency_staff']}><AgencyDashboardPage /></Private> },
  { path: '/agency/referrals', element: <Private roles={['agency_staff']}><AgencyReferralsPage /></Private> },
  { path: '/agency/referrals/:id', element: <Private roles={['admin','social_worker','agency_staff']}><AgencyReferralDetailPage /></Private> },
  { path: '/agency/card-activities', element: <Private roles={['agency_staff']}><AgencyCardActivitiesPage /></Private> },
  { path: '/agency/profile', element: <Private roles={['agency_staff']}><AgencyProfilePage /></Private> },
  { path: '/messages', element: <Private roles={['admin','social_worker','coordinator','claimant']}><MessagesPage /></Private> },
  { path: '/messages/:userId', element: <Private roles={['admin','social_worker','coordinator','claimant']}><MessagesPage /></Private> },
  { path: '/search', element: <Private><SearchResultsPage /></Private> },
  { path: '/notifications', element: <Private><NotificationsPage /></Private> },

  { path: '/reports', element: <Private roles={['mayor']}><MayorReportsPage /></Private> },
  { path: '/audit-logs', element: <Private roles={['auditor']}><AuditorPage /></Private> },
  { path: '/my-dashboard', element: <Private roles={['claimant']}><ClaimantDashboardPage /></Private> },
  { path: '/announcements/manage', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementsPage /></Private> },
  { path: '/announcements/manage/new', element: <Private roles={['admin','social_worker','coordinator']}><CreateAnnouncementPage /></Private> },
  { path: '/announcements/manage/:id', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementDetailPage /></Private> },
  { path: '/announcements/manage/:id/edit', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementEditPage /></Private> },
  { path: '/my-access-card', element: <Private roles={['claimant']}><ClaimantAccessCardPage /></Private> },
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
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </SWRConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
