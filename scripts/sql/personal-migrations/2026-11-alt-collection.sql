-- Personal fork: a second (alt) collection under the same login.
-- The alt's rows use the key 'alt:<login email>' in the existing tables, so every collection query and cache works
-- for it unchanged. These policies let the signed-in user read and write that key next to their own email.
-- Run once in the Supabase SQL editor; personal-schema.sql has the same policies for fresh projects.

CREATE POLICY "alt-rows" ON public.accounts
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));
CREATE POLICY "alt-rows" ON public.card_amounts
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));
CREATE POLICY "alt-rows" ON public.trade_rarity_settings
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));

-- The alt's accounts row. collection_last_updated must be set: the collection query waits for it.
-- The frontend also creates the row on first use, so this is only a head start.
INSERT INTO public.accounts (email, collection_last_updated)
SELECT 'alt:' || email, now() FROM public.accounts WHERE email NOT LIKE 'alt:%'
ON CONFLICT (email) DO NOTHING;
