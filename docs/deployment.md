# TMD-WAR — Deployment Guide ke Vercel

**Platform:** Next.js 15 (App Router, React 19, TypeScript) + Supabase
**Target:** Vercel Production Deployment
**Repo:** https://github.com/operatorscc/tmdwar.git

---

## Prasyarat

1. **Akun Vercel** — Daftar di [vercel.com](https://vercel.com) (gratis untuk hobby)
2. **Akun GitHub** — Repo `operatorscc/tmdwar` sudah ada
3. **Proyek Supabase** — Dengan schema `supabase/schema.sql` sudah dijalankan
4. **Facebook Developer App** — Untuk OAuth login (opsional untuk MVP)

---

## Metode 1: Deploy via GitHub Integration (Recommended)

### Langkah 1: Import Repo ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new)
2. Pilih **Import Git Repository**
3. Cari dan pilih `operatorscc/tmdwar`
4. Jika repo tidak muncul, klik **Adjust GitHub App Permissions** dan tambahkan akses ke repo

### Langkah 2: Konfigurasi Project

| Setting | Value |
|---|---|
| Framework Preset | Next.js (auto-detected) |
| Root Directory | `./` (default) |
| Build Command | `next build` (auto-detected dari `package.json`) |
| Output Directory | `.next` (auto-detected) |
| Install Command | `npm install` (auto-detected) |
| Node.js Version | 20.x atau 22.x (Settings > Functions) |

### Langkah 3: Set Environment Variables

Tambahkan di **Vercel Project Settings → Environment Variables** sebelum deploy:

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gttrrgwbxuijcenagaha.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your Supabase anon/publishable key)* | Production + Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Production |

> ⚠️ **Penting:** Ganti `NEXT_PUBLIC_SITE_URL` dengan domain Vercel Anda setelah deploy pertama selesai (lihat Langkah 5).

### Langkah 4: Deploy

1. Klik **Deploy**
2. Tunggu build selesai (~1-2 menit)
3. Vercel akan memberikan URL sementara: `https://tmd-war-xxx.vercel.app`

### Langkah 5: Update Site URL

Setelah deploy pertama:

1. Catat domain Vercel Anda (mis. `https://tmd-war-operatorscc.vercel.app`)
2. Update **Vercel Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SITE_URL` = `https://tmd-war-operatorscc.vercel.app`
3. **Redeploy** (Deployments → Redeploy)

---

## Metode 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy dari direktori proyek
vercel

# Deploy ke production
vercel --prod
```

CLI akan menanyakan konfigurasi project. Set environment variables via:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_SITE_URL
```

---

## Konfigurasi Supabase untuk Production

### 1. Update Redirect URLs di Supabase

**Supabase Dashboard → Authentication → URL Configuration:**

- **Site URL:** `https://your-domain.vercel.app`
- **Redirect URLs:** Tambahkan:
  - `http://localhost:3000/auth/callback` (development)
  - `https://your-domain.vercel.app/auth/callback` (production)
  - `https://*-tmd-war.vercel.app/auth/callback` (preview deployments)

### 2. Facebook OAuth Configuration

**Supabase Dashboard → Authentication → Providers → Facebook:**

- Pastikan **Facebook provider** aktif
- App ID & App Secret sudah diisi

**Meta for Developers → Facebook Login Settings:**

- Tambahkan redirect URI Supabase:
  `https://gttrrgwbxuijcenagaha.supabase.co/auth/v1/callback`

### 3. Database Schema

Pastikan `supabase/schema.sql` sudah dijalankan di SQL Editor Supabase.

### 4. Grant Admin Role

Setelah login pertama dengan Facebook:
```sql
-- Ganti UUID dengan ID user Anda dari auth.users
update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
```

---

## Post-Deployment Checklist

- [ ] Homepage (`/`) terbuka tanpa error
- [ ] Navigasi header berfungsi (Beranda, Katalog, Cara Kerja)
- [ ] Login Facebook redirect berfungsi (`/login` → Facebook → `/auth/callback` → kembali)
- [ ] Halaman akun (`/akun`) redirect ke `/login` jika belum login
- [ ] Admin dashboard (`/admin/dashboard`) redirect non-admin ke `/`
- [ ] Admin bisa membuat auction baru (`/admin/auction`)
- [ ] Detail lelang (`/lelang/[id]`) menampilkan data dengan benar
- [ ] Realtime update berfungsi (buka 2 tab, bid di satu, lihat update di lain)
- [ ] Mobile responsive (test di viewport < 640px)
- [ ] Tidak ada console errors di browser

---

## Custom Domain (Opsional)

1. **Vercel Project Settings → Domains**
2. Tambahkan custom domain (mis. `lelang.tmdwar.com`)
3. Setup DNS records sesuai instruksi Vercel
4. Update `NEXT_PUBLIC_SITE_URL` ke custom domain
5. Update Supabase redirect URLs dengan custom domain
6. Redeploy

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Build gagal di Vercel | Cek Node.js version (20+), jalankan `npm run build` lokal |
| Supabase connection error | Verifikasi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| OAuth redirect gagal | Pastikan redirect URL di Supabase cocok dengan domain Vercel |
| Katalog kosong | Jalankan `supabase/schema.sql` lalu buat auction via admin panel |
| Realtime tidak update | Cek publication `supabase_realtime` di Supabase |
| Image tidak muncul | Pastikan `next.config.ts` remotePatterns mencakup hostname gambar |
