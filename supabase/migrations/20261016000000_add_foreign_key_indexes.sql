-- Add indexes for foreign-key columns flagged by the Supabase performance advisor.
-- These indexes are additive and do not change auction or finance behavior.

create index if not exists auction_results_winner_bidder_id_idx
  on public.auction_results (winner_bidder_id);

create index if not exists auctions_winner_bidder_id_idx
  on public.auctions (winner_bidder_id);

create index if not exists finance_transactions_created_by_idx
  on public.finance_transactions (created_by);
