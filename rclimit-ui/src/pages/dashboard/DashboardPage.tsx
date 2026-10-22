import { useAuth } from '../../hooks/useAuth';
import { dashboardWidgets } from './widgets/registry';

export default function DashboardPage() {
  const { hasRight } = useAuth();
  const visible = dashboardWidgets.filter((w) => hasRight(w.right));

  if (visible.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-500">
        No dashboard widgets are assigned to your role.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visible.map((w) => (
        <w.component key={w.id} />
      ))}
    </div>
  );
}
