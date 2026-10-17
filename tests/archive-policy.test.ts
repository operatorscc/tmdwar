import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = (name: string) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Auction archive safety contract", () => {
  const archiveSql = migration("20261017000000_archive_auctions_without_deleting_history.sql");
  const journalCountSql = migration("20261017040000_count_journal_lines_via_parent_transaction.sql");
  const immutableSql = migration("20261017050000_make_auction_archives_immutable.sql");
  const inventoryCountSql = migration("20261017060000_guard_inventory_cost_parent_transaction.sql");
  const previewSql = migration("20261017070000_archive_preview_counts_in_database.sql");

  it("replaces permanent auction deletion and hides archived lots from public reads", () => {
    assert.match(archiveSql, /add column if not exists archived_at timestamptz/i);
    assert.match(archiveSql, /revoke delete on table public\.auctions from anon, authenticated/i);
    assert.match(archiveSql, /archived_at is null and status in \('scheduled', 'live', 'ended'\)/i);
    assert.match(archiveSql, /where a\.archived_at is null/i);
    assert.match(archiveSql, /grant select on public\.public_bid_feed to anon, authenticated/i);
    assert.doesNotMatch(archiveSql, /delete\s+from\s+public\.(bids|auction_results|finance_transactions|finance_journal_lines|finance_inventory_costs)/i);
  });

  it("requires an authenticated admin, row lock, explicit reason, and unchanged impact counts", () => {
    const protectedRpc = archiveSql + journalCountSql + immutableSql + inventoryCountSql;
    assert.match(protectedRpc, /auth\.uid\(\) is null or not public\.is_admin\(\)/i);
    assert.match(protectedRpc, /from public\.auctions\s+where id = p_auction_id\s+for update/i);
    assert.match(protectedRpc, /nullif\(btrim\(p_reason\), ''\) is null/i);
    assert.match(protectedRpc, /p_expected_counts/i);
    assert.match(protectedRpc, /is distinct from v_counts/i);
    assert.match(protectedRpc, /set_config\('tmdwar\.archive_rpc', 'on', true\)/i);
  });

  it("counts journal lines and inventory costs through their parent finance transaction", () => {
    assert.match(journalCountSql, /from public\.finance_journal_lines j[\s\S]*?j\.transaction_id in\s*\(\s*select t\.id/i);
    assert.match(inventoryCountSql, /from public\.finance_inventory_costs c[\s\S]*?c\.transaction_id in\s*\(\s*select t\.id/i);
    assert.match(previewSql, /from public\.finance_journal_lines j[\s\S]*?t\.auction_id = p_auction_id/i);
    assert.match(previewSql, /from public\.finance_inventory_costs c[\s\S]*?t\.auction_id = p_auction_id/i);
  });

  it("protects archived finance history and blocks permanent deletion or archive metadata tampering", () => {
    const transactionGuard = migration("20261017010000_block_finance_changes_for_archived_auctions.sql");
    const journalGuard = migration("20261017030000_guard_journal_lines_by_parent_transaction.sql");
    assert.match(immutableSql, /Penghapusan permanen lelang dinonaktifkan/i);
    assert.match(immutableSql, /tidak dapat diubah atau dipulihkan/i);
    assert.match(transactionGuard, /before insert or update on public\.finance_transactions/i);
    assert.match(journalGuard, /before insert or delete or update on public\.finance_journal_lines/i);
    assert.match(inventoryCountSql, /before insert or delete or update on public\.finance_inventory_costs/i);
  });

  it("requires the admin API to verify preview counts and a non-empty archive reason", () => {
    const route = source("app/api/admin/auctions/[id]/route.ts");
    assert.match(route, /requireAdmin\(supabase\)/);
    assert.match(route, /archive_auction_preview/);
    assert.match(route, /expectedCounts/);
    assert.match(route, /reason\.length > 1000/);
    assert.match(route, /supabase\.rpc\('archive_auction'/);
  });
});
