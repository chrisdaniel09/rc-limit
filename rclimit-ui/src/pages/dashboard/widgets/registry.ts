import type { ComponentType } from 'react';
import LoanStatsWidget from './LoanStatsWidget';
import RcAgingWidget from './RcAgingWidget';
import MyLeadsWidget from './MyLeadsWidget';

export interface DashboardWidget {
  id: string;
  /** Right required to see this widget (see rclimit-db/seed/002_dashboard_rights.sql). */
  right: string;
  component: ComponentType;
}

// To add a widget: create the component, add a `dashboard.*` right, and append an entry here.
export const dashboardWidgets: DashboardWidget[] = [
  { id: 'loan-stats', right: 'dashboard.loan_stats', component: LoanStatsWidget },
  { id: 'rc-aging', right: 'dashboard.rc_aging', component: RcAgingWidget },
  { id: 'my-leads', right: 'dashboard.my_leads', component: MyLeadsWidget },
];
