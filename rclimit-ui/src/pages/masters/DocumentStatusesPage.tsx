import SimpleMasterPage, { type MasterRow } from './SimpleMasterPage';

interface DocumentStatus extends MasterRow {
  documentStatusId: string;
}

export default function DocumentStatusesPage() {
  return (
    <SimpleMasterPage<DocumentStatus>
      title="Document statuses"
      description="Post-disbursement document statuses a loan can be set to."
      endpoint="/api/v1/document-statuses"
      idOf={(r) => r.documentStatusId}
      canUpdate
      noun="Document status"
      codePlaceholder="PDD_RECEIVED"
      labelPlaceholder="PDD received"
    />
  );
}
