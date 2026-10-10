"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/money";

export default function BidForm({auctionId,currentPrice,minIncrement}:{auctionId:string;currentPrice:number;minIncrement:number}) {
  const [amount,setAmount] = useState(String(currentPrice+minIncrement));
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setBusy(true);
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < currentPrice+minIncrement) {
      setMessage(`Penawaran minimal ${rupiah(currentPrice+minIncrement)}.`); setBusy(false); return;
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("place_bid", { p_auction_id:auctionId, p_amount:value });
    if (error) setMessage(error.message);
    else { setMessage("Penawaran berhasil dicatat."); router.refresh(); }
    setBusy(false);
  }
  return <form onSubmit={submit} style={{marginTop:20}}><div className="field"><label htmlFor="amount">Nominal penawaran (IDR)</label><input id="amount" type="number" min={currentPrice+minIncrement} step="1" value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
    {message && <p className={message.startsWith("Penawaran berhasil")?"success":"error"}>{message}</p>}
    <button className="btn" type="submit" disabled={busy} style={{width:"100%"}}>{busy?"Mengirim...":"Ajukan penawaran"}</button>
    <p className="muted" style={{fontSize:11,lineHeight:1.6}}>Dengan menawar, kamu memahami bahwa penawaran tersimpan dan tidak dapat ditarik kembali melalui aplikasi. Pembayaran belum tersedia.</p>
  </form>;
}
