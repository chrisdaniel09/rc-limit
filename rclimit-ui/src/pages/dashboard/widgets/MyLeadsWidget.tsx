import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDateTime, formatPhone, formatRegNo, formatRelative } from '@/lib/format';
import WidgetCard from './WidgetCard';

interface MyLeadsSummary {
  totalAssigned: number;
  openLeads: number;
  convertedLeads: number;
}

interface MyLead {
  leadId: string;
  applicantName: string | null;
  whatsappPhoneNumber: string;
  vehicleRegistrationNumber: string | null;
  leadStatus: string;
  cibilCheckStatus: string;
  rcCheckStatus: string;
  createdAt: string;
}

// §10.2 row 2, right: assigned / open / converted as a stacked list with links.
export function MyLeadsSummaryWidget() {
  const { data, loading, error, refetch, fetchedAt } = useFetch<MyLeadsSummary>('/api/v1/dashboard/me', [], { staleAfter: LIST_STALE_MS });
  const rows = [
    { label: 'Assigned to me', value: data?.totalAssigned, to: '/leads?assignedToMe=true' },
    { label: 'Open', value: data?.openLeads, to: '/leads?assignedToMe=true&leadStatus=NEW,IN_PROGRESS,QUALIFIED' },
    { label: 'Converted', value: data?.convertedLeads, to: '/leads?assignedToMe=true&leadStatus=CONVERTED' },
  ];
  return (
    <WidgetCard title="My leads" loading={loading} hasData={data !== null} error={error} onRefresh={refetch} fetchedAt={fetchedAt}>
      <ul className="-mx-card -my-2 divide-y">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={r.to} className="flex items-center justify-between gap-3 px-card py-3 hover:bg-muted/60">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-2">
                <span className="num text-heading text-foreground">{(r.value ?? 0).toLocaleString('en-IN')}</span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

// §10.2 row 3: the 10 newest assigned leads.
export default function MyLeadsWidget() {
  const { data, loading, error, refetch, fetchedAt } = useFetch<MyLead[]>('/api/v1/leads?assignedToMe=true&pageSize=10&sortBy=createdAt&sortDir=desc', [], { staleAfter: LIST_STALE_MS });
  return (
    <WidgetCard
      title="Newest leads assigned to me"
      loading={loading}
      hasData={data !== null}
      error={error}
      onRefresh={refetch}
      fetchedAt={fetchedAt}
      actions={<Button variant="link" size="sm" asChild className="mr-1"><Link to="/leads?assignedToMe=true">View all</Link></Button>}
    >
      {!data || data.length === 0 ? (
        <EmptyState title="No leads assigned to you" description="Leads assigned to you show up here." className="py-6" />
      ) : (
        <div className="-mx-card -mb-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-label text-muted-foreground">
              <tr>
                <th scope="col" className="h-9 px-cell font-medium">Applicant</th>
                <th scope="col" className="hidden px-cell font-medium lg:table-cell">Vehicle</th>
                <th scope="col" className="px-cell font-medium">Checks</th>
                <th scope="col" className="px-cell font-medium">Status</th>
                <th scope="col" className="hidden px-cell font-medium md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((l) => (
                <tr key={l.leadId} className="relative h-row hover:bg-muted/60">
                  <td className="px-cell">
                    <Link to={`/leads/${l.leadId}`} className="font-medium after:absolute after:inset-0 hover:underline">{l.applicantName ?? 'Unnamed lead'}</Link>
                    <span className="num block text-caption text-muted-foreground">{formatPhone(l.whatsappPhoneNumber)}</span>
                  </td>
                  <td className="id-mono hidden whitespace-nowrap px-cell lg:table-cell">{l.vehicleRegistrationNumber ? formatRegNo(l.vehicleRegistrationNumber) : '—'}</td>
                  <td className="px-cell">
                    <span className="relative z-10 inline-flex gap-1">
                      <Tooltip content="CIBIL check"><span><StatusBadge status={l.cibilCheckStatus} domain="check" inTable /></span></Tooltip>
                      <Tooltip content="RC check"><span><StatusBadge status={l.rcCheckStatus} domain="check" inTable /></span></Tooltip>
                    </span>
                  </td>
                  <td className="px-cell"><StatusBadge status={l.leadStatus} domain="lead" inTable /></td>
                  <td className="hidden whitespace-nowrap px-cell md:table-cell">
                    <time dateTime={l.createdAt} title={formatDateTime(l.createdAt)} className="num">{formatRelative(l.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
