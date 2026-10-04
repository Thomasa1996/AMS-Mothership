import { ComingSoon } from "@/components/ui";

export default function QuotesPage() {
  return (
    <ComingSoon
      title="Quotes"
      phase={2}
      items={[
        "Quote builder with labor, crew size, trucks, materials, IT and storage line items",
        "Company rate card so every rep prices the same way",
        "Branded PDF sent by email, with online accept and e-signature",
        "Every quote the team has sent in one list, with status and value",
        "An accepted quote marks the project booked",
      ]}
    />
  );
}
