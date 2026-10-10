
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

function getStatus(auction: Auction) {
  const now = Date.now();

  if (auction.status === "ended" || now >= new Date(auction.ends_at).getTime()) {
    return { label: "LELANG SELESAI", style: "ended" };
  }

  if (auction.status === "scheduled" || now < new Date(auction.starts_at).getTime()) {
    return { label: "SEGERA HADIR", style: "upcoming" };
  }

  return { label: "LELANG BERLANGSUNG", style: "live" };
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
  const liveCount = auctions.filter((a) => getStatus(a).style === "live").length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#101110] text-[#f7f5ef]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#101110]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffc857] text-lg font-black text-[#151515]">
              T
            </span>
            <span className="text-xl font-black tracking-tight">
              TMD<span className="text-[#ffc857]">-WAR</span>
              <span className="ml-2 hidden text-[9px] font-bold tracking-[0.25em] text-white/40 sm:inline">
                AUCTION HOUSE
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
            <a href="#lelang" className="transition hover:text-[#ffc857]">Jelajahi</a>
            <a href="#lelang" className="transition hover:text-[#ffc857]">Lelang Live</a>
            <a href="#cara-kerja" className="transition hover:text-[#ffc857]">Cara Kerja</a>
          </nav>

          <Link
            href="/login"
            className="shrink-0 rounded-full bg-[#ffc857] px-5 py-3 text-sm font-bold text-[#151515] transition hover:bg-[#ffda85]"
          >
            Masuk <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section className="relative border-b border-white/[0.08]">
        <div className="pointer-events-none absolute -right-48 -top-24 h-[500px] w-[500px] rounded-full bg-[#ffc857]/[0.07] blur-[120px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ffc857]/25 bg-[#ffc857]/[0.07] px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-[#ffc857]">
              <span className="h-2 w-2 rounded-full bg-[#ffc857]" />
              TEMPATNYA BERBURU BARANG PILIHAN
            </div>

            <h1 className="max-w-2xl text-5xl font-black leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Bukan sekadar membeli.
              <span className="mt-2 block text-[#ffc857]">Menangkan.</span>
            </h1>

            <p className="mt-7 max-w-lg text-base leading-8 text-white/55 sm:text-lg">
              Temukan barang incaranmu, ikuti persaingan secara langsung,
              dan ajukan penawaran terbaik di TMD-WAR.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#lelang"
                className="rounded-full bg-[#ffc857] px-7 py-4 text-sm font-extrabold text-[#151515] transition hover:-translate-y-0.5 hover:bg-[#ffda85]"
              >
                Jelajahi Lelang <span aria-hidden="true">→</span>
              </a>
              <a
                href="#cara-kerja"
                className="rounded-full border border-white/15 px-7 py-4 text-sm font-bold text-white/80 transition hover:border-white/40 hover:bg-white/[0.04]"
              >
                Cara Kerja
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-white/45">
              <span>✓ Harga transparan</span>
              <span>✓ Penawaran terverifikasi</span>
              <span>✓ Update langsung</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute inset-8 rounded-full bg-[#ffc857]/10 blur-[70px]" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#191a17] p-3 shadow-2xl shadow-black/40">
              <div className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[1.5rem] bg-[radial-gradient(ellipse_at_50%_38%,#51452b_0%,#27251e_38%,#171815_75%)] p-6 sm:min-h-[410px] sm:p-8">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold tracking-[0.25em] text-white/55">FEATURED COLLECTION</span>
                  <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-bold text-[#ffc857]">TMD SELECT</span>
                </div>

                <div className="relative flex flex-1 items-center justify-center py-5">
                  {auctions.find((a) => a.image_url)?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={auctions.find((a) => a.image_url)!.image_url!}
                      alt="Pilihan barang lelang TMD-WAR"
                      className="max-h-[260px] w-full object-contain drop-shadow-2xl sm:max-h-[320px]"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-[#ffc857]/25 bg-black/20 sm:h-48 sm:w-48">
                        <span className="text-7xl font-black tracking-tighter text-[#ffc857] sm:text-8xl">T.</span>
                      </div>
                      <p className="mt-5 text-xs tracking-[0.3em] text-white/45">YOUR NEXT GREAT FIND</p>
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                  <div>
                    <p className="text-[10px] tracking-[0.2em] text-white/45">THE THRILL OF THE BID</p>
                    <p className="mt-2 text-xl font-black sm:text-2xl">Temukan. Tawar. Menangkan.</p>
                  </div>
                  <span className="text-3xl text-[#ffc857]" aria-hidden="true">↗</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-2 rounded-2xl border border-white/10 bg-[#20211d] px-5 py-4 shadow-xl sm:-left-6">
              <p className="text-[10px] font-bold tracking-[0.15em] text-white/45">LELANG AKTIF</p>
              <p className="mt-1 text-2xl font-black text-[#ffc857]">{liveCount.toString().padStart(2, "0")}<span className="ml-2 text-xs font-medium text-white/45">sedang berlangsung</span></p>
            </div>
          </div>
        </div>
      </section>

      <section id="lelang" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-[0.25em] text-[#ffc857]">PILIHAN UNTUKMU</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Sedang diperebutkan<span className="text-[#ffc857]">.</span></h2>
            <p className="mt-3 text-sm text-white/45">Barang pilihan. Penawaran nyata.</p>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55">
            {auctions.length} barang terdaftar
          </span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-6 text-red-200">
            <p className="font-bold">Data lelang belum dapat dimuat.</p>
            <p className="mt-2 text-sm text-red-200/70">Periksa koneksi Supabase, Environment Variables Vercel, dan kebijakan RLS tabel auctions.</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 text-3xl text-[#ffc857]">◇</div>
            <h3 className="mt-5 text-xl font-bold">Koleksi pertama segera hadir</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
              Belum ada barang yang dipublikasikan. Barang lelang yang dibuat admin akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => {
              const state = getStatus(auction);
              const isLive = state.style === "live";

              return (
                <article
                  key={auction.id}
                  className="group overflow-hidden rounded-3xl border border-white/[0.09] bg-[#171815] transition duration-300 hover:-translate-y-1 hover:border-[#ffc857]/35 hover:shadow-2xl hover:shadow-black/20"
                >
                  <Link href={`/auctions/${auction.id}`} className="block">
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#20211d]">
                      {auction.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={auction.image_url}
                          alt={auction.title}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#373328_0%,#20211d_65%)]">
                          <span className="text-6xl font-black text-[#ffc857]/50">T.</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />

                      <span className={`absolute left-4 top-4 rounded-full px-3 py-2 text-[10px] font-extrabold tracking-[0.12em] ${
                        isLive ? "bg-[#ffc857] text-[#171815]" : "border border-white/15 bg-black/60 text-white"
                      }`}>
                        {isLive && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />}
                        {state.label}
                      </span>

                      <span className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white/85 backdrop-blur">
                        {auction.auction_mode === "live" ? "LIVE AUCTION" : "TIMED AUCTION"}
                      </span>
                    </div>

                    <div className="p-5 sm:p-6">
                      <h3 className="line-clamp-1 text-lg font-bold transition group-hover:text-[#ffc857]">{auction.title}</h3>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-white/45">
                        {auction.description || "Detail barang akan tersedia pada halaman lelang."}
                      </p>

                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.09] pt-5">
                        <div>
                          <p className="text-[10px] font-bold tracking-[0.15em] text-white/40">
                            {state.style === "ended" ? "HARGA AKHIR" : "PENAWARAN TERTINGGI"}
                          </p>
                          <p className="mt-2 text-xl font-black tracking-tight text-[#ffc857]">
                            {rupiah(auction.current_price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-white/40">Kelipatan bid</p>
                          <p className="mt-1 text-xs font-semibold text-white/75">{rupiah(auction.min_increment)}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xs text-white/40">
                          {state.style === "ended" ? "Lelang telah berakhir" : `Berakhir ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(auction.ends_at))}`}
                        </p>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-lg transition group-hover:border-[#ffc857] group-hover:bg-[#ffc857] group-hover:text-[#171815]">↗</span>
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="cara-kerja" className="border-y border-white/[0.08] bg-[#151613]">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <p className="text-[11px] font-bold tracking-[0.25em] text-[#ffc857]">MUDAH DIMULAI</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Tiga langkah menuju kemenangan.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", title: "Temukan", desc: "Jelajahi koleksi barang dan pilih lelang yang menarik." },
              { n: "02", title: "Ajukan bid", desc: "Login dan masukkan penawaran sesuai kelipatan minimum." },
              { n: "03", title: "Menangkan", desc: "Pantau lelang sampai selesai dan periksa hasilnya." },
            ].map((item) => (
              <div key={item.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <p className="text-sm font-black tracking-widest text-[#ffc857]">{item.n}</p>
                <h3 className="mt-5 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/45">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-white/35 lg:px-8">
        <p>© {new Date().getFullYear()} TMD-WAR Auction House.</p>
        <p>Temukan barangmu. Tentukan penawaranmu.</p>
      </footer>
    </main>
  );
}
