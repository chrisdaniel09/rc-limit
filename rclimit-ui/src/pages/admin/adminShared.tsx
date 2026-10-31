import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { humanize } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface Right {
  rightId: string;
  code: string;
  module: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Role {
  roleId: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  rights?: Right[];
}

// §10.12 rights matrix: grouped by module with a tri-state group checkbox and a search box.
export function RightsMatrix({ rights, selected, onChange, disabled }: {
  rights: Right[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = rights.filter((r) => !term || [r.name, r.code, r.module, r.description ?? ''].some((t) => t.toLowerCase().includes(term)));
    const byModule = new Map<string, Right[]>();
    for (const r of matching) byModule.set(r.module, [...(byModule.get(r.module) ?? []), r]);
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rights, search]);
  const set = new Set(selected);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rights" aria-label="Search rights" className="pl-8" />
      </div>
      <p className="num text-caption text-muted-foreground">{selected.length} of {rights.length} rights selected</p>
      {groups.length === 0 && <p className="text-sm text-muted-foreground">No rights match "{search}".</p>}
      {groups.map(([module, items]) => {
        const count = items.filter((r) => set.has(r.rightId)).length;
        const state = count === 0 ? false : count === items.length ? true : 'indeterminate';
        return (
          <fieldset key={module} className="rounded-lg border">
            <legend className="sr-only">{humanize(module)}</legend>
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <Checkbox
                label={<span className="font-medium">{humanize(module)}</span>}
                checked={state}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const ids = items.map((r) => r.rightId);
                  onChange(checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)));
                }}
              />
              <span className="num text-caption text-muted-foreground">{count}/{items.length}</span>
            </div>
            <div className="space-y-1 p-3">
              {items.map((r) => (
                <Checkbox
                  key={r.rightId}
                  label={<>{r.name} <span className={cn('id-mono text-caption text-muted-foreground', !r.isActive && 'line-through')}>{r.code}</span></>}
                  description={r.description ?? undefined}
                  checked={set.has(r.rightId)}
                  disabled={disabled}
                  onCheckedChange={(checked) => onChange(checked ? [...selected, r.rightId] : selected.filter((id) => id !== r.rightId))}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

export const MIN_PASSWORD_LENGTH = 12;

// Rough strength from length and character variety, for the meter only; the server enforces the policy.
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  if (pw.length < MIN_PASSWORD_LENGTH) return { score: 1, label: 'Too short' };
  const score = Math.min(4, (pw.length >= 16 ? 2 : 1) + (variety >= 3 ? 2 : variety >= 2 ? 1 : 0)) as 1 | 2 | 3 | 4;
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  const tone = score <= 1 ? 'bg-danger' : score === 2 ? 'bg-warning' : 'bg-success';
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i <= score ? tone : 'bg-muted')} />)}
      </div>
      <p className="text-caption text-muted-foreground">
        {label ? `${label}. ` : ''}At least {MIN_PASSWORD_LENGTH} characters; a mix of letters, numbers and symbols is stronger.
      </p>
    </div>
  );
}
