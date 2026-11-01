// Personal fork: a species' Pokédex entry and every printing of it, grouped by form, with what's owned and the best pack for a missing one.
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { Spinner } from '@/components/Spinner'
import { formatRarity } from '@/components/utils'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { allSpecies, dexEntriesQuery, formArtworkId, generationOf, getSpecies, lineOf, ownedCount, speciesName } from '@/lib/pokedex'
import { getCardNameByLang } from '@/lib/utils'
import { getPackChances, type PackChance } from '@/pages/overview/packChances'
import { oneIn } from '@/pages/packs/types'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import type { ExpansionId } from '@/types'
import { EvolutionChain } from './EvolutionChain'
import { dexLabel, ProgressBar, Sprite, typeColors } from './SpeciesTile'

export default function SpeciesDetail() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { nr } = useParams()
  const { data: collection, isLoading } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const species = getSpecies(Number(nr))
  // supportedLngs keeps resolvedLanguage to the locales that have an entries file
  const { data: entries } = useQuery(dexEntriesQuery(i18n.resolvedLanguage ?? 'en-US'))
  const navigate = useNavigate()
  const index = species ? allSpecies.indexOf(species) : -1
  const prev = allSpecies[index - 1]
  const next = allSpecies[index + 1]

  // ← / → on desktop; ignored while typing or with a dialog (card detail) open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select') || document.querySelector('[role="dialog"]')) {
        return
      }
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined
      if (to) {
        navigate(`/pokedex/${to.dexNr}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, navigate])

  // a mostly horizontal swipe on phones does the same
  const touchStart = useRef<{ x: number; y: number } | undefined>(undefined)
  const onTouchStart = (e: React.TouchEvent) => {
    // not on the evolution line, which scrolls sideways itself
    touchStart.current = (e.target as HTMLElement).closest('.overflow-x-auto') ? undefined : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = undefined
    if (!start) {
      return
    }
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    const to = Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(dy) ? (dx > 0 ? prev : next) : undefined
    if (to) {
      navigate(`/pokedex/${to.dexNr}`)
    }
  }

  if (isLoading) {
    return <Spinner size="lg" overlay />
  }
  if (!species) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 text-center text-neutral-400">
        No species {nr} in TCG Pocket.{' '}
        <Link to="/pokedex" className="underline">
          Back to the Pokédex
        </Link>
      </main>
    )
  }

  const owns = (id: number) => (collection?.get(id)?.amount_owned ?? 0) > 0
  const owned = ownedCount(collection, species.cards)
  const name = speciesName(species, i18n.language)
  const line = lineOf(species)
  const entry = entries?.[species.dexNr]

  const setIndex = (id: string) => expansions.findIndex((e) => e.id === id)
  const firstSet = species.cards.reduce((a, c) => (setIndex(c.expansion) < setIndex(a.expansion) ? c : a)).expansion
  const artists = new Set(species.cards.map((c) => c.artist))

  // the overview's pick, limited to this species' missing printings
  const missing = species.cards.filter((c) => !owns(c.internal_id))
  const best = [...getPackChances(species.cards, [], missing, false)]
    .flatMap(([expansionId, chances]) => chances.map((chance) => ({ expansionId, ...chance })))
    .reduce<(PackChance & { expansionId: ExpansionId }) | undefined>((a, b) => (!a || b.pct > a.pct ? b : a), undefined)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <nav className="mb-4 flex items-center justify-between text-sm text-neutral-400">
        <Link to="/pokedex" className="flex items-center hover:text-white">
          <ChevronLeft className="size-4" /> Pokédex
        </Link>
        <span className="flex gap-4">
          {prev && (
            <Link to={`/pokedex/${prev.dexNr}`} className="flex items-center hover:text-white">
              <ChevronLeft className="size-4" />
              {speciesName(prev, i18n.language)}
            </Link>
          )}
          {next && (
            <Link to={`/pokedex/${next.dexNr}`} className="flex items-center hover:text-white">
              {speciesName(next, i18n.language)}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </span>
      </nav>

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        {/* the species' main type glows behind its artwork; uncaught species stay a silhouette */}
        <div
          className="relative mx-auto w-48 shrink-0 rounded-2xl border-1 border-neutral-700 border-solid p-3 sm:mx-0 sm:w-60"
          style={{ background: `radial-gradient(circle at 50% 45%, ${typeColors[species.types[0]]}55, transparent 70%)` }}
        >
          <Sprite artworkId={species.dexNr} caught={owned > 0} alt={name} className={owned === 0 ? 'opacity-25' : undefined} />
          {owned === 0 && <span className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-neutral-400">Not caught yet</span>}
        </div>

        <div className="min-w-0 grow">
          <p className="text-neutral-500 tabular-nums">
            {dexLabel(species.dexNr)} · Gen {generationOf(species.dexNr).nr} · {generationOf(species.dexNr).region}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
            {name}
            <span className="flex gap-1">
              {species.types.map((type) => (
                <img key={type} src={`/images/energy/${type}.webp`} alt={type} className="size-6" />
              ))}
            </span>
          </h1>
          {entry && (
            <>
              <p className="text-neutral-400">{entry.g}</p>
              <blockquote className="mt-3 max-w-xl border-l-2 border-neutral-600 pl-3 text-neutral-200 italic">{entry.f}</blockquote>
              <p className="mt-2 text-sm text-neutral-400 tabular-nums">
                {(entry.h / 10).toLocaleString(i18n.language)} m · {(entry.w / 10).toLocaleString(i18n.language)} kg
              </p>
            </>
          )}
          <div className="mt-4 flex max-w-md items-center gap-3">
            <ProgressBar value={owned} max={species.cards.length} className="h-2 grow" />
            <span className="text-sm tabular-nums">
              {owned}/{species.cards.length} printings
            </span>
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Stat label="Forms">{species.forms.length}</Stat>
            <Stat label="Illustrators">{artists.size}</Stat>
            <Stat label="First appeared">
              {firstSet} · {t(getExpansionById(firstSet).name)}
            </Stat>
            {best && best.pct > 0 && (
              <Stat label="Best pack for a missing one">
                {t(best.pack.name, { ns: 'common/packs' })} ({best.expansionId}) · {oneIn(best.pct / 100)} packs
              </Stat>
            )}
          </dl>
        </div>
      </header>

      {line.stages.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-baseline gap-3 font-semibold text-lg">
            Evolution line
            <span className="text-sm text-neutral-400 tabular-nums">
              {line.species.filter((s) => ownedCount(collection, s.cards) > 0).length}/{line.species.length} species
            </span>
          </h2>
          <div className="overflow-x-auto pb-1">
            <EvolutionChain line={line} collection={collection} lang={i18n.language} current={species.dexNr} />
          </div>
        </section>
      )}

      {species.forms.map((form) => {
        const cards = species.cards.filter((c) => c.name === form)
        const formOwned = cards.some((c) => owns(c.internal_id))
        return (
          <section key={form} className="mb-8">
            <h2 className="mb-3 flex items-center gap-3 font-semibold text-lg">
              <Sprite artworkId={formArtworkId(species, form)} caught={formOwned} alt="" className="size-10 shrink-0" />
              {getCardNameByLang(cards[0], i18n.language)}
              <span className="text-sm text-neutral-400 tabular-nums">
                {cards.filter((c) => owns(c.internal_id)).length}/{cards.length}
              </span>
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {cards.map((card) => {
                const amount = collection?.get(card.internal_id)?.amount_owned ?? 0
                return (
                  <li key={card.internal_id}>
                    <CardThumb
                      card={card}
                      className={amount === 0 ? 'opacity-40 grayscale' : undefined}
                      onClick={() => setSelectedCardId(card.internal_id)}
                      label={
                        <>
                          {card.expansion} {formatRarity(card.rarity)}
                        </>
                      }
                      badge={amount > 0 && <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">×{amount}</span>}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </main>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  )
}
