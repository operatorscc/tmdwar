import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FinanceClient from "./finance-client";

export const metadata: Metadata = {
  title: "Keuangan & Akuntansi — TMD-WAR",
  description: "Pencatatan keuangan, persediaan, penjualan, penerimaan, dan beban operasional TMD-WAR.",
};

export default async function AdminFinancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin%2Ffinance");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return <FinanceClient />;
}
