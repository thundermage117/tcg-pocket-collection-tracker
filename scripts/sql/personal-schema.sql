-- Personal-fork schema: the subset of schema.sql that the single-user app needs.
-- Run once in a fresh Supabase project's SQL editor.
-- Omitted on purpose: friends, messages, trades, cards_list, the `greg` read-only role
-- policies, and all edge functions (social/trading features are unlinked in the fork).

CREATE TABLE public.accounts (
    email character varying NOT NULL,
    username character varying,
    friend_id character varying,
    is_public boolean DEFAULT false,
    is_active_trading boolean DEFAULT false,
    collection_last_updated timestamp with time zone,
    completed_missions character varying[],
    language character(2),
    last_active timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT username_min_length CHECK (((username IS NULL) OR (length((username)::text) >= 2))),
    CONSTRAINT accounts_pkey PRIMARY KEY (email),
    CONSTRAINT accounts_friend_id_unique UNIQUE (friend_id)
);

CREATE TABLE public.card_amounts (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    amount_owned smallint DEFAULT '0'::smallint NOT NULL,
    email character varying NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    internal_id integer NOT NULL,
    amount_wanted integer,
    collected boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_amount_nonnegative CHECK ((amount_owned >= 0)),
    CONSTRAINT card_amounts_pkey PRIMARY KEY (email, internal_id)
);

CREATE TABLE public.trade_rarity_settings (
    email character varying NOT NULL REFERENCES public.accounts(email) ON UPDATE CASCADE,
    rarity character varying NOT NULL,
    to_collect numeric DEFAULT '0'::numeric NOT NULL,
    to_keep numeric DEFAULT '0'::numeric NOT NULL,
    rarity_id smallint GENERATED ALWAYS AS (
CASE rarity
    WHEN '◊'::text THEN 0
    WHEN '◊◊'::text THEN 1
    WHEN '◊◊◊'::text THEN 2
    WHEN '◊◊◊◊'::text THEN 3
    WHEN '☆'::text THEN 4
    WHEN '☆☆'::text THEN 5
    WHEN '☆☆☆'::text THEN 6
    WHEN '✵'::text THEN 8
    WHEN '✵✵'::text THEN 9
    WHEN 'Crown Rare'::text THEN 12
    WHEN 'P'::text THEN 16
    ELSE NULL::integer
END) STORED,
    collecting_carddex boolean DEFAULT false NOT NULL,
    CONSTRAINT trade_rarity_settings_pkey PRIMARY KEY (email, rarity)
);

CREATE TABLE public.decks (
    id serial PRIMARY KEY,
    email character varying NOT NULL REFERENCES public.accounts(email) ON UPDATE CASCADE,
    is_public boolean NOT NULL,
    name character varying(64) NOT NULL,
    energy character varying(24)[] NOT NULL,
    cards integer[] NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT decks_energy_check CHECK ((array_length(energy, 1) > 0)),
    CONSTRAINT decks_name_check CHECK ((length((name)::text) > 0))
);

CREATE TABLE public.deck_likes (
    id integer NOT NULL REFERENCES public.decks(id),
    email character varying NOT NULL REFERENCES public.accounts(email) ON UPDATE CASCADE,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT deck_likes_pkey PRIMARY KEY (id, email)
);

CREATE INDEX idx_accounts_collection_last_updated ON public.accounts USING btree (collection_last_updated);
CREATE INDEX idx_card_amounts_email_internal_id_amount ON public.card_amounts USING btree (email, internal_id) INCLUDE (amount_owned);
CREATE INDEX idx_card_amounts_email_rarity_id ON public.card_amounts USING btree (email, ((internal_id & 63)));
CREATE INDEX idx_trade_rarity_settings_email_rarity_id ON public.trade_rarity_settings USING btree (email, rarity_id) INCLUDE (to_keep, to_collect);

-- Views queried by accountService / deckService
CREATE VIEW public.public_accounts AS
 SELECT a.username,
    a.friend_id,
    a.is_active_trading,
    array_agg(json_build_object('rarity', t.rarity, 'to_collect', t.to_collect, 'to_keep', t.to_keep)) AS trade_rarity_settings
   FROM (public.accounts a
     LEFT JOIN public.trade_rarity_settings t ON (((a.email)::text = (t.email)::text)))
  WHERE (a.is_public = true)
  GROUP BY a.username, a.friend_id, a.is_active_trading;

CREATE VIEW public.public_decks AS
 SELECT d.id,
    d.name,
    a.username,
    d.energy,
    d.cards,
    d.created_at,
    d.updated_at,
    count(dl.email) AS likes
   FROM ((public.decks d
     LEFT JOIN public.deck_likes dl ON ((dl.id = d.id)))
     LEFT JOIN public.accounts a ON (((a.email)::text = (d.email)::text)))
  WHERE (d.is_public = true)
  GROUP BY d.id, a.username, d.name, d.energy, d.cards;

-- Row-level security: every row belongs to the signed-in email
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_rarity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ensure-own-rows" ON public.accounts USING (((email)::text = ( SELECT auth.email() AS email)));
CREATE POLICY "ensure-only-own-rows" ON public.card_amounts USING (((email)::text = ( SELECT auth.email() AS email)));
CREATE POLICY "ensure-own-rows" ON public.trade_rarity_settings USING (((email)::text = ( SELECT auth.email() AS email)));
CREATE POLICY "ensure only own rows" ON public.decks USING (((email)::text = ( SELECT auth.email() AS email)));
CREATE POLICY "ensure only own rows" ON public.deck_likes USING (((email)::text = ( SELECT auth.email() AS email)));
-- Fork addition: the alt collection lives under 'alt:<login email>' (personal-migrations/2026-11-alt-collection.sql).
CREATE POLICY "alt-rows" ON public.accounts
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));
CREATE POLICY "alt-rows" ON public.card_amounts
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));
CREATE POLICY "alt-rows" ON public.trade_rarity_settings
    USING (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))))
    WITH CHECK (((email)::text = ('alt:'::text || ( SELECT auth.email() AS email))));

-- Fork addition: create the accounts row on sign-up. Upstream only creates it when the
-- profile dialog is saved, and collection writes (updateCollectionTimestamp) need it to exist.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $$
BEGIN
  INSERT INTO public.accounts (email) VALUES (NEW.email) ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Explicit Data API grants. Supabase's default privileges usually cover these, but newer
-- projects may not expose public tables automatically; RLS above still limits rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts, public.card_amounts, public.trade_rarity_settings,
    public.decks, public.deck_likes TO authenticated;
GRANT USAGE ON SEQUENCE public.decks_id_seq TO authenticated;
GRANT SELECT ON public.public_accounts, public.public_decks TO anon, authenticated;
