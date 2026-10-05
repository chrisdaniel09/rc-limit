import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/lenders', label: 'Lenders', icon: '🏦' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/loans', label: 'Loans', icon: '📄' },
  { to: '/partners', label: 'Partners', icon: '🤝' },
  { to: '/leads', label: 'Leads', icon: '📋' },
];

const accountingItems = [
  { to: '/accounting/accounts', label: 'Chart of Accounts', icon: '📊' },
  { to: '/accounting/journal-entries', label: 'Journal Entries', icon: '📝' },
  { to: '/accounting/balance-sheet', label: 'Balance Sheet', icon: '📈' },
  { to: '/accounting/posting-rules', label: 'Posting Rules', icon: '⚙' },
  { to: '/accounting/particular-types', label: 'Line Item Types', icon: '☰' },
];

const adminItems = [
  { to: '/admin/roles', label: 'Roles', icon: '👑', right: 'roles.manage' },
  { to: '/admin/rights', label: 'Rights', icon: '🔐', right: 'rights.manage' },
  { to: '/admin/users', label: 'Users', icon: '👤', right: 'users.manage' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { logout, hasRight } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-gray-900 text-white flex flex-col transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
          <span className="text-xl font-bold text-indigo-400">RC</span>
          <span className="text-xl font-bold">Limit</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4 pb-1">
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Accounting</span>
          </div>
          {accountingItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {adminItems.some(item => hasRight(item.right)) && (
            <>
              <div className="pt-4 pb-1">
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Administration</span>
              </div>
              {adminItems.map((item) => (
                hasRight(item.right) && (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </NavLink>
                )
              ))}
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="text-base">⏻</span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
