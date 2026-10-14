import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAuctionInput, validateImage, generateStoragePath, requireAdmin } from '@/lib/validation';

// ─── GET: List auctions (admin sees all, including drafts) ───────────────────
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
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;
  const statusFilter = searchParams.get('status');
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('auctions')
    .select('id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_by, created_at, updated_at', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: `Failed to fetch auctions: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}

// ─── POST: Create auction (admin only) ──────────────────────────────────────
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

  const formData = await request.formData();

  const input = {
    title: (formData.get('title') as string ?? '').trim(),
    description: (formData.get('description') as string ?? '').trim(),
    auctionMode: (formData.get('auctionMode') as string ?? 'timed'),
    status: (formData.get('status') as string ?? 'draft'),
    startingPrice: (formData.get('startingPrice') as string ?? '0'),
    minIncrement: (formData.get('minIncrement') as string ?? '0'),
    startsAt: (formData.get('startsAt') as string ?? ''),
    endsAt: (formData.get('endsAt') as string ?? ''),
  };

  const validation = validateAuctionInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
  }

  const imageFile = formData.get('image') as File | null;
  const imageValidation = validateImage(imageFile);
  if (!imageValidation.valid) {
    return NextResponse.json({ error: imageValidation.error }, { status: 400 });
  }

  // Image upload handling
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
    return NextResponse.json({ error: `Failed to create auction: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ message: 'Auction created successfully', id: insertData?.[0]?.id }, { status: 201 });
}
