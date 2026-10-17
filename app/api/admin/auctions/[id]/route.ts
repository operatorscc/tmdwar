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

  const requestUrl = new URL(_request.url);
  if (requestUrl.searchParams.get('archivePreview') === '1') {
    const { data: auction, error: previewError } = await supabase
      .from('auctions')
      .select('id, title, status, archived_at')
      .eq('id', id)
      .maybeSingle();
    if (previewError) return NextResponse.json({ error: previewError.message }, { status: 500 });
    if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    if (auction.archived_at) return NextResponse.json({ error: 'Lelang sudah diarsipkan.' }, { status: 409 });

    const countFor = async (table: string, column = 'auction_id') => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, id);
      if (error) throw new Error(`Gagal menghitung ${table}: ${error.message}`);
      return count ?? 0;
    };
    try {
      const [bids, results, transactions, journalLines, inventoryCosts] = await Promise.all([
        countFor('bids'),
        countFor('auction_results'),
        countFor('finance_transactions'),
        countFor('finance_journal_lines'),
        countFor('finance_inventory_costs'),
      ]);
      return NextResponse.json({ title: auction.title, status: auction.status, counts: { bids, results, transactions, journalLines, inventoryCosts } });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memeriksa dampak arsip.' }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('auctions')
    .select('id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_at, updated_at, archived_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Failed to fetch auction: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }
  if (data.archived_at) {
    return NextResponse.json({ error: 'Lelang sudah diarsipkan dan tidak dapat diedit.' }, { status: 409 });
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
    .select('id, status, image_url, archived_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch auction: ${fetchError.message}` }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }
  if (existing.archived_at) {
    return NextResponse.json({ error: 'Lelang yang sudah diarsipkan tidak dapat diedit.' }, { status: 409 });
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
    status: formText('status', existing.status),
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
    const status = updateError.code === '23514' ? 409 : 500;
    return NextResponse.json({ error: updateError.message || 'Failed to update auction.' }, { status });
  }

  return NextResponse.json({ message: 'Auction updated successfully' });
}

// ─── DELETE /api/admin/auctions/[id]: Archive auction; never delete history ─────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { isAdmin, error: adminErr } = await requireAdmin(supabase);
  if (!isAdmin) return NextResponse.json({ error: adminErr || 'Forbidden' }, { status: 403 });

  let body: { confirmTitle?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Konfirmasi arsip tidak valid.' }, { status: 400 });
  }

  const confirmTitle = typeof body.confirmTitle === 'string' ? body.confirmTitle : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!confirmTitle.trim() || !reason || reason.length > 1000) {
    return NextResponse.json({ error: 'Nama lelang untuk konfirmasi dan alasan arsip wajib diisi (maksimal 1.000 karakter).' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('auctions')
    .select('id, title, status, archived_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: `Gagal memeriksa lelang: ${fetchError.message}` }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Lelang tidak ditemukan.' }, { status: 404 });
  if (existing.archived_at) return NextResponse.json({ error: 'Lelang sudah diarsipkan.' }, { status: 409 });
  if (confirmTitle !== existing.title) {
    return NextResponse.json({ error: 'Nama lelang berubah sejak konfirmasi. Muat ulang dan periksa kembali dampaknya.' }, { status: 409 });
  }

  // Archive is reversible only by a deliberate admin workflow; no child rows are deleted.
  // Active auctions are cancelled in the same UPDATE so place_bid rejects further bids.
  const nextStatus = ['scheduled', 'live'].includes(existing.status) ? 'cancelled' : existing.status;
  const { data: archivedRow, error: archiveError } = await supabase
    .from('auctions')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      archive_reason: reason,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (archiveError) {
    if (archiveError.code === '23514') return NextResponse.json({ error: archiveError.message }, { status: 409 });
    return NextResponse.json({ error: `Gagal mengarsipkan lelang: ${archiveError.message}` }, { status: 500 });
  }

  if (!archivedRow) return NextResponse.json({ error: 'Lelang sudah diarsipkan atau berubah. Muat ulang daftar.' }, { status: 409 });

  return NextResponse.json({
    message: 'Lelang berhasil diarsipkan. Riwayat penawaran, hasil, transaksi, jurnal, dan biaya tetap dipertahankan.',
    archived: true,
    status: nextStatus,
  });
}
