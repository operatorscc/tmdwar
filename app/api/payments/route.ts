import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  }

  const auctionId = new URL(request.url).searchParams.get("auctionId") || "";
  if (!UUID.test(auctionId)) {
    return NextResponse.json({ error: "ID lelang tidak valid." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("payment_context_for_auction", {
    p_auction_id: auctionId,
  });
  if (error) {
    return NextResponse.json({ error: error.message || "Gagal memuat status pembayaran." }, { status: 400 });
  }

  return NextResponse.json(data ?? { eligible: false }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  }

  let body: { paymentId?: unknown; auctionId?: unknown; amount?: unknown; transferReference?: unknown; proofPath?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Isi pengajuan tidak valid." }, { status: 400 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const auctionId = typeof body.auctionId === "string" ? body.auctionId : "";
  const transferReference = typeof body.transferReference === "string" ? body.transferReference.trim() : "";
  const proofPath = typeof body.proofPath === "string" ? body.proofPath : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);

  if (!UUID.test(paymentId) || !UUID.test(auctionId)) {
    return NextResponse.json({ error: "ID pembayaran atau lelang tidak valid." }, { status: 400 });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "Nominal harus berupa bilangan bulat positif." }, { status: 400 });
  }
  if (!transferReference || transferReference.length > 160) {
    return NextResponse.json({ error: "Referensi transfer wajib diisi, maksimal 160 karakter." }, { status: 400 });
  }
  if (!proofPath || proofPath.length > 500) {
    return NextResponse.json({ error: "Bukti transfer wajib diunggah terlebih dahulu." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("submit_payment_proof", {
    p_payment_id: paymentId,
    p_auction_id: auctionId,
    p_amount: amount,
    p_transfer_reference: transferReference,
    p_proof_path: proofPath,
  });
  if (error) {
    return NextResponse.json({ error: error.message || "Pengajuan pembayaran gagal." }, { status: 400 });
  }

  return NextResponse.json({ id: data, message: "Pengajuan pembayaran terkirim dan menunggu verifikasi admin." }, { status: 201 });
}
