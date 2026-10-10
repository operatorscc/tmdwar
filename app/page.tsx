import Link from "next/link";
import { createClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

type Auction = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  auction_mode: "timed" | "live";
  status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  starting_price: number;
  current_price: number;
  min_increment: number;
  starts_at: string;
  ends_at: string;
};

const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

function statusLabel(status: Auction["status"]) {
  switch (status) {
    case "scheduled":
      return "Akan datang";
    case "live":
      return "Sedang berlangsung";
    case "ended":
      return "Selesai";
    default:
      return status;
  }
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("auctions")
    .select(
      "id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at"
    )
    .in("status", ["scheduled", "live", "ended"])
    .order("created_at", { ascending: false });

  const auctions = (data ?? []) as Auction[];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black tracking-wider">
            TMD<span className="text-amber-400">-WAR</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white">
              Lelang
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-950 hover:bg-amber-300"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-10 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-amber-400">
            Timed Auction · Live Auction
          </p>

          <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
            Temukan barang incaranmu.
            <span className="text-amber-400"> Ajukan penawaranmu.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-slate-300">
            Ikuti lelang TMD-WAR, pantau harga tertinggi, dan ajukan
            penawaran saat lelang dibuka.
          </p>

          <a
            href="#daftar-lelang"
            className="mt-7 inline-block rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 hover:bg-amber-300"
          >
            Lihat daftar lelang
          </a>
        </div>

        <div
          id="daftar-lelang"
          className="mb-6 flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h2 className="text-2xl font-bold">Daftar Lelang</h2>
            <p className="mt-1 text-sm text-slate-400">
              Barang yang telah dipublikasikan oleh admin.
            </p>
          </div>

          <span className="text-sm text-slate-400">
            {auctions.length} lelang
          </span>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
            <h3 className="font-bold">Data lelang belum dapat dimuat.</h3>
            <p className="mt-2 text-sm">
              Periksa Environment Variables Vercel, koneksi Supabase, dan
              kebijakan RLS tabel auctions.
            </p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-10 text-center">
            <h3 className="text-xl font-bold">Belum ada barang lelang</h3>
            <p className="mt-2 text-slate-400">
              Barang akan tampil di sini setelah admin membuat lelang
              dengan status scheduled atau live.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => {
              const isLive =
                auction.status === "live" &&
                new Date(auction.starts_at).getTime() <= Date.now() &&
                new Date(auction.ends_at).getTime() > Date.now();

              return (
                <article
                  key={auction.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 transition hover:-translate-y-1 hover:border-amber-400/50"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-800">
                    {auction.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={auction.image_url}
                        alt={auction.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl text-slate-600">◇</span>
                    )}

                    <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-bold">
                      {auction.auction_mode === "live"
                        ? "LIVE AUCTION"
                        : "TIMED AUCTION"}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isLive
                            ? "bg-emerald-400/15 text-emerald-300"
                            : auction.status === "ended"
                              ? "bg-slate-700 text-slate-300"
                              : "bg-amber-400/15 text-amber-300"
                        }`}
                      >
                        {statusLabel(auction.status)}
                      </span>

                      <span className="text-xs text-slate-400">
                        Minimum naik {rupiah(auction.min_increment)}
                      </span>
                    </div>

                    <h3 className="line-clamp-2 min-h-14 text-xl font-bold">
                      {auction.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-400">
                      {auction.description || "Informasi barang belum tersedia."}
                    </p>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-sm text-slate-400">
                        {auction.status === "ended"
                          ? "Harga akhir"
                          : "Harga tertinggi"}
                      </p>

                      <p className="mt-1 text-2xl font-black text-amber-400">
                        {rupiah(auction.current_price)}
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        Berakhir: {dateTime(auction.ends_at)} WIB
                      </p>
                    </div>

                    <Link
                      href={`/auctions/${auction.id}`}
                      className="mt-5 block rounded-xl border border-amber-400/50 px-4 py-3 text-center font-bold text-amber-300 transition hover:bg-amber-400 hover:text-slate-950"
                    >
                      Lihat detail lelang
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TMD-WAR. Semua hak dilindungi.
      </footer>
    </main>
  );
}
