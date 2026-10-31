import SimpleMasterPage, { type MasterRow } from '../masters/SimpleMasterPage';

interface ParticularType extends MasterRow {
  particularTypeId: string;
}

export default function ParticularTypesPage() {
  return (
    <SimpleMasterPage<ParticularType>
      title="Line item types"
      description="The particular types offered when a debit is added to a loan's ledger."
      endpoint="/api/v1/particular-types"
      idOf={(r) => r.particularTypeId}
      canUpdate
      noun="Line item type"
      codePlaceholder="STAMP_DUTY"
      labelPlaceholder="Stamp duty charges"
      createHint="After adding a type, set up a matching posting rule under Accounting to map it to debit and credit accounts."
    />
  );
}
