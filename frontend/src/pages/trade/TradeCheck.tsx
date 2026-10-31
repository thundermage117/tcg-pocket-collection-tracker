// Personal fork: trade fairness check (/trade/check?give=<card_id>&get=<card_id>). Scoring lives in lib/tradeFairness.
import { ArrowLeft, ArrowLeftRight, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ValueDataAge } from '@/components/ValueDataAge'
import { getCardById, getCardByInternalId, getExpansionById } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { bestAsks, type CardScore, duplicateShinedust, judgeTrade, PACK_POINTS_PER_PACK, packPointCost, shareLabel, shinedustCost } from '@/lib/tradeFairness'
import { cn, getCardNameByLang } from '@/lib/utils'
import { useAccount } from '@/services/account/useAccount'
import { useLoginDialog } from '@/services/auth/useAuth'
import { useCollection, useTradingCards } from '@/services/collection/useCollection'
import { type Card, defaultRaritySettings, type TradableRarity } from '@/types'
import { type PickItem, type PickSource, TradeCheckPicker } from './components/TradeCheckPicker'
import { type ContextLine, TradeVerdict } from './components/TradeVerdict'
import { cardScore, isTradable, scoreHint, tradableCards } from './tradeCheckData'

type Side = 'give' | 'get'

const fmt = (n: number) => n.toLocaleString('en-US')

function Slot({ side, card, score, active, onClick }: { side: Side; card?: Card; score?: CardScore; active: boolean; onClick: () => void }) {
  const { t, i18n } = useTranslation('common/sets')
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
        active ? 'border-neutral-300 bg-neutral-800' : 'border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60',
      )}
    >
      <span className={cn('text-xs font-semibold uppercase tracking-wide', side === 'give' ? 'text-amber-400' : 'text-violet-400')}>
        {side === 'give' ? 'I give' : 'I get'}
      </span>
      {card ? (
        <>
          <img src={getLocalizedImagePath(card, i18n.language)} alt="" className="aspect-[367/512] w-24 rounded-md object-cover sm:w-32" />
          <span className="w-full truncate text-sm font-medium">{getCardNameByLang(card, i18n.language)}</span>
          <span className="w-full truncate text-xs text-neutral-400">
            {card.rarity} · {t(getExpansionById(card.expansion).name)}
          </span>
          {score && (
            <span className="text-xs text-neutral-300 tabular-nums">
              Score <span className="font-semibold text-white">{score.score !== undefined ? Math.round(score.score) : '–'}</span> · {scoreHint(score)}
            </span>
          )}
        </>
      ) : (
        <span className="flex aspect-[367/512] w-24 items-center justify-center rounded-md border-2 border-dashed border-neutral-700 text-neutral-500 sm:w-32">
          <Plus className="size-6" />
        </span>
      )}
      {!card && <span className="text-sm text-neutral-400">Pick a card</span>}
    </button>
  )
}

