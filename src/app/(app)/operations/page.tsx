import { ComingSoon } from "@/components/ui";

export default function OperationsPage() {
  return (
    <ComingSoon
      title="Operations"
      phase={3}
      items={[
        "Spreadsheet grid with one row per project, pulled live from the CRM",
        "Add, hide, sort, filter and group columns like Smartsheet",
        "Calendar and board views for move dates, crews and trucks",
        "Task checklist per project (walkthrough, COI, building approvals, elevator booking)",
        "Phone view for crew leads with photos and customer sign-off",
      ]}
    />
  );
}
