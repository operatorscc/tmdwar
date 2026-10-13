-- =============================================================================
-- Seed Data: supabase/seed.sql
-- Description: Realistic development sample lots and non-sensitive demo data
-- Note: Contains NO production secrets, personal data, or credentials
-- =============================================================================

-- Ensure seed profiles exist (using mock UUIDs for local testing)
insert into public.profiles (id, display_name, avatar_url, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Admin Kurator TMD', null, 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Budi Santoso', null, 'bidder'),
  ('00000000-0000-0000-0000-000000000003', 'Citra Lestari', null, 'bidder')
on conflict (id) do nothing;

-- Sample Auctions
insert into public.auctions (
  id,
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
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'Kamera Analog Leica M6 Classic Edition',
    'Koleksi pribadi kurator dalam kondisi mulus 98%. Dilengkapi lensa Summicron 50mm f/2 dan sertifikat orisinalitas.',
    null,
    'timed',
    'live',
    15000000,
    16500000,
    250000,
    now() - interval '2 hours',
    now() + interval '3 days',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Chronograph Mekanik Vintage 1974 Swiss Made',
    'Jam tangan mekanik manual-wind legendaris dengan dial panda original, case stainless steel 38mm, dan power reserve 42 jam.',
    null,
    'live',
    'live',
    25000000,
    27000000,
    500000,
    now() - interval '30 minutes',
    now() + interval '1 day',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Lukisan Kanvas Lanskap Borobudur Era Kolonial',
    'Karya seni cat minyak berukuran 90x60 cm dengan pigmen alami dan bingkai kayu jati ukir Jawa asli abad ke-20.',
    null,
    'timed',
    'scheduled',
    40000000,
    40000000,
    1000000,
    now() + interval '2 days',
    now() + interval '5 days',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Piringan Hitam Vinyl First Pressing The Beatles',
    'Vinyl langka edisi UK Mono original 1967. Sleeve dan piringan dalam kondisi Very Good Plus (VG+).',
    null,
    'timed',
    'ended',
    3500000,
    5250000,
    100000,
    now() - interval '5 days',
    now() - interval '1 hour',
    '00000000-0000-0000-0000-000000000001'
  )
on conflict (id) do nothing;

-- Sample Bids on Active Auctions
insert into public.bids (auction_id, bidder_id, amount, created_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 15500000, now() - interval '90 minutes'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 16000000, now() - interval '45 minutes'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 16500000, now() - interval '15 minutes'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 26000000, now() - interval '20 minutes'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 27000000, now() - interval '5 minutes'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 4500000, now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 5250000, now() - interval '2 hours')
on conflict do nothing;
