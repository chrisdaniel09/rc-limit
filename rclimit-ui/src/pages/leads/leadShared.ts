import type { ActionRun, ProductAction, ProductField } from './productTypes';

export interface LeadListItem {
  leadId: string;
  applicantName: string;
  whatsappPhoneNumber: string;
  contactPhone: string | null;
  productTypeCode: string;
  referenceNumber: string | null;
  leadSource: string;
  referredByUserId: string | null;
  referredByUserName: string | null;
  leadStatus: string;
  notes: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  convertedCustomerId: string | null;
  createdAt: string;
  cibilCheckStatus?: string | null;
  rcCheckStatus?: string | null;
}

export interface LeadDetail {
  leadId: string;
  applicantName: string;
  whatsappPhoneNumber: string;
  contactPhone: string | null;
  leadSource: string;
  referredByUserId: string | null;
  referredByUserName: string | null;
  leadStatus: string;
  notes: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  convertedCustomerName: string | null;
  isLocked: boolean;
  createdAt: string;
  productTypeCode: string;
  referenceNumber: string | null;
  productDetails: Record<string, string | number | null>;
  fieldSchema: ProductField[];
  configuredActions: ProductAction[];
  actionHistory: ActionRun[];
}

export interface StaffUser {
  userId: string;
  fullName: string | null;
  email?: string | null;
}

export const LEAD_SOURCES = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'CALL_IN', label: 'Call-in' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'OTHER', label: 'Other' },
];

export const sourceLabel = (code: string) => LEAD_SOURCES.find((s) => s.value === code)?.label ?? code;

// Statuses a user can set; CONVERTED is reached only by converting.
export const SETTABLE_LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const LEAD_STATUS_OPTIONS = [...SETTABLE_LEAD_STATUSES, { value: 'CONVERTED', label: 'Converted' }];

export const UNASSIGNED = 'UNASSIGNED';
