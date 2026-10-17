import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAuctionInput, validateImage, generateStoragePath, requireAdmin } from '@/lib/validation';

// GET: Admin-only list with explicit archive scope. Operational lists exclude archived lots by default.
export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageValue = Number(searchParams.get('page') || '1');
  const limitValue = Number(searchParams.get('limit') || '20');
  if (!Number.isSafeInteger(pageValue) || pageValue < 1) {
    return NextResponse.json({ error: 'Parameter page harus bilangan bulat positif.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: 'Parameter limit harus bilangan bulat positif.' }, { status: 400 });
  }

  const page = pageValue;
  const limit = Math.min(100, limitValue);
  const offset = (page - 1) * limit;
  const statusFilter = searchParams.get('status');
  const archiveMode = searchParams.get('archive') || 'active';
  if (!['active', 'archived', 'all'].includes(archiveMode)) {
    return NextResponse.json({ error: 'Parameter archive harus active, archived, atau all.' }, { status: 400 });
  }

  const allowedStatuses = new Set(['draft', 'scheduled', 'live', 'ended', 'cancelled']);
  if (statusFilter && !allowedStatuses.has(statusFilter)) {
    return NextResponse.json({ error: 'Filter status lelang tidak valid.' }, { status: 400 });
  }
  if (statusFilter && archiveMode === 'archived') {
    return NextResponse.json({ error: 'Filter status tidak dapat digabungkan dengan archive=archived.' }, { status: 400 });
  }

  const allowedSortColumns = new Set([
    'created_at', 'updated_at', 'title', 'status',
    'starts_at', 'ends_at', 'starting_price', 'current_price',
  ]);
  const requestedSort = searchParams.get('sortBy') || 'created_at';
  const sortBy = allowedSortColumns.has(requestedSort) ? requestedSort : 'created_at';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('auctions')
    .select('id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_at, updated_at, archived_at, archive_reason', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  if (archiveMode === 'active') {
    query = query.is('archived_at', null);
  } else if (archiveMode === 'archived') {
    query = query.not('archived_at', 'is', null);
  }
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    // Do not silently return an incomplete list when archive columns are missing.
    return NextResponse.json({ error: 'Gagal memuat lelang. Pastikan migration arsip sudah diterapkan.' }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
    archive: archiveMode,
  });
}

// POST: Create auction (admin only)
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Formulir lelang tidak valid.' }, { status: 400 });
  }

  const formText = (name: string, fallback = '') => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : fallback;
  };

  const input = {
    title: formText('title').trim(),
    description: formText('description').trim(),
    auctionMode: formText('auctionMode', 'timed'),
    status: formText('status', 'draft'),
    startingPrice: formText('startingPrice', '0'),
    minIncrement: formText('minIncrement', '0'),
    startsAt: formText('startsAt'),
    endsAt: formText('endsAt'),
  };

  const validation = validateAuctionInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
  }

  const imageValue = formData.get('image');
  if (imageValue !== null && typeof imageValue === 'string' && imageValue !== '') {
    return NextResponse.json({ error: 'Field gambar harus berupa file.' }, { status: 400 });
  }
  const imageFile = imageValue instanceof File ? imageValue : null;
  const imageValidation = validateImage(imageFile);
  if (!imageValidation.valid) {
    return NextResponse.json({ error: imageValidation.error }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    const path = generateStoragePath(imageFile);
    const { error: uploadError } = await supabase.storage
      .from('auction-images')
      .upload(path, imageFile, { upsert: false, contentType: imageFile.type });
    if (uploadError) {
    return NextResponse.json({ error: `Image upload failed: ${uploadError.message}` }, { status: 500 });
    }
    const { data: publicUrlData } = supabase.storage.from('auction-images').getPublicUrl(path);
    imageUrl = publicUrlData?.publicUrl || null;
  }

  const { sanitized } = validation;
  const { error: insertError, data: insertData } = await supabase.from('auctions').insert({
    title: sanitized.title,
    description: sanitized.description,
    image_url: imageUrl,
    auction_mode: sanitized.auctionMode,
    status: sanitized.status,
    starting_price: sanitized.startingPrice,
    current_price: sanitized.startingPrice,
    min_increment: sanitized.minIncrement,
    starts_at: sanitized.startsAt,
    ends_at: sanitized.endsAt,
    created_by: user.id,
  }).select('id');

  if (insertError) {
    const status = insertError.code === '23514' ? 400 : 500;
    return NextResponse.json({ error: insertError.message || 'Failed to create auction.' }, { status });
  }

  return NextResponse.json({ message: 'Auction created successfully', id: insertData?.[0]?.id }, { status: 201 });
}
