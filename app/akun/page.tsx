import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export default async function AccountPage() {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fakun");
  const { data: profile } = await supabase.from("profiles").select("display_name,role,created_at").eq("id",user.id).maybeSingle();
  const { data: bids } = await supabase.from("bids").select("id,amount,created_at,auction_id,auctions(title)").eq("bidder_id",user.id).order("created_at",{ascending:false}).limit(20);
  return <div className="container" style={{padding:"44px 0 80px"}}><div className="eyebrow">Akun pengguna</div><h1>Halo, {profile?.display_name || user.user_metadata?.full_name || "Peserta lelang"}</h1><p className="muted">{user.email || "Email tidak dibagikan Facebook"} · Peran: {profile?.role ?? "bidder"}</p>
    <div className="section-head"><div><h2>Riwayat penawaran</h2><p>20 penawaran terbaru dari akun ini.</p></div></div>
    {bids?.length ? <div className="panel">{bids.map((b:any)=><div key={b.id} style={{padding:"14px 0",borderBottom:"1px solid var(--line)"}}><strong>{b.auctions?.title ?? "Lelang"}</strong><div className="muted" style={{fontSize:13,marginTop:5}}>Rp {Number(b.amount).toLocaleString("id-ID")} · {new Date(b.created_at).toLocaleString("id-ID")}</div></div>)}</div> : <div className="empty">Kamu belum mengajukan penawaran.</div>}
  </div>;
}
