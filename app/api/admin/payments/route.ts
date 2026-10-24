import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/validation";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Login admin diperlukan." }, { status: 401 });
  }

  const { isAdmin, error: adminError } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminError || "Akses ditolak." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("payment_submissions")
    .select("id, auction_id, bidder_id, amount, transfer_reference, proof_path, status, submitted_at, decided_at, rejection_reason, finance_transaction_id, auction:auctions(title), bidder:profiles(display_name)")
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Gagal memuat pengajuan pembayaran: " + error.message }, { status: 500 });
  }

  const submissions = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(item.proof_path, 60 * 5);
    return {
      ...item,
      proofUrl: signedError ? null : signed?.signedUrl ?? null,
    };
  }));

  return NextResponse.json({ submissions }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Login admin diperlukan." }, { status: 401 });
  }

  const { isAdmin, error: adminError } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminError || "Akses ditolak." }, { status: 403 });
  }

  let body: { paymentId?: unknown; decision?: unknown; rejectionReason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data keputusan tidak valid." }, { status: 400 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const decision = typeof body.decision === "string" ? body.decision : "";
  const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
    return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });
  }
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "Keputusan verifikasi tidak valid." }, { status: 400 });
  }
  if (decision === "rejected" && (!rejectionReason || rejectionReason.length > 1000)) {
    return NextResponse.json({ error: "Alasan penolakan wajib diisi, maksimal 1.000 karakter." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("review_payment_submission", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_rejection_reason: decision === "rejected" ? rejectionReason : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message || "Keputusan pembayaran gagal disimpan." }, { status: 400 });
  }

  return NextResponse.json({ result: data, message: decision === "approved" ? "Pembayaran disetujui dan jurnal penerimaan dicatat." : "Pengajuan pembayaran ditolak." });
}
