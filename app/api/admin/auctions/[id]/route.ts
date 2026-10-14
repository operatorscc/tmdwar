import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAuctionInput, validateImage, generateStoragePath, requireAdmin } from '@/lib/validation';

// ─── GET /api/admin/auctions/[id]: Fetch single auction ─────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Failed to fetch auction: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// ─── PUT /api/admin/auctions/[id]: Update auction ───────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });
  }

  // Fetch existing auction to check constraints
  const { data: existing, error: fetchError } = await supabase
    .from('auctions')
    .select('id, status, image_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch auction: ${fetchError.message}` }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  const formData = await request.formData();

  const input = {
    title: (formData.get('title') as string ?? '').trim(),
    description: (formData.get('description') as string ?? '').trim(),
    auctionMode: (formData.get('auctionMode') as string ?? 'timed'),
    status: (formData.get('status') as string ?? existing.status),
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

  // Handle image replacement
  let imageUrl: string | null = existing.image_url;
  const removeImage = formData.get('removeImage') === 'true';
  if (removeImage) {
    imageUrl = null;
  } else if (imageFile && imageFile.size > 0) {
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

  // When updating, current_price should remain >= starting_price
  // If starting_price changes, we need to ensure current_price >= starting_price
  const updateData: Record<string, string | null> = {
    title: sanitized.title,
    description: sanitized.description,
    image_url: imageUrl,
    auction_mode: sanitized.auctionMode,
    status: sanitized.status,
    starting_price: sanitized.startingPrice,
    min_increment: sanitized.minIncrement,
    starts_at: sanitized.startsAt,
    ends_at: sanitized.endsAt,
    updated_at: new Date().toISOString(),
  };

  // If starting price increased above current price, bump current price
  const newStartingPrice = Number(sanitized.startingPrice);
  const { data: currentData } = await supabase
    .from('auctions')
    .select('current_price')
    .eq('id', id)
    .maybeSingle();

  if (currentData) {
    const currentPrice = Number(currentData.current_price);
    if (newStartingPrice > currentPrice) {
      updateData.current_price = sanitized.startingPrice;
    }
  }

  const { error: updateError } = await supabase
    .from('auctions')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: `Failed to update auction: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ message: 'Auction updated successfully' });
}

// ─── DELETE /api/admin/auctions/[id]: Delete auction (draft only) ───────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });
  }

  // Fetch to verify status — only drafts can be deleted per RLS policy
  const { data: existing, error: fetchError } = await supabase
    .from('auctions')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch auction: ${fetchError.message}` }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft auctions can be deleted. Use "cancelled" status to retire active auctions.' },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase.from('auctions').delete().eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: `Failed to delete auction: ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json({ message: 'Auction deleted successfully' });
}
