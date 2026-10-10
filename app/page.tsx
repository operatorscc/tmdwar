import Image from "next/image";
import Link from "next/link";
import { createClient } from "../lib/supabase/server";

type AuctionState = "scheduled" | "live" | "ended";

type Auction = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  auction_mode: string;
  status: AuctionState;
  starting_price: number;
  current_price: number | null;
  min_increment: number;
  starts_at: string | null;
  ends_at: string | null;
};

function formatRupiah(amount: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "Belum ditentukan";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Belum ditentukan";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(parsed) + " WIB";
}

function getAuctionState(auction: Auction): AuctionState {
  const now = Date.now();
  const start = auction.starts_at
    ? new Date(auction.starts_at).getTime()
    : null;
  const end = auction.ends_at
    ? new Date(auction.ends_at).getTime()
    : null;

  if (auction.status === "ended") return "ended";

  if (end !== null && !Number.isNaN(end) && now >= end) {
    return "ended";
  }

  if (
    auction.status === "scheduled" &&
    start !== null &&
    !Number.isNaN(start) &&
    now < start
  ) {
    return "scheduled";
  }

  if (
    start !== null &&
    !Number.isNaN(start) &&
    now < start
  ) {
    return "scheduled";
  }

  return "live";
}

function stateLabel(state: AuctionState): string {
  switch (state) {
    case "live":
      return "SEDANG BERLANGSUNG";
    case "scheduled":
      return "SEGERA DIMULAI";
    case "ended":
      return "LELANG BERAKHIR";
  }
}

function stateClass(state: AuctionState): string {
  switch (state) {
    case "live":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "scheduled":
      return "border-amber-400/40 bg-amber-400/10 text-amber-300";
    case "ended":
      return "border-white/10 bg-white/5 text-zinc-400";
  }
}

