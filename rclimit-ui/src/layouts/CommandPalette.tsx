import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Dialog } from 'radix-ui';
import { FilePlus2, FileText, Inbox, Keyboard, Loader2, Moon, Plus, Search, Sun, UserPlus, Users } from 'lucide-react';
import { apiGet } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { formatINR, formatRegNo } from '@/lib/format';
import { getStatus } from '@/lib/status';
import { visibleGroups, WORKSPACE } from './navigation';

// §11.6 Command palette: jump to pages, find records by key or name, run actions.

interface SearchHit {
  id: string;
  group: 'Loans' | 'Customers' | 'Leads';
  title: string;
  subtitle: string;
  to: string;
}

type Envelope<T> = { data?: T } | T;
const unwrap = <T,>(raw: Envelope<T>): T => ((raw as { data?: T })?.data ?? raw) as T;

async function searchRecords(term: string): Promise<SearchHit[]> {
  const q = `search=${encodeURIComponent(term)}&pageSize=5&page=1`;
  const tasks: Promise<SearchHit[]>[] = [
    apiGet<Envelope<{ loanId: string; applicationNumber: string; customerName: string; vehicleRegNo: string; sanctionedAmount: number | null; loanStatus: string }[]>>(`/api/v1/loans?${q}`)
      .then((r) => unwrap(r).map((l) => ({
        id: l.loanId, group: 'Loans' as const, title: l.applicationNumber,
        subtitle: [l.customerName, formatRegNo(l.vehicleRegNo), getStatus(l.loanStatus, 'loan').label, l.sanctionedAmount != null ? formatINR(l.sanctionedAmount, { whole: true }) : null].filter(Boolean).join(' · '),
        to: `/loans/${l.loanId}`,
      }))),
    apiGet<Envelope<{ customerId: string; legalName: string; tradeName: string | null; phoneNumber?: string | null }[]>>(`/api/v1/customers?${q}`)
      .then((r) => unwrap(r).map((c) => ({
        id: c.customerId, group: 'Customers' as const, title: c.legalName, subtitle: c.tradeName ?? '', to: `/customers/${c.customerId}`,
      }))),
  ];
  tasks.push(
    apiGet<Envelope<{ leadId: string; applicantName: string; referenceNumber?: string | null; leadStatus: string }[]>>(`/api/v1/leads?${q}`)
      .then((r) => unwrap(r).map((l) => ({
        id: l.leadId, group: 'Leads' as const, title: l.applicantName,
        subtitle: [l.referenceNumber, getStatus(l.leadStatus, 'lead').label].filter(Boolean).join(' · '), to: `/leads/${l.leadId}`,
      }))),
  );
  const settled = await Promise.allSettled(tasks);
  return settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
}

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: { open: boolean; onOpenChange: (open: boolean) => void; onShowShortcuts: () => void }) {
  const navigate = useNavigate();
  const { hasRight } = useAuth();
  const { resolvedMode, setColorMode } = useTheme();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const id = ++latest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      searchRecords(trimmed).then((results) => {
        if (id === latest.current) {
          setHits(results);
          setLoading(false);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const pages = [...WORKSPACE, ...visibleGroups(hasRight).flatMap((g) => g.items)];
  const groups = (['Loans', 'Customers', 'Leads'] as const).map((g) => ({ name: g, items: hits.filter((h) => h.group === g) })).filter((g) => g.items.length);
  const groupIcon = { Loans: FileText, Customers: Users, Leads: Inbox };

  const itemClass = 'flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm outline-none data-[selected=true]:bg-muted pointer-coarse:py-3';
  const headingClass = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-overlay animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-overlay w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-surface-raised text-foreground shadow-xl outline-none animate-dialog-in">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search records, jump to a page or run an action</Dialog.Description>
          <Command shouldFilter loop className={headingClass} filter={(value, search) => (value.startsWith('record:') ? 1 : value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <div className="flex items-center gap-2 border-b px-3">
              <Search aria-hidden className="size-4 text-muted-foreground" />
              <Command.Input
                value={term}
                onValueChange={setTerm}
                placeholder="Search application #, customer, lead… or type a page"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />}
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                {loading ? 'Searching…' : `No results for "${term}"`}
              </Command.Empty>
              {groups.map((g) => {
                const Icon = groupIcon[g.name];
                return (
                  <Command.Group key={g.name} heading={g.name}>
                    {g.items.map((hit) => (
                      <Command.Item key={hit.id} value={`record:${hit.group}:${hit.id}`} onSelect={() => run(() => navigate(hit.to))} className={itemClass}>
                        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className={g.name === 'Loans' ? 'id-mono block truncate' : 'block truncate'}>{hit.title}</span>
                          {hit.subtitle && <span className="block truncate text-caption text-muted-foreground">{hit.subtitle}</span>}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              <Command.Group heading="Actions">
                <Command.Item value="Create loan new" onSelect={() => run(() => navigate('/loans?new=1'))} className={itemClass}>
                  <FilePlus2 aria-hidden className="size-4 text-muted-foreground" /> Create loan
                </Command.Item>
                <Command.Item value="Add lead new" onSelect={() => run(() => navigate('/leads?new=1'))} className={itemClass}>
                  <Plus aria-hidden className="size-4 text-muted-foreground" /> Add lead
                </Command.Item>
                <Command.Item value="Add customer new" onSelect={() => run(() => navigate('/customers?new=1'))} className={itemClass}>
                  <UserPlus aria-hidden className="size-4 text-muted-foreground" /> Add customer
                </Command.Item>
                <Command.Item value="Toggle dark mode theme light" onSelect={() => run(() => setColorMode(resolvedMode === 'dark' ? 'light' : 'dark'))} className={itemClass}>
                  {resolvedMode === 'dark' ? <Sun aria-hidden className="size-4 text-muted-foreground" /> : <Moon aria-hidden className="size-4 text-muted-foreground" />}
                  {resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                </Command.Item>
                <Command.Item value="Keyboard shortcuts help" onSelect={() => run(onShowShortcuts)} className={itemClass}>
                  <Keyboard aria-hidden className="size-4 text-muted-foreground" /> Keyboard shortcuts
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Go to">
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Command.Item key={p.to} value={`Go to ${p.label}`} onSelect={() => run(() => navigate(p.to))} className={itemClass}>
                      <Icon aria-hidden className="size-4 text-muted-foreground" /> {p.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
