"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const searchParams = useSearchParams();
  async function login() {
    setError(""); setLoading(true);
    const supabase = createClient();
    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider:"facebook", options:{ redirectTo, scopes:"email" } });
    if (error) { setError(error.message); setLoading(false); }
  }
  return <div className="container" style={{maxWidth:520,padding:"70px 0 100px"}}><div className="panel">
    <div className="eyebrow">Selamat datang</div><h1 style={{fontSize:36,letterSpacing:-1.5}}>Masuk ke TMD-WAR</h1>
    <p className="muted" style={{lineHeight:1.7}}>Gunakan akun Facebook untuk menawar. Kamu tetap bisa melihat katalog tanpa login.</p>
    {error && <p className="error">{error}</p>}
    <button className="btn" style={{width:"100%",marginTop:16}} onClick={login} disabled={loading}>{loading?"Mengalihkan...":"Masuk dengan Facebook"}</button>
    <p className="muted" style={{fontSize:12,lineHeight:1.6,marginTop:18}}>Dengan masuk, kamu menyetujui ketentuan lelang yang ditampilkan pada setiap barang.</p>
  </div></div>;
}
