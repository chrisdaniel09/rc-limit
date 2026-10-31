import { apiGet } from '@/api/client';
import type { ComboOption } from '@/components/ui/combobox';
import { formatINR, formatPhone, formatRegNo } from './format';

// Server searches behind record comboboxes (§8.4).

type Envelope<T> = { data?: T } | T;
const unwrap = <T,>(raw: Envelope<T>): T => ((raw as { data?: T })?.data ?? raw) as T;

export interface CustomerHit {
  customerId: string;
  legalName: string;
  tradeName: string | null;
  customerType: string;
  assignedCeiling: number;
  currentUtilization: number;
  stopSupplyFlag: boolean;
}

export async function searchCustomers(term: string): Promise<(ComboOption & { customer: CustomerHit })[]> {
  const raw = await apiGet<Envelope<CustomerHit[]>>(`/api/v1/customers?search=${encodeURIComponent(term)}&pageSize=10`);
  return unwrap(raw).map((c) => ({
    value: c.customerId,
    label: c.legalName,
    secondary: `${c.tradeName ? `${c.tradeName} · ` : ''}Headroom ${formatINR(Math.max(0, c.assignedCeiling - c.currentUtilization), { whole: true })} of ${formatINR(c.assignedCeiling, { whole: true })}`,
    customer: c,
  }));
}

export async function searchPartners(term: string): Promise<ComboOption[]> {
  const raw = await apiGet<Envelope<{ partnerId: string; legalName: string; partnerType?: string; phoneNumber?: string | null }[]>>(
    `/api/v1/partners?search=${encodeURIComponent(term)}&pageSize=10`,
  );
  return unwrap(raw).map((p) => ({ value: p.partnerId, label: p.legalName, secondary: p.phoneNumber ? formatPhone(p.phoneNumber) : undefined }));
}

export async function searchStaff(term: string): Promise<ComboOption[]> {
  const raw = await apiGet<Envelope<{ userId: string; fullName: string; email: string }[]>>('/api/v1/users/lookup');
  const t = term.toLowerCase();
  return unwrap(raw)
    .filter((u) => u.fullName.toLowerCase().includes(t) || u.email.toLowerCase().includes(t))
    .map((u) => ({ value: u.userId, label: u.fullName, secondary: u.email }));
}

export async function customerVehicles(customerId: string): Promise<ComboOption[]> {
  const raw = await apiGet<Envelope<{ vehicleId: string; registrationNumber: string; make?: string; model?: string }[]>>(
    `/api/v1/customers/${customerId}/vehicles`,
  );
  return unwrap(raw).map((v) => ({
    value: v.vehicleId,
    label: formatRegNo(v.registrationNumber),
    secondary: [v.make, v.model].filter(Boolean).join(' ') || undefined,
  }));
}
