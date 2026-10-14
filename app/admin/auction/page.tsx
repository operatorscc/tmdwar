import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminAuctionForm from "./auction-form";

export const metadata = {
  title: "Buat Lelang Baru — Admin TMD-WAR",
  description: "Halaman administrasi untuk membuat lot lelang baru.",
};

export default async function AdminCreateAuctionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin%2Fauction");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="app-container" style={{ maxWidth: 860, margin: "0 auto", padding: "48px 0 84px" }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-tag">Panel Admin</div>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8 }}>
          Buat Lelang Baru
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
          Lengkapi detail lot lelang. Lot akan dibuat dengan status <strong>draft</strong> secara default dan dapat dipublikasikan setelah review.
        </p>
      </div>

      <AdminAuctionForm mode="create" />
    </div>
  );
}
