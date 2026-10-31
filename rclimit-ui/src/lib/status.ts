import {
  Archive, ArrowDownLeft, ArrowUpRight, BadgeCheck, Ban, Banknote, CheckCircle2, Circle, CircleCheck, CircleDashed,
  CircleDot, CirclePause, Clock, FileCheck2, FileClock, Flag, Loader, LogIn, OctagonAlert, SearchCheck, ShieldCheck,
  ShieldX, Sparkles, Timer, TimerOff, TriangleAlert, Undo2, UserCheck, XCircle, type LucideIcon,
} from 'lucide-react';
import { humanize } from './format';

// The domain status registry (docs/ui_ux_specification.md §6). Every badge, tile, row stripe and filter chip reads from here.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'progress';

export interface StatusInfo {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  attention?: boolean;
}

// The same code can mean different things in different places (IN_PROGRESS is a lead stage and a check state).
export type StatusDomain = 'loan' | 'lead' | 'check' | 'general';

const s = (label: string, tone: Tone, icon: LucideIcon, attention?: boolean): StatusInfo => ({ label, tone, icon, attention });

const LOAN: Record<string, StatusInfo> = {
  NEW: s('New', 'info', Sparkles),
  DOCUMENTS_PENDING: s('Documents pending', 'warning', FileClock),
  LOGGED_IN: s('Logged in', 'progress', LogIn),
  CREDIT_REVIEW: s('Credit review', 'progress', SearchCheck),
  SANCTIONED: s('Sanctioned', 'info', BadgeCheck),
  DISBURSED: s('Disbursed', 'success', Banknote),
  CLOSED: s('Closed', 'neutral', Archive),
  REJECTED: s('Rejected', 'danger', XCircle),
  WITHDRAWN: s('Withdrawn', 'neutral', Undo2),
};

const LEAD: Record<string, StatusInfo> = {
  NEW: s('New', 'info', Sparkles),
  IN_PROGRESS: s('In progress', 'progress', Loader),
  QUALIFIED: s('Qualified', 'success', CheckCircle2),
  CONVERTED: s('Converted', 'success', UserCheck),
  REJECTED: s('Rejected', 'danger', XCircle),
};

const CHECK: Record<string, StatusInfo> = {
  PASSED: s('Passed', 'success', ShieldCheck),
  VERIFIED: s('Verified', 'success', ShieldCheck),
  FAILED: s('Failed', 'danger', ShieldX),
  IN_PROGRESS: s('In progress', 'warning', Clock),
  PENDING: s('Pending', 'warning', Clock),
  NOT_RUN: s('Not run', 'neutral', CircleDashed),
  NOT_STARTED: s('Not run', 'neutral', CircleDashed),
};

const GENERAL: Record<string, StatusInfo> = {
  GREEN: s('Green', 'success', CircleCheck),
  AMBER: s('Amber', 'warning', TriangleAlert),
  WARNING: s('Warning', 'warning', TriangleAlert),
  WARNING_ZONE: s('Warning', 'warning', TriangleAlert),
  RED: s('Red', 'danger', OctagonAlert),
  ON_TIME: s('On time', 'success', Timer),
  OVERDUE: s('Overdue', 'danger', TimerOff, true),
  OVERDUE_LOCK: s('Overdue · locked', 'danger', TimerOff, true),
  STOP_SUPPLY_LOCKED: s('Stop supply', 'danger', Ban, true),
  STOP_SUPPLY: s('Stop supply', 'danger', Ban, true),
  RC_SUBMITTED: s('RC submitted', 'info', FileCheck2),
  FLAGGED: s('Flagged', 'warning', Flag),
  SUSPENDED: s('Suspended', 'danger', CirclePause),
  DEFAULTED: s('Defaulted', 'danger', OctagonAlert),
  ACTIVE: s('Active', 'success', CircleDot),
  INACTIVE: s('Inactive', 'neutral', Circle),
  CLEAN: s('Clean', 'success', CircleCheck),
  HYPOTHECATED: s('Hypothecated', 'info', FileCheck2),
  RC_PENDING: s('RC pending', 'warning', FileClock),
  BLACKLISTED: s('Blacklisted', 'danger', Ban),
  CREDIT: s('Credit', 'success', ArrowDownLeft),
  DEBIT: s('Debit', 'danger', ArrowUpRight),
};

const BY_DOMAIN: Record<StatusDomain, Record<string, StatusInfo>> = {
  loan: LOAN,
  lead: LEAD,
  check: CHECK,
  general: GENERAL,
};

// Order of fallback when a code isn't in the requested domain.
const FALLBACK: Record<string, StatusInfo>[] = [GENERAL, LOAN, LEAD, CHECK];

const warned = new Set<string>();

export function getStatus(code: string | null | undefined, domain: StatusDomain = 'general'): StatusInfo {
  const key = (code ?? '').trim().toUpperCase();
  if (!key) return CHECK.NOT_RUN;
  const found = BY_DOMAIN[domain][key] ?? FALLBACK.map((table) => table[key]).find(Boolean);
  if (found) return found;
  if (import.meta.env.DEV && !warned.has(key)) {
    warned.add(key);
    console.warn(`[status] Unknown status code "${key}" (${domain}); showing it as neutral.`);
  }
  return s(humanize(key), 'neutral', Circle);
}

// Badge/chip classes per tone. Tokens only, so tenant themes and dark mode apply.
export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  neutral: 'bg-muted text-muted-foreground',
  progress: 'bg-primary-subtle text-primary',
};

// Tile/card surfaces per tone (StatusTile, alerts).
export const TONE_SURFACE: Record<Tone, string> = {
  success: 'border-success/30 bg-success-subtle',
  warning: 'border-warning/30 bg-warning-subtle',
  danger: 'border-danger/30 bg-danger-subtle',
  info: 'border-info/30 bg-info-subtle',
  neutral: 'border-border bg-surface',
  progress: 'border-primary/30 bg-primary-subtle',
};

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted-foreground',
  progress: 'text-primary',
};

// Utilization thresholds (§6.4). Tenant settings override the defaults once that response exists.
export const DEFAULT_UTILIZATION_THRESHOLDS = { warnPct: 70, dangerPct: 90 };

export function utilizationTone(pct: number, thresholds = DEFAULT_UTILIZATION_THRESHOLDS): Tone {
  if (pct >= thresholds.dangerPct) return 'danger';
  if (pct >= thresholds.warnPct) return 'warning';
  return 'success';
}
