BEGIN;

-- Public bid history is exposed only through the anonymized public_bid_feed view.
-- Anonymous clients do not need direct SELECT privileges on raw bid rows.
-- Keep authenticated SELECT subject to the existing own-bids/admin RLS policy.
REVOKE SELECT ON TABLE public.bids FROM anon;

COMMIT;
