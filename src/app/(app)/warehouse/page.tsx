import { ComingSoon } from "@/components/ui";

export default function WarehousePage() {
  return (
    <ComingSoon
      title="Warehouse"
      phase={4}
      items={[
        "Inventory per account: items, pallets or vaults with location",
        "Barcode labels for receiving, moving and releasing items",
        "History log of every move in and out",
        "Monthly storage billing per account",
      ]}
    />
  );
}
