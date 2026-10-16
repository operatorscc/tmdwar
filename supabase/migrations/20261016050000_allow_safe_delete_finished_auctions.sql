BEGIN;

-- Permit admins to delete only draft, ended, or cancelled auctions.
-- Foreign-key RESTRICT constraints preserve auctions referenced by bids,
-- official results, inventory costs, journal lines, or finance transactions.
DROP POLICY IF EXISTS "Admins can delete draft auctions" ON public.auctions;

CREATE POLICY "Admins can delete removable auctions"
  ON public.auctions
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
    AND status IN (
      'draft'::public.auction_status,
      'ended'::public.auction_status,
      'cancelled'::public.auction_status
    )
  );

COMMIT;
