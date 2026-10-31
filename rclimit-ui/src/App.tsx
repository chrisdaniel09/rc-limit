import { lazy, Suspense, useMemo, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './theme/ThemeProvider';
import { TooltipProvider } from './components/ui/tooltip';
import { ConfirmProvider } from './components/ui/confirm';
import { Toaster } from './components/ui/toast';
import AppShell from './layouts/AppShell';
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from './pages/system/SystemPages';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { SettingsLayout } from './layouts/SettingsLayout';


// Route-level code splitting: each screen loads on first visit.
const cache = new Map<() => Promise<{ default: ComponentType }>, ComponentType>();
function Lazy({ load }: { load: () => Promise<{ default: ComponentType }> }) {
  const Component = useMemo(() => {
    let c = cache.get(load);
    if (!c) {
      c = lazy(load);
      cache.set(load, c);
    }
    return c;
  }, [load]);
  return (
    <Suspense fallback={<div className="space-y-3" aria-busy><div className="h-8 w-48 animate-pulse rounded-md bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>}>
      <Component />
    </Suspense>
  );
}

// §7.2: each route declares its title and breadcrumb trail; the topbar and document.title read them.
export interface RouteHandle {
  title: string;
  // Parent crumbs before the title, e.g. ['Administration', 'Access control'].
  trail?: { label: string; to?: string }[];
}

const h = (title: string, trail?: RouteHandle['trail']): { handle: RouteHandle } => ({ handle: { title, trail } });

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

// Missing right → a 403 page that names it, instead of a silent redirect (§10.16).
function RequireRight({ right, children }: { right: string; children: ReactNode }) {
  const { hasRight } = useAuth();
  if (!hasRight(right)) return <ForbiddenPage right={right} />;
  return <>{children}</>;
}

const MASTERS = [{ label: 'Administration' }, { label: 'Masters', to: '/lenders' }];
const ACCESS = [{ label: 'Administration' }, { label: 'Access control', to: '/admin/users' }];
const ACCOUNTING = [{ label: 'Accounting' }];

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, ...h('Sign in') },
  {
    path: '/',
    element: <RequireAuth><AppShell /></RequireAuth>,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage />, ...h('Dashboard') },
      { path: 'leads', element: <Lazy load={() => import('./pages/leads/LeadsPage')} />, ...h('Leads') },
      { path: 'leads/:id', element: <Lazy load={() => import('./pages/leads/LeadDetailPage')} />, ...h('Lead', [{ label: 'Leads', to: '/leads' }]) },
      { path: 'customers', element: <Lazy load={() => import('./pages/customers/CustomersPage')} />, ...h('Customers') },
      { path: 'customers/:id', element: <Lazy load={() => import('./pages/customers/CustomerDetailPage')} />, ...h('Customer', [{ label: 'Customers', to: '/customers' }]) },
      { path: 'loans', element: <Lazy load={() => import('./pages/loans/LoansPage')} />, ...h('Loans') },
      { path: 'loans/:id', element: <Lazy load={() => import('./pages/loans/LoanDetailPage')} />, ...h('Loan', [{ label: 'Loans', to: '/loans' }]) },
      { path: 'rc-limit-ledger', element: <Lazy load={() => import('./pages/loans/RcLimitLedgerPage')} />, ...h('RC limit ledger') },
      { path: 'partners', element: <Lazy load={() => import('./pages/partners/PartnersPage')} />, ...h('Partners') },
      { path: 'profile', element: <Lazy load={() => import('./pages/profile/ProfilePage')} />, ...h('Profile') },
      {
        element: <SettingsLayout section="masters" />,
        children: [
          { path: 'lenders', element: <Lazy load={() => import('./pages/lenders/LendersPage')} />, ...h('Lenders', MASTERS) },
          { path: 'accounting/particular-types', element: <Lazy load={() => import('./pages/accounting/ParticularTypesPage')} />, ...h('Line item types', MASTERS) },
          {
            path: 'lead-product-types',
            element: <RequireRight right="leads.product_types.manage"><Lazy load={() => import('./pages/leads/ProductTypesPage')} /></RequireRight>,
            ...h('Financial requirements', MASTERS),
          },
          { path: 'masters/document-statuses', element: <Lazy load={() => import('./pages/masters/DocumentStatusesPage')} />, ...h('Document statuses', MASTERS) },
          { path: 'masters/disbursed-to-options', element: <Lazy load={() => import('./pages/masters/DisbursedToOptionsPage')} />, ...h('Disbursed-to options', MASTERS) },
        ],
      },
      {
        element: <SettingsLayout section="access" />,
        children: [
          { path: 'admin/users', element: <RequireRight right="users.manage"><Lazy load={() => import('./pages/admin/UsersPage')} /></RequireRight>, ...h('Users', ACCESS) },
          { path: 'admin/roles', element: <RequireRight right="roles.manage"><Lazy load={() => import('./pages/admin/RolesPage')} /></RequireRight>, ...h('Roles', ACCESS) },
          { path: 'admin/rights', element: <RequireRight right="rights.manage"><Lazy load={() => import('./pages/admin/RightsPage')} /></RequireRight>, ...h('Rights', ACCESS) },
        ],
      },
      { path: 'accounting/accounts', element: <Lazy load={() => import('./pages/accounting/ChartOfAccountsPage')} />, ...h('Chart of accounts', ACCOUNTING) },
      { path: 'accounting/journal-entries', element: <Lazy load={() => import('./pages/accounting/JournalEntriesPage')} />, ...h('Journal entries', ACCOUNTING) },
      { path: 'accounting/balance-sheet', element: <Lazy load={() => import('./pages/accounting/BalanceSheetPage')} />, ...h('Balance sheet', ACCOUNTING) },
      { path: 'accounting/posting-rules', element: <Lazy load={() => import('./pages/accounting/PostingRulesPage')} />, ...h('Posting rules', ACCOUNTING) },
      { path: '*', element: <NotFoundPage />, ...h('Page not found') },
    ],
  },
]);

function Providers() {
  const { resolvedMode } = useTheme();
  return (
    <TooltipProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster theme={resolvedMode} />
      </ConfirmProvider>
    </TooltipProvider>
  );
}

export default function App() {
  return <Providers />;
}