function AuctionImage({
  src,
  alt,
  sizes,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div className="flex h-full min-h-48 w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
        <div className="text-center">
          <div className="text-4xl text-amber-400">TMD</div>
          <div className="mt-1 text-xs tracking-[0.3em] text-zinc-500">
            WAR AUCTION
          </div>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
      className="object-cover transition duration-500 group-hover:scale-105"
    />
  );
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

  // Perbaikan TypeScript:
  // Cast melalui unknown untuk mengatasi tipe Supabase yang belum sinkron.
  // Jika query gagal, tampilkan halaman tanpa data lelang.
  const auctions: Auction[] = error
    ? []
    : ((data ?? []) as unknown as Auction[]);

  const auctionItems = auctions.map((auction) => ({
    ...auction,
    displayState: getAuctionState(auction),
  }));

  const liveCount = auctionItems.filter(
    (auction) => auction.displayState === "live"
  ).length;

  const featuredAuction =
    auctionItems.find((auction) => auction.displayState === "live") ??
    auctionItems.find((auction) => auction.displayState === "scheduled") ??
    auctionItems[0] ??
    null;

  const otherAuctions = auctionItems
    .filter((auction) => auction.id !== featuredAuction?.id)
    .slice(0, 6);

  return (
    <main className="min-h-screen overflow-hidden bg-[#090909] text-white">
      {/* NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090909]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-400/50 bg-amber-400/10">
              <span className="text-lg font-black tracking-tight text-amber-400">
                T
              </span>
            </div>
            <div>
              <div className="text-lg font-black tracking-[0.16em]">
                TMD<span className="text-amber-400">•</span>WAR
              </div>
              <div className="text-[9px] tracking-[0.28em] text-zinc-500">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <Link href="#lelang" className="transition hover:text-amber-400">
              Jelajahi
            </Link>
            <Link
              href="#cara-kerja"
              className="transition hover:text-amber-400"
            >
              Cara Kerja
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/akun"
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:border-amber-400/60 hover:text-amber-400"
            >
              Akun
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(217,166,61,0.12),transparent_45%),radial-gradient(ellipse_at_bottom_left,rgba(217,166,61,0.06),transparent_35%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/5 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-amber-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              THE ULTIMATE AUCTION EXPERIENCE
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Temukan.
              <br />
              Menangkan.
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-600 bg-clip-text text-transparent">
                Miliki.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-zinc-400 sm:text-lg">
              Selamat datang di TMD-WAR, tempat berburu barang pilihan melalui
              pengalaman lelang online yang kompetitif, transparan, dan
              menarik.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="#lelang"
                className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-6 py-3.5 font-bold text-black transition hover:bg-amber-300"
              >
                Jelajahi Lelang <span className="ml-2">↗</span>
              </Link>

              <Link
                href="#cara-kerja"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-3.5 font-semibold transition hover:border-amber-400/50 hover:text-amber-400"
              >
                Cara Kerja
              </Link>
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-6 border-t border-white/10 pt-7">
              <div>
                <div className="text-3xl font-black text-amber-400">
                  {auctionItems.length}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Lelang tersedia
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-amber-400">
                  {liveCount}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Lelang berlangsung
                </div>
              </div>
            </div>
          </div>

          {/* FEATURED AUCTION */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-amber-400/5 blur-2xl" />

            {featuredAuction ? (
              <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[#111111] shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <span className="text-xs font-bold tracking-[0.2em] text-amber-400">
                    {featuredAuction.displayState === "live"
                      ? "FEATURED LIVE AUCTION"
                      : "FEATURED AUCTION"}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide ${stateClass(
                      featuredAuction.displayState
                    )}`}
                  >
                    {stateLabel(featuredAuction.displayState)}
                  </span>
                </div>

                <div className="group relative aspect-[4/3] overflow-hidden">
                  <AuctionImage
                    src={featuredAuction.image_url}
                    alt={featuredAuction.title}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <div className="mb-3 text-xs font-bold tracking-[0.2em] text-amber-400">
                      TMD-WAR EXCLUSIVE
                    </div>
                    <h2 className="text-2xl font-black sm:text-3xl">
                      {featuredAuction.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 max-w-lg text-sm leading-6 text-zinc-300">
                      {featuredAuction.description ||
                        "Temukan detail barang dan ikuti proses lelang di TMD-WAR."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <div>
                    <div className="text-xs text-zinc-500">
                      Harga saat ini
                    </div>
                    <div className="mt-1 text-xl font-black text-amber-400">
                      {formatRupiah(
                        featuredAuction.current_price ??
                          featuredAuction.starting_price
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">
                      {featuredAuction.displayState === "scheduled"
                        ? "Mulai lelang"
                        : "Batas lelang"}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-200">
                      {formatDate(
                        featuredAuction.displayState === "scheduled"
                          ? featuredAuction.starts_at
                          : featuredAuction.ends_at
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/lelang/${featuredAuction.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-300 sm:col-span-2"
                  >
                    Lihat Detail Lelang <span className="ml-2">→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#111111] p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/5 text-3xl text-amber-400">
                  ◈
                </div>
                <h2 className="text-xl font-bold">Lelang segera hadir</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  Belum ada barang lelang yang tersedia. Silakan kembali lagi
                  untuk melihat koleksi terbaru.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AUCTION LIST */}
      <section id="lelang" className="scroll-mt-24 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 text-xs font-bold tracking-[0.25em] text-amber-400">
                EXPLORE THE COLLECTION
              </div>
              <h2 className="text-3xl font-black sm:text-4xl">
                Jelajahi Lelang
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-500">
                Pilih barang favoritmu, pantau harga, dan ikuti persaingan
                penawaran.
              </p>
            </div>

            <div className="text-sm text-zinc-500">
              Total <span className="font-bold text-white">{auctionItems.length}</span>{" "}
              lelang
            </div>
          </div>

          {error ? (
            <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <h3 className="font-bold text-red-300">
                Data lelang belum dapat dimuat
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Periksa konfigurasi Supabase, nama tabel, dan izin akses data.
                Silakan coba kembali setelah konfigurasi diperbaiki.
              </p>
            </div>
          ) : otherAuctions.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {otherAuctions.map((auction) => (
                <article
                  key={auction.id}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-[#111111] transition duration-300 hover:-translate-y-1 hover:border-amber-400/30"
                >
                  <Link
                    href={`/lelang/${auction.id}`}
                    className="block"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
                      <AuctionImage
                        src={auction.image_url}
                        alt={auction.title}
                      />
                      <div className="absolute left-4 top-4">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide backdrop-blur-md ${stateClass(
                            auction.displayState
                          )}`}
                        >
                          {stateLabel(auction.displayState)}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
                          {auction.auction_mode === "live"
                            ? "LIVE AUCTION"
                            : "TIMED AUCTION"}
                        </span>
                        <span className="text-xs text-zinc-600">
                          TMD-WAR
                        </span>
                      </div>

                      <h3 className="line-clamp-1 text-lg font-bold transition group-hover:text-amber-400">
                        {auction.title}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">
                        {auction.description ||
                          "Lihat detail barang untuk informasi lebih lanjut."}
                      </p>

                      <div className="mt-5 border-t border-white/10 pt-4">
                        <div className="text-xs text-zinc-500">
                          Harga saat ini
                        </div>
                        <div className="mt-1 text-xl font-black text-amber-400">
                          {formatRupiah(
                            auction.current_price ?? auction.starting_price
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                          <span className="text-zinc-500">
                            {auction.displayState === "scheduled"
                              ? "Mulai"
                              : "Berakhir"}
                          </span>
                          <span className="text-right text-zinc-300">
                            {formatDate(
                              auction.displayState === "scheduled"
                                ? auction.starts_at
                                : auction.ends_at
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold transition group-hover:border-amber-400/30">
                        Lihat Detail
                        <span className="text-amber-400">↗</span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : auctionItems.length === 0 ? (
            <div className="mt-10 rounded-xl border border-white/10 bg-[#111111] px-6 py-16 text-center">
              <div className="text-4xl text-amber-400">◈</div>
              <h3 className="mt-4 text-xl font-bold">
                Belum ada lelang tersedia
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                Koleksi barang lelang akan ditampilkan di sini setelah admin
                menambahkan barang ke sistem.
              </p>
            </div>
          ) : (
            <div className="mt-10 rounded-xl border border-white/10 bg-[#111111] p-8 text-center">
              <p className="text-zinc-400">
                Saat ini hanya ada satu lelang. Lihat informasi lengkapnya
                pada bagian lelang unggulan di atas.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="cara-kerja"
        className="scroll-mt-24 border-y border-white/10 bg-[#0d0d0d]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-xs font-bold tracking-[0.25em] text-amber-400">
              SIMPLE. TRANSPARENT. COMPETITIVE.
            </div>
            <h2 className="text-3xl font-black sm:text-4xl">
              Cara Kerja Lelang
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-500">
              Mulai berburu barang incaranmu dalam tiga langkah sederhana.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#111111] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/5 text-xl font-black text-amber-400">
                01
              </div>
              <h3 className="mt-6 text-lg font-bold">Jelajahi Barang</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Temukan barang yang menarik, baca deskripsinya, dan periksa
                harga awal serta jadwal lelang.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111111] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/5 text-xl font-black text-amber-400">
                02
              </div>
              <h3 className="mt-6 text-lg font-bold">Ajukan Penawaran</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Masuk menggunakan akunmu dan ajukan penawaran sesuai aturan
                serta kenaikan minimum yang berlaku.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111111] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/5 text-xl font-black text-amber-400">
                03
              </div>
              <h3 className="mt-6 text-lg font-bold">Pantau Hasil</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Pantau perkembangan penawaran dan periksa hasil setelah
                periode lelang berakhir.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="#lelang"
              className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-6 py-3.5 font-bold text-black transition hover:bg-amber-300"
            >
              Mulai Jelajahi <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#090909]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/5 font-black text-amber-400">
              T
            </div>
            <div>
              <div className="text-sm font-black tracking-[0.15em]">
                TMD<span className="text-amber-400">•</span>WAR
              </div>
              <div className="text-[9px] tracking-[0.2em] text-zinc-600">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <p className="text-xs leading-6 text-zinc-600">
            © {new Date().getFullYear()} TMD-WAR. All rights reserved.
          </p>

          <Link
            href="/akun"
            className="text-sm text-zinc-500 transition hover:text-amber-400"
          >
            Akun Pengguna ↗
          </Link>
        </div>
      </footer>
    </main>
  );
}
