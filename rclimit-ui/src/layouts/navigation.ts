import {
  ArrowRightLeft, BookOpenText, FileCheck2, Calculator, ClipboardList, FileText, Handshake, Inbox, KeyRound, Landmark, LayoutDashboard, ListTree,
  NotebookPen, Scale, ShieldCheck, UserCog, Users, Workflow, type LucideIcon,
} from 'lucide-react';

// Sidebar and command palette share this list (§4.8, §7.1).

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  right?: string;
  end?: boolean;
  // Keyboard "g" shortcut letter (§11.6).
  goKey?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  // Collapsible sub-groups inside Administration.
  collapsible?: boolean;
  hidden?: boolean;
}

// Temporarily hidden from the sidebar. Set to true to show the Accounting section again.
export const SHOW_ACCOUNTING = false;

export const WORKSPACE: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, goKey: 'd' },
  { to: '/leads', label: 'Leads', icon: Inbox, goKey: 'l' },
  { to: '/customers', label: 'Customers', icon: Users, goKey: 'c' },
  { to: '/loans', label: 'Loans', icon: FileText, goKey: 'o' },
  { to: '/rc-limit-ledger', label: 'RC limit ledger', icon: BookOpenText },
  { to: '/partners', label: 'Partners', icon: Handshake },
];

export const GROUPS: NavGroup[] = [
  {
    id: 'accounting',
    label: 'Accounting',
    hidden: !SHOW_ACCOUNTING,
    items: [
      { to: '/accounting/accounts', label: 'Chart of accounts', icon: Calculator },
      { to: '/accounting/journal-entries', label: 'Journal entries', icon: NotebookPen },
      { to: '/accounting/balance-sheet', label: 'Balance sheet', icon: Scale },
      { to: '/accounting/posting-rules', label: 'Posting rules', icon: Workflow },
    ],
  },
  {
    id: 'masters',
    label: 'Masters',
    collapsible: true,
    items: [
      { to: '/lenders', label: 'Lenders', icon: Landmark },
      { to: '/accounting/particular-types', label: 'Line item types', icon: ListTree },
      { to: '/lead-product-types', label: 'Financial requirements', icon: ClipboardList, right: 'leads.product_types.manage' },
      { to: '/masters/document-statuses', label: 'Document statuses', icon: FileCheck2 },
      { to: '/masters/disbursed-to-options', label: 'Disbursed-to options', icon: ArrowRightLeft },
    ],
  },
  {
    id: 'access',
    label: 'Access control',
    collapsible: true,
    items: [
      { to: '/admin/users', label: 'Users', icon: UserCog, right: 'users.manage' },
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, right: 'roles.manage' },
      { to: '/admin/rights', label: 'Rights', icon: KeyRound, right: 'rights.manage' },
    ],
  },
];

export function visibleGroups(hasRight: (right: string) => boolean): NavGroup[] {
  return GROUPS.filter((g) => !g.hidden)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.right || hasRight(i.right)) }))
    .filter((g) => g.items.length > 0);
}
