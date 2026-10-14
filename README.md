# TMD-WAR — Platform Lelang Online & House of Curated Auctions

Platform lelang daring modern berbasis **Next.js 15 (App Router, React 19, TypeScript)** dan **Supabase (PostgreSQL, Supabase Auth, RLS, Realtime)** dengan sistem desain premium terinspirasi **Framer Websites**.

---

## Fitur Utama

- **Desain Modern Terinspirasi Framer:** Palet obsidian gelap (`#0A0B0D`), aksen emas sampanye (`#D4AF37`), tipografi presisi dengan angka tabular (`tabular-nums`), mikro-interaksi responsif, dan dukungan `prefers-reduced-motion`.
- **Katalog Interaktif Real-time:** Filter tab dinamis (*Semua*, *Sedang Live*, *Segera Dimulai*, *Selesai*), pencarian lot instan, dan kartu lot dengan preview detail.
- **Hitung Mundur Presisi (Countdown):** Komponen hitung mundur detil per detik untuk waktu penutupan lot live dan waktu pembukaan lelang terjadwal.
- **Penawaran Terkunci Tingkat Baris (Row-Level Locking):** Prosedur tersimpan PostgreSQL `place_bid` dengan `SELECT ... FOR UPDATE` untuk mencegah race condition atau double-bid pada harga yang sama.
- **Langganan Real-time Supabase:** Halaman detail lelang mendengarkan perubahan harga dan bid baru secara langsung melalui WebSockets tanpa perlu reload browser.
- **Formulir Penawaran Cepat (Quick-Bid Pills):** Tombol kelipatan cepat (`+1x`, `+2x`, `+5x`, `+10x` kenaikan minimum) dan validasi instan di sisi klien.
- **Navigasi Responsif Penuh:** Header sticky terpadu dengan laci navigasi mobile (hamburger drawer) yang mulus di breakpoint ponsel, tablet, dan desktop.
- **Proteksi Open Redirect:** Sanitasi URL pengalihan aman pada alur otentikasi OAuth.

---

## Dokumentasi Lengkap

Dokumentasi arsitektur, audit, dan perbaikan tersedia di direktori `docs/`:
- [Audit Report & Modernization Roadmap](docs/audit-report.md)
- [End-to-End System Architecture](docs/architecture.md)
- [Defect Log & Remediation Report](docs/bug-fixes.md)
- [Deployment Guide ke Vercel](docs/deployment.md)
- [UI/UX Design System Specification](docs/ui-ux.md)

---

## Prasyarat Lingkungan

- **Node.js:** Versi 20+ (direkomendasikan Node.js 22 atau 24)
- **Supabase:** Proyek PostgreSQL dengan pgcrypto dan Supabase Auth aktif
- **Facebook Developer App:** Untuk otentikasi peserta lelang melalui Facebook OAuth

---

## Perintah Kerja (Scripts)

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan server pengembangan lokal di `http://localhost:3000` |
| `npm run build` | Menjalankan build produksi Next.js yang dioptimalkan |
| `npm run start` | Menjalankan server produksi hasil build lokal |
| `npm run lint` | Menjalankan ESLint 9 flat-config di seluruh basis kode |
| `npm test` | Menjalankan suite pengujian unit otomatis menggunakan runner bawaan Node.js |

---

## 1. Setup dan Menjalankan Lokal

Salin konfigurasi environment:
```bash
# Linux / macOS
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Isi `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Instal dependensi dan jalankan pengujian:
```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

---

## 2. Setup Database Supabase

1. Buka **Supabase Dashboard → SQL Editor**.
2. Jalankan seluruh skrip SQL dari `supabase/schema.sql`.
3. Skrip akan membuat:
   - Tipe data enum: `user_role`, `auction_mode`, `auction_status`.
   - Tabel: `profiles`, `auctions`, `bids`.
   - Trigger `on_auth_user_created` untuk sinkronisasi akun OAuth.
   - Kebijakan RLS (Row Level Security) yang aman untuk publik dan admin.
   - Prosedur tersimpan `place_bid(uuid, bigint)` dengan row lock serializable.
   - Menambahkan tabel `bids` dan `auctions` ke publikasi `supabase_realtime`.

### Memberikan Role Admin:
Setelah login pertama kali dengan Facebook:
```sql
update public.profiles set role = 'admin' where id = 'UUID-AUTH-USER-ANDA';
```

### Contoh Membuat Lot Lelang Baru:
```sql
insert into public.auctions (
  title,
  description,
  image_url,
  auction_mode,
  status,
  starting_price,
  current_price,
  min_increment,
  starts_at,
  ends_at,
  created_by
) values (
  'Kamera Leica M6 Classic Edition',
  'Kondisi mulus koleksi pribadi. Lensa Summicron 50mm f/2 included.',
  null,
  'timed',
  'live',
  15000000,
  15000000,
  250000,
  now() - interval '5 minutes',
  now() + interval '2 days',
  'UUID-ADMIN-DARI-PROFILES'
);
```

---

## 3. Konfigurasi Facebook OAuth

1. Kunjungi [Meta for Developers](https://developers.facebook.com/) dan buat aplikasi baru.
2. Tambahkan produk **Facebook Login (Web)**.
3. Di **Supabase Dashboard → Authentication → Providers → Facebook**, aktifkan provider dan masukkan App ID serta App Secret.
4. Di **Supabase Dashboard → Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (atau domain produksi).
   - Redirect URLs: Tambahkan `http://localhost:3000/auth/callback` dan URL domain Vercel Anda.
5. Di Pengaturan Facebook Login, tambahkan URI redirect Supabase (biasanya `https://<PROJECT-REF>.supabase.co/auth/v1/callback`).

---

## 4. Deployment ke Vercel

1. Push cabang ke repositori GitHub.
2. Di Vercel Dashboard, buat proyek baru dan impor repositori ini.
3. Atur variabel lingkungan di Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (Domain resmi Vercel Anda)
4. Deploy. Tambahkan `https://domain-anda.vercel.app/auth/callback` ke URL configuration di Supabase.

---

## Keamanan & Integritas Data

- Penawaran hanya dapat dilakukan melalui fungsi RPC `place_bid`. Penambahan langsung ke tabel `bids` ditolak oleh RLS.
- Kunci `SELECT ... FOR UPDATE` memastikan transaksi dieksekusi secara serial, menghilangkan kemungkinan dua penawar diterima pada harga yang sama.
- Validasi input memeriksa integritas integer, batas nominal minimum, dan jendela waktu lelang aktif.