export default function TradeCheck() {
  const { t, i18n } = useTranslation('common/sets')
  const [params, setParams] = useSearchParams()
  const { data: account } = useAccount()
  const { data: collection } = useCollection()
  const { data: trading } = useTradingCards()
  const { setIsLoginDialogOpen } = useLoginDialog()

  const fromParam = (key: Side) => {
    const card = getCardById(params.get(key) ?? '')
    return card && isTradable(card) ? card : undefined
  }
  const give = fromParam('give')
  const getCandidate = fromParam('get')
  const get = getCandidate && give && getCandidate.rarity !== give.rarity ? undefined : getCandidate
  const [active, setActive] = useState<Side | undefined>(give ? (get ? undefined : 'get') : 'give')

  const setCards = (next: { give?: Card; get?: Card }) => {
    const search = new URLSearchParams()
    if (next.give) {
      search.set('give', next.give.card_id)
    }
    if (next.get) {
      search.set('get', next.get.card_id)
    }
    setParams(search, { replace: true })
  }

  const pick = (side: Side, card: Card) => {
    if (side === 'give') {
      // a different rarity can't be traded for the card already on the other side
      setCards({ give: card, get: get && get.rarity === card.rarity ? get : undefined })
      setActive(get && get.rarity === card.rarity ? undefined : 'get')
    } else {
      setCards({ give, get: card })
      setActive(give ? undefined : 'give')
    }
  }

  const keepByRarity = useMemo(() => Object.fromEntries((account?.trade_rarity_settings ?? []).map((s) => [s.rarity, s.to_keep])), [account])
  const holding = (card: Card) => {
    const row = collection?.get(card.internal_id)
    return { owned: row?.amount_owned ?? 0, keep: row?.amount_wanted ?? keepByRarity[card.rarity] ?? defaultRaritySettings.to_keep }
  }

  const lists = useMemo(() => {
    const toCards = (ids: number[] | undefined) => (ids ?? []).flatMap((id) => getCardByInternalId(id) ?? []).filter(isTradable)
    return { ft: toCards(trading?.extra), lf: toCards(trading?.wanted) }
  }, [trading])

  const allItems: PickItem[] = useMemo(() => tradableCards.map((card) => ({ card })), [])
  const loggedIn = !!account

  const giveSources: PickSource[] = [
    ...(loggedIn
      ? [
          {
            id: 'ft',
            label: 'My spares',
            empty: 'No spares beyond your keep counts.',
            items: lists.ft.map((card) => {
              const h = holding(card)
              return { card, label: `×${h.owned - h.keep}` }
            }),
          },
        ]
      : []),
    { id: 'all', label: 'All cards', empty: 'No tradable cards.', items: allItems },
  ]

  const asks = useMemo(() => {
    if (!give) {
      return []
    }
    const candidates = lists.lf.filter((c) => c.rarity === give.rarity && c.card_id !== give.card_id).map((card) => ({ item: card, score: cardScore(card) }))
    return bestAsks(cardScore(give), candidates)
  }, [give, lists.lf])

  const getSources: PickSource[] = [
    ...(loggedIn && give
      ? [
          {
            id: 'asks',
            label: 'Best asks',
            empty: 'Nothing on your LF list at this rarity scores at least fair for your card.',
            items: asks.map(
              (a): PickItem => ({
                card: a.item,
                badge: (
                  <span
                    title={a.realistic ? 'Fair for both sides' : 'Better for you: they may decline'}
                    className={cn('rounded px-1 py-0.5 text-[10px] font-semibold text-white shadow', a.realistic ? 'bg-sky-600' : 'bg-emerald-600')}
                  >
                    {a.realistic ? 'fair' : 'reach'}
                  </span>
                ),
              }),
            ),
          },
          { id: 'lf', label: 'My LF', empty: 'Nothing on your LF list at this rarity.', items: lists.lf.map((card) => ({ card })) },
        ]
      : []),
    { id: 'all', label: 'All cards', empty: 'No tradable cards at this rarity.', items: allItems },
  ]

  const giveScore = give && cardScore(give)
  const getScore = get && cardScore(get)
  const verdict = give && get && giveScore && getScore ? judgeTrade(giveScore, getScore, give.rarity) : undefined

  const context: ContextLine[] = []
  if (give && get) {
    const name = (card: Card) => getCardNameByLang(card, i18n.language)
    if (loggedIn) {
      const g = holding(get)
      context.push(
        g.owned === 0
          ? { text: `You don't have ${name(get)} yet.` }
          : g.owned < g.keep
            ? { text: `You have ${g.owned} of ${name(get)} (keeping ${g.keep}), so this gets you closer.` }
            : { text: `You already have ${g.owned} of ${name(get)} (keeping ${g.keep}), so this would be a spare.`, warn: true },
      )
      const h = holding(give)
      context.push(
        h.owned === 0
          ? { text: `You don't own ${name(give)}.`, warn: true }
          : h.owned > h.keep
            ? { text: `${name(give)} is a spare: you have ${h.owned}, keeping ${h.keep}.` }
            : { text: `Trading ${name(give)} leaves you ${h.owned - 1}, below your keep of ${h.keep}.`, warn: true },
      )
    }
    const rarity = give.rarity as TradableRarity
    const cost = shinedustCost[rarity]
    context.push({
      text:
        cost === 0
          ? `No Shinedust: ${rarity} trades are free (1 trade stamina each side).`
          : `You pay ${fmt(cost)} Shinedust and they pay the same, about what ${Math.round(cost / duplicateShinedust[rarity])} ${rarity} duplicates give you.`,
    })
    const points = packPointCost[get.rarity]
    if (points) {
      context.push({
        text: `Benchmark: crafting ${name(get)} costs ${fmt(points)} ${t(getExpansionById(get.expansion).name)} pack points (${fmt(points / PACK_POINTS_PER_PACK)} packs of that set).`,
      })
    }
  }

  const rarityNote = give && (
    <>
      Trades must be the same rarity, so only {give.rarity} cards are shown.
      {giveScore?.score !== undefined && ` Your card scores ${Math.round(giveScore.score)} (${shareLabel(giveScore.score)}).`}
    </>
  )

  return (
    <main className="mx-auto max-w-4xl px-4 pb-12">
      <header className="mb-5">
        <Link to="/trade" className="mb-2 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft className="size-4" />
          Trade
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">Trade check</h1>
        <p className="mt-1 text-sm text-neutral-400">Pick the card you'd give and the card you'd get to see if the trade is fair.</p>
        <ValueDataAge className="mt-2" />
      </header>

      <div className="mb-5 flex items-stretch gap-2 sm:gap-4">
        <Slot side="give" card={give} score={giveScore} active={active === 'give'} onClick={() => setActive(active === 'give' ? undefined : 'give')} />
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            title="Swap sides"
            disabled={!give || !get}
            onClick={() => setCards({ give: get, get: give })}
            className="text-neutral-400"
          >
            <ArrowLeftRight className="size-5" />
          </Button>
        </div>
        <Slot side="get" card={get} score={getScore} active={active === 'get'} onClick={() => setActive(active === 'get' ? undefined : 'get')} />
      </div>
      {(give || get) && (
        <div className="-mt-2 mb-5 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCards({})
              setActive('give')
            }}
          >
            <X className="size-4" />
            Clear trade
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {verdict && giveScore && getScore && <TradeVerdict verdict={verdict} give={giveScore} get={getScore} context={context} />}

        {active === 'give' && <TradeCheckPicker key="give" title="Card you give" sources={giveSources} onPick={(card) => pick('give', card)} />}
        {active === 'get' &&
          (give ? (
            <TradeCheckPicker
              key={`get-${give.card_id}`}
              title="Card you get"
              sources={getSources}
              lockedRarity={give.rarity}
              note={rarityNote}
              onPick={(card) => pick('get', card)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">Pick the card you give first: the card you get has to be the same rarity.</p>
          ))}

        {!loggedIn && (
          <p className="text-sm text-neutral-400">
            <button type="button" className="cursor-pointer underline" onClick={() => setIsLoginDialogOpen(true)}>
              Log in
            </button>{' '}
            to pick from your spares and LF list and see what you own.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          Not tradable: ☆☆☆, Crown Rare and promo cards. Cards with a flair only trade for same-rarity cards with a flair.
        </p>
      </div>
    </main>
  )
}
