import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/layouts/templates';
import { cn } from '@/lib/cn';
import { dashboardWidgets } from './widgets/registry';

const SPAN: Record<number, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// §10.2 Dashboard (T4): widgets the user has rights for, in a 12-column grid.
export default function DashboardPage() {
  const { user, hasRight } = useAuth();
  const visible = dashboardWidgets.filter((w) => hasRight(w.right));
  // A lone 8- or 4-column widget fills the row.
  const spanOf = (w: (typeof visible)[number]) => {
    const pair = w.span === 8 ? 4 : w.span === 4 ? 8 : null;
    return pair && !visible.some((o) => o.span === pair) ? 12 : w.span;
  };

  return (
    <>
      <PageHeader title={`${greeting()}, ${user?.fullName?.split(' ')[0] ?? 'there'}`} />
      {visible.length === 0 ? (
        <EmptyState
          variant="no-access"
          title="No dashboard widgets for your role"
          description={<>Ask an admin for a <span className="id-mono text-foreground">dashboard.*</span> right, such as dashboard.loan_stats.</>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {visible.map((w) => (
            <div key={w.id} className={cn('min-w-0', SPAN[spanOf(w)])}>
              <w.component />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
