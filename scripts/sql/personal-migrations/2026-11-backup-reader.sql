-- Personal fork: a read-only login for .github/workflows/collection-backup.yml.
-- It can only SELECT the four tables the backup copies, and RLS lets it see every row (main and alt).
-- Run once in the Supabase SQL editor, with your own long random password in place of the placeholder.
-- The workflow connects through the session pooler as backup_reader.<project ref>; see FORK.md, "Collection backup".

CREATE ROLE backup_reader LOGIN PASSWORD 'replace-with-a-long-random-password';

GRANT USAGE ON SCHEMA public TO backup_reader;
GRANT SELECT ON public.accounts, public.card_amounts, public.trade_rarity_settings, public.decks TO backup_reader;

CREATE POLICY "backup-read" ON public.accounts FOR SELECT TO backup_reader USING (true);
CREATE POLICY "backup-read" ON public.card_amounts FOR SELECT TO backup_reader USING (true);
CREATE POLICY "backup-read" ON public.trade_rarity_settings FOR SELECT TO backup_reader USING (true);
CREATE POLICY "backup-read" ON public.decks FOR SELECT TO backup_reader USING (true);
