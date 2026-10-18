import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Bank transfer payment verification contract", () => {
  const migration = source("supabase/migrations/20261018010000_verified_bank_transfer_payments.sql");
  const buyerApi = source("app/api/payments/route.ts");
  const adminApi = source("app/api/admin/payments/route.ts");
  const buyerUi = source("app/lelang/[id]/payment-submission.tsx");
  const adminUi = source("app/admin/payments/payment-review-client.tsx");

  it("keeps transfer evidence in a private, size- and MIME-limited bucket", () => {
    assert.match(migration, /'payment-proofs'[\s\S]*false[\s\S]*5242880/);
    assert.match(migration, /'application\/pdf'/);
    assert.match(migration, /Payment proof owner upload/);
    assert.match(migration, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  });

  it("restricts payment submissions to the official winner and a recorded sale", () => {
    assert.match(migration, /r\.winner_bidder_id = v_uid/);
    assert.match(migration, /t\.kind = 'sale'/);
    assert.match(migration, /Hanya pemenang resmi lelang/);
    assert.match(migration, /one_pending_per_auction_bidder/);
  });

  it("does not post cash or receivable journals before admin approval", () => {
    assert.match(migration, /status = 'pending'/);
    assert.match(migration, /public\.finance_record_transaction\([\s\S]*'customer_receipt'/);
    assert.match(migration, /if p_decision = 'approved' then/);
    assert.match(migration, /status = 'rejected'[\s\S]*finance_transaction_id = null/);
    assert.match(migration, /from public, anon/);
  });

  it("makes review decisions admin-only and requires a rejection reason", () => {
    assert.match(migration, /if v_uid is null or not public\.is_admin\(\) then/);
    assert.match(migration, /Alasan penolakan wajib diisi/);
    assert.match(adminApi, /requireAdmin\(supabase\)/);
    assert.match(adminApi, /review_payment_submission/);
  });

  it("validates the uploaded proof and requires a private stored object before submission", () => {
    assert.match(migration, /File bukti transfer belum terunggah ke penyimpanan privat/);
    assert.match(buyerApi, /submit_payment_proof/);
    assert.match(buyerUi, /5 \* 1024 \* 1024/);
    assert.match(buyerUi, /payment-proofs/);
  });

  it("exposes review queue and buyer status history", () => {
    assert.match(adminApi, /createSignedUrl\(item\.proof_path, 60 \* 5\)/);
    assert.match(adminUi, /Setujui Pembayaran/);
    assert.match(adminUi, /Tolak/);
    assert.match(buyerUi, /Riwayat pengajuan/);
    assert.match(buyerUi, /Menunggu verifikasi admin/);
  });
  it("keeps the SQL migration structurally complete with no duplicate function blocks or trailing SQL", () => {
    assert.equal((migration.match(/create or replace function public\.submit_payment_proof\(/g) ?? []).length, 1);
    assert.equal((migration.match(/create or replace function public\.review_payment_submission\(/g) ?? []).length, 1);
    assert.equal((migration.match(/create or replace function public\.payment_context_for_auction\(/g) ?? []).length, 1);
    assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
    assert.match(migration.trimEnd(), /\ncommit;$/);
  });

});
