<<<<<<< HEAD
# TMD-WAR — Starter aplikasi lelang online

Starter MVP Next.js App Router + Supabase + Facebook OAuth. Publik dapat melihat lelang, login diperlukan untuk menawar, dan hanya admin dapat mengelola barang melalui SQL/RLS.

## Yang sudah ada
- Responsive landing/catalog/detail/account/login UI
- Supabase SSR client (cookie-based) + middleware token refresh
- Facebook OAuth start + callback + sign out
- PostgreSQL schema untuk profiles, auctions, bids
- RLS, role admin/bidder, fungsi RPC `place_bid` yang mengunci baris lelang untuk mencegah dua bid bersamaan lolos pada harga yang sama
- Mode `timed` dan `live` sebagai jenis lelang; keduanya memakai `starts_at` dan `ends_at`
- Riwayat bid pada halaman detail

## Prasyarat
- Node.js 20+
- Project Supabase
- Facebook Developer app
- Akun GitHub (untuk deployment Vercel)

## 1. Jalankan lokal
```bash
npm install
cp .env.example .env.local
npm run dev
```
Windows PowerShell:
```powershell
Copy-Item .env.example .env.local
```
Isi `.env.local` dengan URL dan publishable key Supabase. Jangan pernah memakai service-role key di browser atau commit secret ke Git.

## 2. Database
1. Buka Supabase Dashboard → SQL Editor.
2. Jalankan seluruh `supabase/schema.sql`.
3. Login pertama kali dengan Facebook.
4. Di Authentication → Users, salin UUID akun sendiri.
5. SQL Editor: `update public.profiles set role='admin' where id='UUID-AKUN-ANDA';`
6. Pembuatan dan pengelolaan barang untuk MVP awal dilakukan melalui SQL Editor sebagai admin database. Dashboard CRUD admin belum termasuk starter ini.

Contoh membuat lelang:
```sql
insert into public.auctions
(title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_by)
values
('Kamera Mirrorless', 'Kondisi baik, cek detail sebelum menawar.', null, 'timed', 'live', 1500000, 1500000, 50000,
 now() - interval '5 minutes', now() + interval '2 days',
 'UUID-ADMIN-DARI-PROFILES');
```
Ganti UUID admin. Untuk live event, gunakan `auction_mode='live'`. `status='live'` dan waktu `starts_at`/`ends_at` tetap wajib valid.

## 3. Facebook OAuth
1. Buka https://developers.facebook.com/ → My Apps → Create App.
2. Tambahkan produk Facebook Login (Web).
3. Di Supabase Dashboard → Authentication → Providers → Facebook, aktifkan provider dan salin App ID + App Secret dari Meta.
4. Supabase Dashboard → Authentication → URL Configuration:
   - Site URL lokal: `http://localhost:3000`
   - Redirect URL callback OAuth yang disediakan oleh Supabase (lihat provider setup, umumnya `https://<PROJECT-REF>.supabase.co/auth/v1/callback`)
   - Tambahkan `http://localhost:3000/auth/callback` ke allowed redirect URLs untuk aplikasi.
5. Di Meta Facebook Login settings, masukkan URL callback Supabase sebagai Valid OAuth Redirect URI.
6. Minta izin email yang diperlukan. Facebook dapat tidak mengembalikan email untuk sebagian akun.
7. Saat siap publik, isi App Domains, Privacy Policy URL, Terms URL, dan lakukan App Review sesuai kebutuhan Meta. Development mode hanya mengizinkan role/tester/developer yang diizinkan Meta.
8. Tambahkan production URL Vercel ke Supabase redirect allow-list setelah deploy.

## 4. Deploy ke Vercel
1. Push folder ini ke repository GitHub.
2. Vercel → Add New → Project → import repo.
3. Tambahkan environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (URL production)
4. Deploy.
5. Tambahkan `https://DOMAIN-ANDA/auth/callback` ke Supabase Authentication → URL Configuration → Redirect URLs. Site URL production juga harus disetel.
6. Tambahkan domain Vercel ke Facebook Login settings / App Domains jika diperlukan.
7. Redeploy setelah perubahan env.

## Keamanan dan batas MVP
- `place_bid` adalah satu-satunya jalur penawaran; RLS menolak direct bid insert.
- RPC menggunakan `SELECT ... FOR UPDATE` agar bid yang bersamaan diserialisasi.
- `current_price` adalah harga bid tertinggi yang diterima; jika harga yang sama dengan bid tertinggi sebelumnya diajukan, RPC menolaknya karena harus naik minimum.
- Admin harus ditetapkan lewat SQL tepercaya. Jangan membuat endpoint publik untuk mengubah `profiles.role`.
- Starter ini belum mencakup dashboard admin CRUD, upload Storage UI, countdown/realtime subscription di browser, penutupan otomatis/penetapan pemenang, anti-bot/rate-limit, notifikasi, escrow, pembayaran, refund, atau audit/dispute workflow.
- Untuk produksi: implementasikan scheduler/cron untuk menutup lelang tepat waktu dan menetapkan pemenang dengan transaksi database; tambahkan rate limiting, CAPTCHA/risk controls, monitoring, ketentuan hukum dan privasi, serta pengujian keamanan.
- `current_price` hanya harga terakhir/tertinggi. Tentukan aturan tie-break, perpanjangan waktu anti-sniping, pembatalan, dan sengketa secara eksplisit sebelum peluncuran.
=======
# tmdwar
war bid and happy
>>>>>>> cd1a1e95f98a535c56aa9205ac25ba227a271ce8
