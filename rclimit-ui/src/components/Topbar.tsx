import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/lenders': 'Lenders',
  '/customers': 'Customers',
  '/loans': 'Loans',
  '/partners': 'Partners',
  '/leads': 'Leads',
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const title = pageTitles[location.pathname] ?? (location.pathname.startsWith('/loans/') ? 'Loan Detail' : 'RCLimit');

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:block">{user?.fullName}</span>
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
          {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      </div>
    </header>
  );
}
