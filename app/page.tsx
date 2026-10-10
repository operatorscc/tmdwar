import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";

type Auction = { id:string; title:string; description:string|null; image_url:string|null; auction_mode:"timed"|"live"; starting_price:number; current_price:number; min_increment:number; starts_at:string; ends_at:string; status:string };
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.from("auctions").select("id,title,description,image_url,auction_mode,starting_price,current_price,min_increment,starts_at,ends_at,status").in("status",["scheduled","live"]).order("ends_at",{ascending:true}).limit(12);
  const auctions = (data ?? []) as Auction[];
  return <div className="container">
    <section className="hero"><div><div className="eyebrow">Temukan · Tawar · Menangkan</div><h1>Barang istimewa.<br/>Kesempatan terbaik.</h1><p>Ikuti lelang pilihan di TMD-WAR. Jelajahi barang, pantau penawaran, dan ajukan bid dengan transparan dari mana saja.</p><a className="btn" href="#lelang">Jelajahi lelang <span aria-hidden>↗</span></a></div>
      <div className="hero-panel"><div><span className="pill">TMD-WAR AUCTION</span><p>Setiap penawaran tercatat. Setiap lelang punya batas waktu yang jelas.</p></div><div><div className="big">Bid smart.</div><div className="big" style={{color:"#e9b56e"}}>Win fair.</div></div></div>
    </section>
    <section id="lelang"><div className="section-head"><div><div className="eyebrow">Koleksi saat ini</div><h2>Lelang pilihan</h2><p>Publik dapat melihat. Login Facebook diperlukan untuk menawar.</p></div></div>
      {auctions.length ? <div className="grid">{auctions.map((a) => <Link className="card" href={`/lelang/${a.id}`} key={a.id}>
        {a.image_url ? <img className="product-image" src={a.image_url} alt={a.title}/> : <div className="product-image"><span>Foto barang belum tersedia</span></div>}
        <div className="card-body"><div className="meta"><span className={`pill ${a.auction_mode==="live"?"live":""}`}>{a.auction_mode==="live"?"Live auction":"Lelang terjadwal"}</span><span>{a.status==="live"?"Sedang berlangsung":"Terjadwal"}</span></div>
          <h3>{a.title}</h3><p className="muted" style={{fontSize:13,lineHeight:1.5}}>{(a.description ?? "Lihat detail barang dan ketentuan lelang.").slice(0,100)}</p>
          <div className="price-row"><div><small>Penawaran tertinggi</small><div className="price">{rupiah(a.current_price)}</div></div><div style={{textAlign:"right"}}><small>Berakhir</small><strong style={{fontSize:13}}>{new Date(a.ends_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short"})}</strong></div></div>
          <div className="btn" style={{width:"100%"}}>Lihat lelang →</div>
        </div></Link>)}</div> : <div className="empty"><h3>Belum ada lelang aktif</h3><p>Barang yang dipublikasikan admin akan muncul di sini.</p></div>}
    </section>
    <section id="cara-kerja" style={{padding:"10px 0 64px"}}><div className="section-head"><div><div className="eyebrow">Mudah dan transparan</div><h2>Cara kerja</h2></div></div><div className="grid">
      {[["01","Pilih barang","Baca deskripsi, harga awal, kenaikan minimum, dan waktu lelang."],["02","Login Facebook","Akun terverifikasi lewat Supabase Auth sebelum mengajukan bid."],["03","Ajukan penawaran","Sistem mengecek waktu dan nominal secara atomik di database."]].map(([n,t,d])=><div className="panel" key={n}><div className="eyebrow">{n}</div><h3>{t}</h3><p className="muted" style={{lineHeight:1.7}}>{d}</p></div>)}
    </div></section>
  </div>;
}
