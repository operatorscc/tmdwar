
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

  if (Number.isNaN(date.getTime())) {
    return "Jadwal belum ditentukan";
  }

  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
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

  if (start !== null && Number.isFinite(start) && now < start) {
    return "scheduled";
  }

  return "live";
}

function Status({ state }: { state: AuctionState }) {
  const styles = {
    live: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
    scheduled: "bg-amber-50 text-amber-800 ring-amber-700/15",
    ended: "bg-stone-100 text-stone-600 ring-stone-500/15",
  };

  const labels = {
    live: "● LIVE AUCTION",
    scheduled: "SEGERA DIMULAI",
    ended: "LELANG BERAKHIR",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] ring-1 ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function AuctionArtwork({
  src,
  title,
  featured = false,
}: {
  src: string | null;
  title: string;
  featured?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading={featured ? "eager" : "lazy"}
        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
    );
  }

  return (
    <div className="flex h-full min-h-48 items-center justify-center bg-[#eae5d9]">
      <div className="text-center">
        <div className="text-4xl font-black tracking-[-0.08em] text-[#aa8744]">
          TMD
        </div>
        <div className="mt-2 text-[9px] tracking-[0.35em] text-stone-500">
          WAR AUCTION HOUSE
        </div>
      </div>
    </div>
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

  const others = items
    .filter((item) => item.id !== featured?.id)
    .slice(0, 6);

  const liveCount = items.filter(
    (item) => item.displayState === "live"
  ).length;

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#201f1b]">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#e8e4da] bg-[#f8f7f3]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1380px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center bg-[#25251f] text-lg font-black text-[#d7b66c]">
              T
            </div>
            <div>
              <div className="text-[18px] font-black tracking-[-0.06em] sm:text-xl">
                TMD<span className="text-[#ae8740]">•</span>WAR
              </div>
              <div className="mt-0.5 text-[9px] font-medium tracking-[0.25em] text-stone-500">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
            <Link href="#lelang" className="transition hover:text-[#a47c31]">
              Katalog
            </Link>
            <Link
              href="#cara-kerja"
              className="transition hover:text-[#a47c31]"
            >
              Cara kerja
            </Link>
          </nav>

          <Link
            href="/akun"
            className="inline-flex items-center justify-center gap-2 bg-[#292920] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#a47c31] sm:px-5 sm:text-sm"
          >
            Masuk / Akun <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1380px] px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="max-w-2xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-10 bg-[#ae8740]" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#94712f]">
                THE ART OF WINNING
              </span>
            </div>

            <h1 className="text-[46px] font-semibold leading-[1.02] tracking-[-0.065em] sm:text-6xl lg:text-[76px]">
              Barang istimewa.
              <br />
              <span className="font-serif italic font-normal text-[#a6813d]">
                Kesempatanmu.
              </span>
            </h1>

            <p className="mt-7 max-w-lg text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
              Temukan barang pilihan, ikuti persaingan penawaran, dan
              menangkan barang incaranmu melalui pengalaman lelang yang
              lebih transparan bersama TMD-WAR.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#lelang"
                className="inline-flex min-h-12 items-center justify-center gap-5 bg-[#292920] px-6 text-sm font-bold text-white transition hover:bg-[#a6813d]"
              >
                Jelajahi katalog <span>↗</span>
              </Link>
              <Link
                href="#cara-kerja"
                className="inline-flex min-h-12 items-center justify-center border border-[#d9d4c9] px-6 text-sm font-semibold transition hover:border-[#a6813d]"
              >
                Cara mengikuti lelang
              </Link>
            </div>

            <div className="mt-12 grid max-w-md grid-cols-2 border-t border-[#ded9ce] pt-6">
              <div className="border-r border-[#ded9ce] pr-6">
                <div className="text-3xl font-semibold tracking-tight">
                  {items.length.toString().padStart(2, "0")}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Barang dalam katalog
                </p>
              </div>
              <div className="pl-6">
                <div className="text-3xl font-semibold tracking-tight">
                  {liveCount.toString().padStart(2, "0")}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Lelang berlangsung
                </p>
              </div>
            </div>
          </div>

          {/* Featured item */}
          <div className="relative">
            <div className="absolute -right-5 -top-5 hidden h-32 w-32 border-r border-t border-[#d4bd88] sm:block" />

            {featured ? (
              <article className="group relative bg-white p-2 shadow-[0_24px_80px_rgba(42,36,23,0.09)] sm:p-3">
                <div className="relative aspect-[5/4] overflow-hidden bg-[#eae5d9]">
                  <AuctionArtwork
                    src={featured.image_url}
                    title={featured.title}
                    featured
                  />
                  <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
                    <Status state={featured.displayState} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-5 pt-20 text-white sm:p-8 sm:pt-24">
                    <p className="text-[9px] font-bold tracking-[0.25em] text-[#e6c982]">
                      PILIHAN TMD-WAR
                    </p>
                    <h2 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {featured.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 max-w-lg text-xs leading-6 text-white/75 sm:text-sm">
                      {featured.description ||
                        "Lihat informasi barang, harga, dan jadwal lelang."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 px-3 py-5 sm:grid-cols-[1fr_auto] sm:items-end sm:px-5 sm:py-6">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-stone-500">
                      HARGA SAAT INI
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                      {rupiah(
                        featured.current_price ?? featured.starting_price
                      )}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      {featured.displayState === "scheduled"
                        ? "Dimulai "
                        : "Berakhir "}
                      {dateWIB(
                        featured.displayState === "scheduled"
                          ? featured.starts_at
                          : featured.ends_at
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/lelang/${featured.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-5 bg-[#b08b46] px-5 text-sm font-bold text-white transition hover:bg-[#292920]"
                  >
                    Lihat barang <span>↗</span>
                  </Link>
                </div>
              </article>
            ) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center border border-[#e5dfd3] bg-white p-8 text-center sm:min-h-[440px]">
                <div className="font-serif text-5xl italic text-[#b08b46]">
                  TMD
                </div>
                <h2 className="mt-5 text-xl font-semibold">
                  Koleksi berikutnya segera hadir
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-stone-500">
                  Belum ada lelang yang tersedia saat ini. Silakan kembali
                  untuk melihat barang pilihan terbaru.
                </p>
              </div>
            )}

            <div className="absolute -bottom-5 -left-5 hidden h-24 w-24 border-b border-l border-[#d4bd88] sm:block" />
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section
        id="lelang"
        className="scroll-mt-24 border-y border-[#e8e3d8] bg-white"
      >
        <div className="mx-auto max-w-[1380px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-[#ae8740]" />
                <span className="text-[10px] font-bold tracking-[0.25em] text-[#94712f]">
                  THE COLLECTION
                </span>
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Jelajahi katalog
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-500">
                Setiap barang memiliki cerita. Temukan yang sesuai dengan
                minatmu dan ikuti jadwal lelangnya.
              </p>
            </div>

            <p className="text-xs text-stone-500">
              Menampilkan{" "}
              <span className="font-bold text-[#292920]">
                {items.length}
              </span>{" "}
              barang
            </p>
          </div>

          {error ? (
            <div className="mt-10 border border-red-200 bg-red-50 p-6">
              <h3 className="font-semibold text-red-800">
                Katalog belum dapat dimuat
              </h3>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Terjadi kendala saat mengambil data lelang. Silakan coba
                kembali beberapa saat lagi.
              </p>
            </div>
          ) : others.length > 0 ? (
            <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((auction, index) => (
                <article key={auction.id} className="group min-w-0">
                  <Link
                    href={`/lelang/${auction.id}`}
                    className="block"
                    aria-label={`Lihat lelang ${auction.title}`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#ece8df]">
                      <AuctionArtwork
                        src={auction.image_url}
                        title={auction.title}
                      />
                      <div className="absolute left-3 top-3">
                        <Status state={auction.displayState} />
                      </div>
                      <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-[#292920] opacity-0 shadow-lg transition group-hover:opacity-100">
                        ↗
                      </div>
                    </div>

                    <div className="pb-1 pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9px] font-bold tracking-[0.2em] text-[#9b783a]">
                          {auction.auction_mode === "live"
                            ? "LIVE AUCTION"
                            : "TIMED AUCTION"}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          LOT {String(index + 1).padStart(3, "0")}
                        </span>
                      </div>

                      <h3 className="mt-3 line-clamp-2 min-h-[3.5rem] text-xl font-semibold leading-7 tracking-tight transition group-hover:text-[#9b783a]">
                        {auction.title}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-stone-500">
                        {auction.description ||
                          "Buka detail untuk melihat informasi lengkap barang."}
                      </p>

                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#e8e3d8] pt-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold tracking-[0.15em] text-stone-500">
                            HARGA SAAT INI
                          </p>
                          <p className="mt-1 break-words text-lg font-semibold tracking-tight">
                            {rupiah(
                              auction.current_price ?? auction.starting_price
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 pb-1 text-xs font-semibold text-[#9b783a]">
                          Lihat detail ↗
                        </span>
                      </div>

                      <p className="mt-3 text-[11px] leading-5 text-stone-500">
                        {auction.displayState === "scheduled"
                          ? "Mulai: "
                          : "Batas: "}
                        {dateWIB(
                          auction.displayState === "scheduled"
                            ? auction.starts_at
                            : auction.ends_at
                        )}
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-10 border border-dashed border-[#dcd5c8] px-6 py-16 text-center">
              <div className="font-serif text-5xl italic text-[#b08b46]">
                TMD
              </div>
              <h3 className="mt-5 text-xl font-semibold">
                Katalog sedang dipersiapkan
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-500">
                Barang lelang akan muncul di halaman ini setelah admin
                menerbitkan lelang.
              </p>
              <Link
                href="/akun"
                className="mt-6 inline-flex min-h-11 items-center justify-center bg-[#292920] px-5 text-sm font-semibold text-white transition hover:bg-[#a6813d]"
              >
                Buka akun <span className="ml-3">↗</span>
              </Link>
            </div>
          ) : (
            <p className="mt-10 border-t border-[#e8e3d8] py-8 text-sm text-stone-500">
              Semua barang yang tersedia sudah ditampilkan di bagian
              unggulan.
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section
        id="cara-kerja"
        className="scroll-mt-24 bg-[#eeece5] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-[#ae8740]" />
                <span className="text-[10px] font-bold tracking-[0.25em] text-[#94712f]">
                  HOW IT WORKS
                </span>
              </div>
              <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">
                Cara mengikuti lelang.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-stone-600">
                Proses sederhana untuk menemukan barang, mengajukan
                penawaran, dan mengikuti perkembangan lelang.
              </p>
              <Link
                href="#lelang"
                className="mt-7 inline-flex min-h-12 items-center gap-5 bg-[#292920] px-6 text-sm font-bold text-white transition hover:bg-[#a6813d]"
              >
                Lihat katalog <span>↗</span>
              </Link>
            </div>

            <div className="divide-y divide-[#d9d4c8] border-y border-[#d9d4c8]">
              <div className="grid grid-cols-[54px_1fr] gap-4 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="font-serif text-3xl italic text-[#ae8740] sm:text-4xl">
                  01
                </span>
                <div>
                  <h3 className="text-lg font-semibold">Temukan barang</h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    Jelajahi katalog, pelajari deskripsi barang, dan
                    periksa harga serta jadwal lelang.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[54px_1fr] gap-4 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="font-serif text-3xl italic text-[#ae8740] sm:text-4xl">
                  02
                </span>
                <div>
                  <h3 className="text-lg font-semibold">
                    Login dan menawar
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    Masuk menggunakan Facebook dan ajukan penawaran sesuai
                    dengan ketentuan serta kenaikan minimum.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[54px_1fr] gap-4 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="font-serif text-3xl italic text-[#ae8740] sm:text-4xl">
                  03
                </span>
                <div>
                  <h3 className="text-lg font-semibold">
                    Pantau perkembangan
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    Periksa harga terbaru dan status lelang melalui halaman
                    detail barang.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#292920] text-white">
        <div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#b08b46] font-black text-white">
              T
            </div>
            <div>
              <div className="text-lg font-black tracking-[-0.05em]">
                TMD<span className="text-[#d7b66c]">•</span>WAR
              </div>
              <div className="mt-0.5 text-[9px] tracking-[0.25em] text-white/50">
                AUCTION HOUSE
              </div>
            </div>
          </Link>

          <p className="text-xs leading-6 text-white/50">
            © {new Date().getFullYear()} TMD-WAR Auction House.
            <br className="sm:hidden" /> Semua hak dilindungi.
          </p>

          <div className="flex gap-6 text-xs text-white/70">
            <Link href="#lelang" className="transition hover:text-[#d7b66c]">
              Katalog
            </Link>
            <Link href="/akun" className="transition hover:text-[#d7b66c]">
              Akun pengguna
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
