import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PaymentReviewClient from "./payment-review-client";

export const metadata: Metadata = {
  title: "Verifikasi Pembayaran — TMD-WAR",
  description: "Periksa bukti transfer pembeli dan putuskan pengajuan pembayaran.",
};

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fpayments");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="app-container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p style={{ color: "var(--gold)", fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>ADMINISTRASI KEUANGAN</p>
          <h1 style={{ marginTop: 6 }}>Verifikasi Pembayaran</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>Setujui hanya setelah nominal, rekening tujuan, referensi, dan mutasi bank cocok.</p>
        </div>
        <Link href="/admin/finance" className="btn-secondary">Kembali ke Keuangan</Link>
      </div>
      <PaymentReviewClient />
    </main>
  );
}
