import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
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
import { IrfPage } from './pages/IrfPage';
import { AccessCardPage } from './pages/AccessCardPage';
import { AccessCardPrintView } from './pages/AccessCardPrintView';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

function Private({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  return <ProtectedRoute roles={roles}><Layout>{children}</Layout></ProtectedRoute>;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <Private><DashboardPage /></Private> },
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
  { path: '/access-cards', element: <Private roles={['admin','social_worker']}><AccessCardPage /></Private> },
  { path: '/beneficiaries/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> },
  { path: '/messages', element: <Private roles={['admin','social_worker','coordinator']}><MessagesPage /></Private> },
  { path: '/my-dashboard', element: <Private roles={['claimant']}><ClaimantDashboardPage /></Private> },
  { path: '*', element: <Navigate to="/" /> },
]);

export function MainRoutes() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </AuthProvider>
  );
}
