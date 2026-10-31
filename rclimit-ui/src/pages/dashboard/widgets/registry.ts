import type { ComponentType } from 'react';
import LoanStatsWidget from './LoanStatsWidget';
import RcAgingWidget from './RcAgingWidget';
import MyLeadsWidget, { MyLeadsSummaryWidget } from './MyLeadsWidget';

export interface DashboardWidget {
  id: string;
  /** Right required to see this widget (see rclimit-db/seed/002_dashboard_rights.sql). */
  right: string;
  component: ComponentType;
  // Width in the 12-column grid (§7.3 T4).
  span: 4 | 6 | 8 | 12;
}

// To add a widget: create the component, add a `dashboard.*` right, and append an entry here.
export const dashboardWidgets: DashboardWidget[] = [
  { id: 'loan-stats', right: 'dashboard.loan_stats', component: LoanStatsWidget, span: 12 },
  { id: 'rc-aging', right: 'dashboard.rc_aging', component: RcAgingWidget, span: 8 },
  { id: 'my-leads-summary', right: 'dashboard.my_leads', component: MyLeadsSummaryWidget, span: 4 },
  { id: 'my-leads', right: 'dashboard.my_leads', component: MyLeadsWidget, span: 12 },
];
