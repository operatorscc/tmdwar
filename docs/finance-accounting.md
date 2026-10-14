# TMD-WAR Finance & Accounting

## Scope in this first release

This additive module provides:
- Admin-only recording of inventory purchases, auction sales, customer receipts, and operating expenses.
- Automatic double-entry journal posting in a single PostgreSQL function call.
- A cumulative summary of module-recorded cash, inventory cost, receivables, sales, cost of goods sold, operating expenses, gross profit, and net profit.
- A recent transaction list and general journal view.
- No direct client write access to finance tables; writes go through `finance_record_transaction`, which checks `public.is_admin()`.

## Apply the database migration

1. Open Supabase Dashboard for the same project used by TMD-WAR.
2. Open SQL Editor and create a new query.
3. Open `supabase/migrations/20261015000000_finance_accounting.sql` in GitHub.
4. Copy the entire SQL file into SQL Editor and run it once.
5. Confirm the query succeeds before using the finance page.

GitHub file: https://github.com/operatorscc/tmdwar/blob/main/supabase/migrations/20261015000000_finance_accounting.sql

Do not re-run the initial schema or reset existing database tables. This migration is additive and does not modify `auctions`, `bids`, or `place_bid()`.

## Open the module

After the migration succeeds and the Vercel deployment is Ready, sign in with an admin account and open `/admin/finance`, or click **Keuangan & Akuntansi** from the admin dashboard.

## Posting rules

| Event | Debit | Credit |
|---|---|---|
| Record purchase of an auction item | Inventory | Cash |
| Record a sale | Accounts receivable; Cost of goods sold | Sales revenue; Inventory |
| Record customer payment | Cash | Accounts receivable |
| Record operating expense | Operating expense | Cash |

Sales are only accepted for an `ended` auction with a recorded accepted bid, a recorded inventory purchase cost, and no previously posted sale. The buyer label is derived from the profile attached to the highest recorded bid. Sale value is taken from the auction's current price; cash is not recognized until a separate customer receipt is recorded.

## Important limitations before production accounting

- The displayed balances include only transactions entered in this finance module. They do not automatically import historic cash, inventory, sales, or expenses.
- Opening balances, owner capital, accounts payable, tax, refunds, depreciation, shipping, and period-filtered financial statements are not included yet.
- Inventory purchase entries assume the item was paid in cash immediately.
- The module is a first implementation, not a substitute for review by a qualified Indonesian accountant before statutory or tax reporting.
- The journal is append-only through the UI; do not alter finance rows manually. A controlled reversal/correction workflow should be added before regular production use.
