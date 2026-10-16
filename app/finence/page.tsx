import { redirect } from "next/navigation";

// Backward-compatible route for the previously used finance URL.
export default function FinanceCompatibilityPage() {
  redirect("/admin/finance");
}
