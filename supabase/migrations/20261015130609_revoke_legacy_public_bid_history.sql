begin;

-- The application reads the anonymized public_bid_feed view instead.
-- Prevent the legacy SECURITY DEFINER RPC from exposing profile display names.
revoke execute on function public.get_public_bid_history(uuid) from anon, authenticated;

commit;
