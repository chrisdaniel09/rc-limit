import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import LendersPage from './pages/lenders/LendersPage';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import LoansPage from './pages/loans/LoansPage';
import LoanDetailPage from './pages/loans/LoanDetailPage';
import PartnersPage from './pages/partners/PartnersPage';
import LeadsPage from './pages/leads/LeadsPage';
import LeadDetailPage from './pages/leads/LeadDetailPage';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import BalanceSheetPage from './pages/accounting/BalanceSheetPage';
import PostingRulesPage from './pages/accounting/PostingRulesPage';
import ParticularTypesPage from './pages/accounting/ParticularTypesPage';
import RolesPage from './pages/admin/RolesPage';
import RightsPage from './pages/admin/RightsPage';
import UsersPage from './pages/admin/UsersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RightProtectedRoute({ children, right }: { children: React.ReactNode; right: string }) {
  const { isAuthenticated, hasRight } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRight(right)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="lenders" element={<LendersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="accounting/accounts" element={<ChartOfAccountsPage />} />
        <Route path="accounting/journal-entries" element={<JournalEntriesPage />} />
        <Route path="accounting/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="accounting/posting-rules" element={<PostingRulesPage />} />
        <Route path="accounting/particular-types" element={<ParticularTypesPage />} />
        <Route path="admin/roles" element={<RightProtectedRoute right="roles.manage"><RolesPage /></RightProtectedRoute>} />
        <Route path="admin/rights" element={<RightProtectedRoute right="rights.manage"><RightsPage /></RightProtectedRoute>} />
        <Route path="admin/users" element={<RightProtectedRoute right="users.manage"><UsersPage /></RightProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
