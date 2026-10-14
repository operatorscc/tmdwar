import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminAuctionForm from "../auction-form";
import type { Auction } from "@/lib/auction";

export const metadata = {
  title: "Edit Lelang — Admin TMD-WAR",
  description: "Edit detail lot lelang yang sudah ada.",
};

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditAuctionPage({ params }: EditPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=%2Fadmin%2Fauction%2F${id}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const { data: auction, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !auction) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="app-container" style={{ maxWidth: 860, margin: "0 auto", padding: "48px 0 84px" }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-tag">Panel Admin</div>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8 }}>
          Edit Lelang
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
          Mengubah: <strong>{auction.title}</strong>
        </p>
      </div>

      <AdminAuctionForm mode="edit" initialData={auction as unknown as Auction} auctionId={id} />
    </div>
  );
}
