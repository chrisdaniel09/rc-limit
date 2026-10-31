import SimpleMasterPage, { type MasterRow } from './SimpleMasterPage';

interface DisbursedToOption extends MasterRow {
  optionId: string;
}

// The API can add options but not edit them yet, so rows are read-only here.
export default function DisbursedToOptionsPage() {
  return (
    <SimpleMasterPage<DisbursedToOption>
      title="Disbursed-to options"
      description="Who a ledger entry can be paid to or from."
      endpoint="/api/v1/lender-disbursed-to-options"
      idOf={(r) => r.optionId}
      canUpdate={false}
      noun="Option"
      codePlaceholder="CUSTOMER"
      labelPlaceholder="Customer"
    />
  );
}
