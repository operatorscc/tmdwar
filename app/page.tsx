
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

function rupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function dateWIB(value: string | null) {
  if (!value) return "Jadwal belum ditentukan";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jadwal belum ditentukan";

  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB"
  );
}

function getState(auction: Auction): AuctionState {
  if (auction.status === "ended") return "ended";

  const now = Date.now();
  const start = auction.starts_at
    ? new Date(auction.starts_at).getTime()
    : null;
  const end = auction.ends_at
    ? new Date(auction.ends_at).getTime()
    : null;

  if (end !== null && Number.isFinite(end) && now >= end) {
    return "ended";
  }

  if (auction.status === "scheduled") {
    if (start === null || !Number.isFinite(start) || now < start) {
      return "scheduled";
    }
  }

  return "live";
}

function Status({ state }: { state: AuctionState }) {
  const styles = {
    live: "border-red-400/30 bg-red-500/15 text-red-300",
    scheduled: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    ended: "border-white/10 bg-white/5 text-white/50",
  };

  const labels = {
    live: "LELANG BERLANGSUNG",
    scheduled: "SEGERA DIMULAI",
    ended: "LELANG SELESAI",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-2 text-[9px] font-bold tracking-[0.13em] ${styles[state]}`}
    >
      {state === "live" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
      )}
      {labels[state]}
    </span>
  );
}

function Artwork({
  src,
  title,
  priority = false,
}: {
  src: string | null;
  title: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#24241f]">
        <div className="text-center">
          <div className="text-5xl font-black tracking-[-0.1em] text-[#d9b567]">
            TMD<span className="text-white">.</span>
          </div>
          <div className="mt-3 text-[9px] tracking-[0.35em] text-white/40">
            AUCTION HOUSE
          </div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      loading={priority ? "eager" : "lazy"}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
    />
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
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

  const auctions: Auction[] = error
    ? []
    : ((data ?? []) as unknown as Auction[]);

  const items = auctions.map((auction) => ({
    ...auction,
    displayState: getState(auction),
  }));

  const featured =
    items.find((item) => item.displayState === "live") ??
    items.find((item) => item.displayState === "scheduled") ??
    items[0] ??
    null;

  const others = items.filter((item) => item.id !== featured?.id).slice(0, 6);

  const liveCount = items.filter(
    (item) => item.displayState === "live"
  ).length;

  const scheduledCount = items.filter(
    (item) => item.displayState === "scheduled"
  ).length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#10110f] text-[#f6f4ee]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#10110f]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#d9b567] text-xl font-black text-[#171711]">
              T
            </div>
            <div>
              <div className="text-lg font-black tracking-[-0.07em]">
                TMD<span className="text-[#d9b567]">•</span>WAR
              </div>
              <div className="mt-0.5 text-[8px] font-semibold tracking-[0.28em] text-white/40">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-medium text-white/60 md:flex">
            <Link href="/" className="text-[#d9b567]">
              Beranda
            </Link>
            <Link href="#katalog" className="transition hover:text-white">
              Katalog lelang
            </Link>
            <Link href="#panduan" className="transition hover:text-white">
              Cara kerja
            </Link>
          </nav>

          <Link
            href="/akun"
            className="inline-flex min-h-10 items-center gap-3 bg-[#d9b567] px-4 text-xs font-bold text-[#171711] transition hover:bg-[#f0d28d] sm:px-5"
          >
            Masuk / Akun <Arrow />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative border-b border-white/[0.08]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#b58d3e]/[0.07] blur-[100px]" />

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-12 lg:py-20">
          <div>
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-9 bg-[#d9b567]" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#d9b567]">
                TEMUKAN. TAWAR. MENANG.
              </span>
            </div>

            <h1 className="max-w-2xl text-[48px] font-black leading-[0.99] tracking-[-0.07em] sm:text-6xl lg:text-[76px]">
              Bukan sekadar
              <br />
              <span className="text-[#d9b567]">membeli.</span>
              <br />
              Menangkan.
            </h1>

            <p className="mt-7 max-w-md text-sm leading-7 text-white/55 sm:text-base sm:leading-8">
              Berburu barang pilihan. Ajukan penawaran terbaik. Jadilah
              pemilik berikutnya melalui pengalaman lelang TMD-WAR.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#katalog"
                className="inline-flex min-h-12 items-center gap-5 bg-[#d9b567] px-6 text-sm font-bold text-[#171711] transition hover:bg-[#f0d28d]"
              >
                Jelajahi lelang <Arrow />
              </Link>
              <Link
                href="#panduan"
                className="inline-flex min-h-12 items-center border border-white/15 px-5 text-sm font-semibold text-white/80 transition hover:border-[#d9b567]/60 hover:text-white"
              >
                Cara mengikuti
              </Link>
            </div>

            <div className="mt-12 grid max-w-md grid-cols-3 border-t border-white/10 pt-6">
              <div className="border-r border-white/10 pr-3">
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {String(items.length).padStart(2, "0")}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/40 sm:text-xs">
                  Barang tersedia
                </p>
              </div>
              <div className="border-r border-white/10 px-3">
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {String(liveCount).padStart(2, "0")}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/40 sm:text-xs">
                  Sedang live
                </p>
              </div>
              <div className="pl-3">
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {String(scheduledCount).padStart(2, "0")}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/40 sm:text-xs">
                  Akan datang
                </p>
              </div>
            </div>
          </div>

          {/* FEATURED AUCTION */}
          <div className="relative min-w-0">
            <div className="absolute -right-3 -top-3 z-10 hidden h-20 w-20 border-r border-t border-[#d9b567]/50 sm:block" />

            {featured ? (
              <article className="group relative border border-white/10 bg-[#191a16] p-2 sm:p-3">
                <div className="relative aspect-[5/4] overflow-hidden bg-[#24241f] sm:aspect-[1.12/1]">
                  <Artwork
                    src={featured.image_url}
                    title={featured.title}
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

                  <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
                    <Status state={featured.displayState} />
                  </div>

                  <div className="absolute right-4 top-4 border border-white/20 bg-black/30 px-3 py-2 text-[9px] font-semibold tracking-[0.18em] text-white/80 backdrop-blur-sm">
                    FEATURED LOT
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <p className="text-[9px] font-bold tracking-[0.25em] text-[#d9b567]">
                      PILIHAN MINGGU INI
                    </p>
                    <h2 className="mt-3 line-clamp-2 max-w-xl text-2xl font-bold leading-tight tracking-[-0.04em] sm:text-3xl">
                      {featured.title}
                    </h2>
                    <p className="mt-3 line-clamp-2 max-w-lg text-xs leading-6 text-white/60 sm:text-sm">
                      {featured.description ||
                        "Buka detail untuk melihat informasi lengkap barang lelang."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 px-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-4">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.17em] text-white/40">
                      {featured.displayState === "scheduled"
                        ? "HARGA AWAL"
                        : "HARGA SAAT INI"}
                    </p>
                    <p className="mt-2 break-words text-xl font-bold tracking-tight text-[#e6c87f] sm:text-2xl">
                      {rupiah(
                        featured.displayState === "scheduled"
                          ? featured.starting_price
                          : featured.current_price ?? featured.starting_price
                      )}
                    </p>
                    <p className="mt-2 text-[10px] leading-5 text-white/45">
                      {featured.displayState === "scheduled"
                        ? "Mulai "
                        : "Batas waktu "}
                      {dateWIB(
                        featured.displayState === "scheduled"
                          ? featured.starts_at
                          : featured.ends_at
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/lelang/${featured.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-5 bg-[#d9b567] px-5 text-sm font-bold text-[#171711] transition hover:bg-[#f0d28d]"
                  >
                    Lihat lelang <Arrow />
                  </Link>
                </div>
              </article>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/10 bg-[#191a16] p-8 text-center sm:min-h-[480px]">
                <div className="text-5xl font-black tracking-[-0.1em] text-[#d9b567]">
                  TMD.
                </div>
                <p className="mt-4 text-[9px] font-bold tracking-[0.3em] text-white/40">
                  THE AUCTION HOUSE
                </p>
                <h2 className="mt-7 text-xl font-bold">
                  Arena lelang segera dibuka
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-white/45">
                  Belum ada barang yang tersedia. Kembali lagi untuk
                  menemukan koleksi berikutnya.
                </p>
              </div>
            )}

            <div className="absolute -bottom-3 -left-3 hidden h-16 w-16 border-b border-l border-[#d9b567]/50 sm:block" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-white/[0.08] bg-[#171813]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d9b567]/25 text-[#d9b567]">
              ◈
            </span>
            <div>
              <p className="text-xs font-bold">Harga transparan</p>
              <p className="mt-1 text-[10px] text-white/40">
                Harga ditampilkan secara jelas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-white/10 sm:border-l sm:pl-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d9b567]/25 text-[#d9b567]">
              ↗
            </span>
            <div>
              <p className="text-xs font-bold">Penawaran terverifikasi</p>
              <p className="mt-1 text-[10px] text-white/40">
                Login diperlukan untuk menawar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-white/10 sm:border-l sm:pl-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d9b567]/25 text-[#d9b567]">
              ◷
            </span>
            <div>
              <p className="text-xs font-bold">Jadwal yang jelas</p>
              <p className="mt-1 text-[10px] text-white/40">
                Pantau waktu mulai dan berakhir
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG */}
      <section id="katalog" className="scroll-mt-24">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-[#d9b567]">
                EXPLORE THE COLLECTION
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.055em] sm:text-5xl">
                Katalog <span className="text-[#d9b567]">lelang.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/45">
                Temukan barang incaranmu, cek harga terbaru, dan ikuti
                lelang sesuai jadwal.
              </p>
            </div>

            <div className="text-xs text-white/40">
              TOTAL{" "}
              <span className="ml-1 font-bold text-[#d9b567]">
                {String(items.length).padStart(2, "0")}
              </span>{" "}
              LOT
            </div>
          </div>

          {error ? (
            <div className="mt-8 border border-red-400/20 bg-red-400/5 p-6">
              <p className="font-bold text-red-300">
                Katalog belum dapat dimuat
              </p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Terjadi kendala saat mengambil data. Silakan coba kembali
                beberapa saat lagi.
              </p>
            </div>
          ) : others.length > 0 ? (
            <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((auction, index) => (
                <article
                  key={auction.id}
                  className="group min-w-0 border border-white/[0.09] bg-[#171813] transition duration-300 hover:border-[#d9b567]/40"
                >
                  <Link
                    href={`/lelang/${auction.id}`}
                    className="block"
                    aria-label={`Lihat lelang ${auction.title}`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#24241f]">
                      <Artwork
                        src={auction.image_url}
                        title={auction.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                      <div className="absolute left-3 top-3">
                        <Status state={auction.displayState} />
                      </div>

                      <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center bg-[#d9b567] text-lg font-bold text-[#171711] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <Arrow />
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9px] font-bold tracking-[0.18em] text-[#d9b567]">
                          {auction.auction_mode === "live"
                            ? "LIVE AUCTION"
                            : "TIMED AUCTION"}
                        </span>
                        <span className="text-[9px] tracking-[0.12em] text-white/30">
                          LOT {String(index + 1).padStart(3, "0")}
                        </span>
                      </div>

                      <h3 className="mt-4 line-clamp-2 min-h-[3.5rem] text-lg font-bold leading-7 tracking-[-0.025em] transition group-hover:text-[#e6c87f]">
                        {auction.title}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-white/40">
                        {auction.description ||
                          "Lihat detail barang dan ketentuan lelang."}
                      </p>

                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-[9px] font-bold tracking-[0.15em] text-white/35">
                          {auction.displayState === "scheduled"
                            ? "HARGA AWAL"
                            : "HARGA SAAT INI"}
                        </p>
                        <p className="mt-2 break-words text-xl font-bold tracking-tight text-[#e6c87f]">
                          {rupiah(
                            auction.displayState === "scheduled"
                              ? auction.starting_price
                              : auction.current_price ?? auction.starting_price
                          )}
                        </p>

                        <div className="mt-4 flex items-start gap-2 text-[10px] leading-5 text-white/40">
                          <span className="text-[#d9b567]">◷</span>
                          <span>
                            {auction.displayState === "scheduled"
                              ? "Mulai: "
                              : "Batas: "}
                            {dateWIB(
                              auction.displayState === "scheduled"
                                ? auction.starts_at
                                : auction.ends_at
                            )}
                          </span>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs font-bold">
                          <span className="text-white/65">
                            Lihat detail
                          </span>
                          <span className="text-[#d9b567] transition group-hover:translate-x-1">
                            →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-8 border border-dashed border-white/15 bg-[#171813] px-6 py-16 text-center">
              <div className="text-5xl font-black tracking-[-0.1em] text-[#d9b567]">
                TMD.
              </div>
              <h3 className="mt-6 text-xl font-bold">
                Koleksi sedang dipersiapkan
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/45">
                Barang lelang akan ditampilkan di sini setelah admin
                menerbitkan lelang.
              </p>
              <Link
                href="/akun"
                className="mt-6 inline-flex min-h-11 items-center gap-3 bg-[#d9b567] px-5 text-sm font-bold text-[#171711] transition hover:bg-[#f0d28d]"
              >
                Buka akun <Arrow />
              </Link>
            </div>
          ) : (
            <div className="mt-8 border border-white/10 p-6 text-sm text-white/45">
              Barang lainnya akan ditampilkan di sini.
            </div>
          )}
        </div>
      </section>

      {/* GUIDE */}
      <section
        id="panduan"
        className="scroll-mt-24 border-t border-white/10 bg-[#171813]"
      >
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12 lg:py-24">
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-[#d9b567]">
              HOW IT WORKS
            </p>
            <h2 className="mt-5 max-w-md text-3xl font-black leading-tight tracking-[-0.055em] sm:text-5xl">
              Satu barang.
              <br />
              <span className="text-[#d9b567]">Satu kesempatan.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/45">
              Mulai dari menemukan barang hingga mengajukan penawaran.
              Semua dimulai dari katalog TMD-WAR.
            </p>
            <Link
              href="#katalog"
              className="mt-7 inline-flex min-h-12 items-center gap-5 bg-[#d9b567] px-6 text-sm font-bold text-[#171711] transition hover:bg-[#f0d28d]"
            >
              Mulai jelajahi <Arrow />
            </Link>
          </div>

          <div className="divide-y divide-white/10 border-y border-white/10">
            {[
              {
                number: "01",
                title: "Pilih barang incaran",
                description:
                  "Buka katalog, pelajari deskripsi, harga, dan jadwal lelang.",
              },
              {
                number: "02",
                title: "Login dan ajukan penawaran",
                description:
                  "Masuk menggunakan Facebook dan ajukan bid sesuai ketentuan lelang.",
              },
              {
                number: "03",
                title: "Pantau sampai selesai",
                description:
                  "Periksa harga terbaru dan waktu berakhir melalui halaman detail lelang.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="grid grid-cols-[52px_1fr] gap-4 py-6 sm:grid-cols-[68px_1fr] sm:gap-6 sm:py-8"
              >
                <span className="text-2xl font-black tracking-[-0.06em] text-[#d9b567] sm:text-3xl">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/45 sm:text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#0b0c0a]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#d9b567] font-black text-[#171711]">
              T
            </div>
            <div>
              <div className="text-base font-black tracking-[-0.06em]">
                TMD<span className="text-[#d9b567]">•</span>WAR
              </div>
              <div className="mt-0.5 text-[8px] tracking-[0.25em] text-white/35">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <p className="text-[10px] leading-6 text-white/35">
            © {new Date().getFullYear()} TMD-WAR. Hak cipta dilindungi.
          </p>

          <div className="flex gap-5 text-xs text-white/50">
            <Link href="#katalog" className="transition hover:text-[#d9b567]">
              Katalog
            </Link>
            <Link href="/akun" className="transition hover:text-[#d9b567]">
              Akun
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
