import { ComingSoon } from "@/components/ui";

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      phase={4}
      items={[
        "Pipeline value, win rate and quotes sent per rep",
        "Booked revenue by month and jobs per week",
        "Warehouse occupancy and storage revenue",
      ]}
    />
  );
}
