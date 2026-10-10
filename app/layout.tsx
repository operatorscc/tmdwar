import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "TMD-WAR | Lelang terpercaya",
  description: "Temukan barang pilihan dan ikuti lelang online TMD-WAR."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <html lang="id"><body>
    <header className="topbar"><div className="container nav">
      <Link href="/" className="brand">TMD<span>•</span>WAR</Link>
      <nav className="navlinks"><Link href="/">Jelajahi</Link><Link href="/#cara-kerja">Cara kerja</Link>
        {user ? <><Link href="/akun">Akun</Link><form action="/auth/signout" method="post"><button className="btn secondary" type="submit">Keluar</button></form></> : <Link className="btn" href="/login">Masuk dengan Facebook</Link>}
      </nav>
    </div></header>
    <main>{children}</main>
    <footer className="footer"><div className="container">© {new Date().getFullYear()} TMD-WAR · Lelang online. Pembayaran belum tersedia pada versi awal.</div></footer>
  </body></html>;
}
