import { redirect } from "next/navigation";

// Operations opens on Remote control (the live Smartsheet view).
export default function OperationsPage() {
  redirect("/operations/remote-control");
}
