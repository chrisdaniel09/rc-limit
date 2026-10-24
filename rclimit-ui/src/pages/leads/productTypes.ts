// Shared shapes for financial requirements (product types), their fields and their actions.
// These mirror the backend's ProductFieldDefinition, ActionDefinition and ProductTypeDto.

export interface FieldValidation {
  pattern: string | null;
  min: number | null;
  max: number | null;
  options: string[] | null;
}

export type FieldType = 'text' | 'number' | 'date' | 'select';

export interface ProductField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  role: string | null;
  validation: FieldValidation | null;
}

export interface ProductAction {
  code: string;
  order: number;
  config: Record<string, unknown>;
}

export interface ProductType {
  productTypeId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  fieldSchema: ProductField[];
  actions: ProductAction[];
}

export interface ActionRun {
  executionId: string;
  actionCode: string;
  actionOrder: number | null;
  status: string;
  response: { outcome?: string; score?: number | null; remarks?: string | null } | null;
  error: string | null;
}

// Action codes the backend implements. Keep in step with ActionCodes in the Leads module.
export const ACTION_LABELS: Record<string, string> = {
  CIBIL_CHECK: 'CIBIL check',
  VAHAN_CHECK: 'Vehicle check (Vahan)',
};

// Actions whose request takes a score. Other actions reject a score.
export const ACTION_TAKES_SCORE: Record<string, boolean> = {
  CIBIL_CHECK: true,
};

export const OUTCOME_OPTIONS = [
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'IN_PROGRESS', label: 'In progress' },
];

// Roles tell the backend what a field means, for example the vehicle registration used for search and conversion.
export const ROLE_OPTIONS = [
  { value: 'vehicle_registration', label: 'Vehicle registration number' },
  { value: 'vehicle_chassis', label: 'Chassis number' },
  { value: 'vehicle_engine', label: 'Engine number' },
  { value: 'vehicle_make', label: 'Make' },
  { value: 'vehicle_model', label: 'Model' },
  { value: 'vehicle_variant', label: 'Variant' },
  { value: 'vehicle_year', label: 'Year of manufacture' },
];

export const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choice (dropdown)' },
];

// Stored value for a detail field. Numbers are kept as numbers, everything else as text.
export type DetailValue = string | number | null;

// Turns the form's text values into the typed values the backend expects. Empty fields are left out.
export function toProductDetails(
  fields: ProductField[],
  values: Record<string, string>,
): Record<string, DetailValue> {
  const details: Record<string, DetailValue> = {};
  for (const field of fields) {
    const raw = (values[field.key] ?? '').trim();
    if (raw === '') continue;
    details[field.key] = field.type === 'number' ? Number(raw) : raw;
  }
  return details;
}
