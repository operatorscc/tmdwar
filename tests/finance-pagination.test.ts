import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Finance history pagination contract", () => {
  const route = source("app/api/admin/finance/route.ts");
  const client = source("app/admin/finance/finance-client.tsx");

  it("applies search, kind, and date filters on the server with exact result counts", () => {
    assert.match(route, /select\([^\n]*\{ count: "exact" \}\)/);
    assert.match(route, /transactionsQuery = transactionsQuery\.or\(searchClauses\.join\(","\)\)/);
    assert.match(route, /transactionsQuery = transactionsQuery\.gte\("transaction_date", dateFrom\)/);
    assert.match(route, /transactionsQuery = transactionsQuery\.lte\("transaction_date", dateTo\)/);
    assert.match(route, /transactionsQuery = transactionsQuery\.eq\("kind", kind\)/);
  });

  it("preserves Indonesian transaction-kind labels in search", () => {
    assert.match(route, /"Pembelian barang"/);
    assert.match(route, /"Penjualan barang"/);
    assert.match(route, /"Penerimaan pembayaran"/);
    assert.match(route, /"Beban operasional"/);
    assert.match(route, /searchClauses\.push\(`kind\.eq\.\${transactionKind}`\)/);
  });

  it("uses deterministic ordering for page-based supporting-data queries", () => {
    assert.match(route, /\.ilike\("title", `%\${search}%`\)\.order\("id", \{ ascending: true \}\)\.range\(from, to\)/);
    assert.match(route, /\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: true \}\)\s*\.range\(from, to\)/);
    assert.match(route, /const DATA_PAGE_SIZE = 500/);
  });

  it("distinguishes an empty ledger from an empty filtered page", () => {
    assert.match(client, /!data\?\.transactionPagination\.total/);
    assert.match(client, /visibleTransactions\.length === 0/);
    assert.match(client, /!data\?\.journalPagination\.total/);
    assert.match(client, /Tidak ada baris jurnal pada halaman ini/);
  });

  it("explains that finance summary is global and profit is provisional", () => {
    assert.match(client, /Ringkasan dihitung dari seluruh jurnal yang tercatat/);
    assert.match(client, /bukan hanya hasil pencarian atau filter tanggal/);
    assert.match(client, /belum tentu mencakup pajak atau penyesuaian akuntansi/);
    assert.match(client, /\["Kas tercatat", data\.summary\.cash\]/);
    assert.match(client, /\["Nilai persediaan", data\.summary\.inventory\]/);
    assert.match(client, /\["Piutang pelanggan", data\.summary\.accounts_receivable\]/);
    assert.match(client, /\["Laba \/ rugi sementara", data\.summary\.net_profit\]/);
  });

  it("prevents an older request from overwriting newer search or filter results", () => {
    assert.match(client, /const requestSequence = useRef\(0\)/);
    assert.match(client, /const requestId = \+\+requestSequence\.current/);
    assert.match(client, /if \(requestId !== requestSequence\.current\) return/);
    assert.match(client, /if \(requestId === requestSequence\.current\) setLoading\(false\)/);
  });
});
