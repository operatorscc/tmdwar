import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";
import BidForm from "./bid-form";

export default async function AuctionDetail({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data:a } = await supabase.from("auctions").select("*").eq("id",id).maybeSingle();
  if (!a || !["scheduled","live","ended","cancelled"].includes(a.status)) notFound();
  const { data:{user} } = await supabase.auth.getUser();
  const { data:bids } = await supabase.from("bids").select("id,amount,created_at,profiles(display_name)").eq("auction_id",id).order("amount",{ascending:false}).limit(10);
  const now = new Date();
  const statusLabel = a.status==="live" ? "Sedang berlangsung" : a.status==="scheduled" ? "Akan dimulai" : a.status==="ended" ? "Selesai" : "Dibatalkan";
  const canBid = !!user && a.status==="live" && new Date(a.starts_at)<=now && new Date(a.ends_at)>now;
  return <div className="container"><div style={{paddingTop:24}}><Link className="muted" href="/">← Kembali ke katalog</Link></div>
    <div className="detail"><div>{a.image_url ? <img className="product-image" src={a.image_url} alt={a.title}/> : <div className="product-image" style={{borderRadius:22}}>Foto barang belum tersedia</div>}</div>
      <div><span className={`pill ${a.auction_mode==="live"?"live":""}`}>{a.auction_mode==="live"?"Lelang live":"Lelang berbatas waktu"}</span> <span className="muted" style={{fontSize:13,marginLeft:8}}>{statusLabel}</span>
        <h1>{a.title}</h1><p className="muted" style={{lineHeight:1.8,whiteSpace:"pre-wrap"}}>{a.description || "Tidak ada deskripsi tambahan."}</p>
        <div className="panel" style={{marginTop:22}}><div className="muted" style={{fontSize:13}}>Penawaran tertinggi saat ini</div><div style={{fontSize:32,fontWeight:900,margin:"7px 0 14px"}}>{rupiah(a.current_price)}</div>
          <div className="meta"><span>Harga awal: {rupiah(a.starting_price)}</span><span>Min. kenaikan: {rupiah(a.min_increment)}</span></div>
          <hr style={{border:0,borderTop:"1px solid var(--line)",margin:"18px 0"}}/>
          <div className="field"><label>Mulai</label><div>{new Date(a.starts_at).toLocaleString("id-ID")}</div></div><div className="field"><label>Berakhir</label><div>{new Date(a.ends_at).toLocaleString("id-ID")}</div></div>
          {canBid ? <BidForm auctionId={a.id} currentPrice={Number(a.current_price)} minIncrement={Number(a.min_increment)} /> : !user ? <div style={{marginTop:18}}><Link className="btn" href={`/login?next=${encodeURIComponent(`/lelang/${a.id}`)}`}>Login Facebook untuk menawar</Link></div> : <p className="muted" style={{marginTop:18}}>Penawaran belum dibuka atau lelang sudah berakhir.</p>}
        </div>
      </div>
    </div>
    <section style={{paddingBottom:60}}><div className="section-head"><div><h2>Penawaran terbaru</h2><p>Menampilkan maksimal 10 penawaran tertinggi.</p></div></div>
      {bids?.length ? <div className="panel">{bids.map((b:any)=><div key={b.id} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"13px 0",borderBottom:"1px solid var(--line)"}}><div><strong>{b.profiles?.display_name || "Peserta"}</strong><div className="muted" style={{fontSize:12,marginTop:4}}>{new Date(b.created_at).toLocaleString("id-ID")}</div></div><strong>{rupiah(b.amount)}</strong></div>)}</div> : <div className="empty">Belum ada penawaran. Jadilah penawar pertama.</div>}
    </section>
  </div>;
}
