// Personal fork: a species' Pokédex entry and every printing of it, grouped by form, with what's owned and the best pack for a missing one.
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { Spinner } from '@/components/Spinner'
import { formatRarity } from '@/components/utils'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import {
  allSpecies,
  dexEntriesQuery,
  formArtworkId,
  generationOf,
  getSpecies,
  lineOf,
  loadReturn,
  ownedCount,
  shinySpecies,
  speciesName,
  typesOf,
} from '@/lib/pokedex'
import { cn, getCardNameByLang } from '@/lib/utils'
import { getPackChances, type PackChance } from '@/pages/overview/packChances'
import { oneIn } from '@/pages/packs/types'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import type { ExpansionId } from '@/types'
import { dexMatcher, parseDexFilters } from './dexFilters'
import { EvolutionChain } from './EvolutionChain'
import { dexLabel, GroupIcon, groupLabels, ProgressBar, Sprite, typeColors, typeGlow } from './SpeciesTile'

export default function SpeciesDetail() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { nr } = useParams()
  const { data: collection, isLoading } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const species = getSpecies(Number(nr))
  // supportedLngs keeps resolvedLanguage to the locales that have an entries file
  const { data: entries } = useQuery(dexEntriesQuery(i18n.resolvedLanguage ?? 'en-US'))
  const navigate = useNavigate()
  // opened from the Pokédex, ← / → step through its filtered list (in its sort order); otherwise through every species
  const location = useLocation()
  const saved = location.state?.fromDex === true ? loadReturn() : undefined
  const dexList = saved ? dexMatcher(parseDexFilters(new URLSearchParams(saved.search)), collection).filtered : allSpecies
  const steps = species && dexList.some((s) => s.dexNr === species.dexNr) ? dexList : allSpecies
  const index = species ? steps.findIndex((s) => s.dexNr === species.dexNr) : -1
  const prev = steps[index - 1]
  const next = steps[index + 1]
  // a species opens at the top, not at the scroll position of the list or species it came from
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [nr])
  const stepTo = (to: { dexNr: number }) => navigate(`/pokedex/${to.dexNr}`, { replace: true, state: location.state })

  // ← / → on desktop; ignored while typing or with a dialog (card detail) open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select') || document.querySelector('[role="dialog"]')) {
        return
      }
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined
      if (to) {
        stepTo(to)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, stepTo])

  // a mostly horizontal swipe on phones does the same
  // ?shiny (from the Shiny Pokédex) opens on the shiny artwork; the ✵ button flips it
  const [searchParams, setSearchParams] = useSearchParams()
  const [showShiny, setShowShiny] = useState(searchParams.has('shiny'))
  const shinyCards = shinySpecies.find((s) => s.dexNr === species?.dexNr)?.cards ?? []
  const shinyOwned = ownedCount(collection, shinyCards)
  // the hero's form (Alolan Vulpix, Mega Charizard X) is in the URL (?form=<artwork id>), so evolution-line form tiles open on it
  // and stepping to another species drops it
  const formParam = Number(searchParams.get('form')) || undefined
  const pickForm = (artworkId: number | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (artworkId) {
          next.set('form', String(artworkId))
        } else {
          next.delete('form')
        }
        return next
      },
      { replace: true, state: location.state },
    )
  // stepping on to a species with no shiny card falls back to the regular artwork (it has no toggle to flip back);
  // shiny artwork exists for species only, not forms
  const shiny = showShiny && shinyCards.length > 0 && !formParam

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
      stepTo(to)
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
  // forms with artwork of their own, cards pooled by artwork (Mega Charizard X ex and a plain Mega Charizard X would share one)
  const heroForms = [...Map.groupBy(species.forms, (form) => formArtworkId(species, form))]
    .filter(([artworkId]) => artworkId !== species.dexNr)
    .map(([artworkId, forms]) => {
      const cards = species.cards.filter((c) => forms.includes(c.name))
      return { artworkId, cards, name: getCardNameByLang(cards[0], i18n.language).replace(/ ex$/, '') }
    })
  const heroForm = heroForms.find((f) => f.artworkId === formParam)
  const heroOwned = heroForm ? ownedCount(collection, heroForm.cards) : owned
  // the plain species glows in its own types only: Vulpix Fire, though Alolan Vulpix makes the species Fire and Water
  // (a species with only form cards, like a Galarian-only one, falls back to the species' types)
  const plainCards = species.cards.filter((c) => !heroForms.some((f) => f.cards.includes(c)))
  const heroTypes = heroForm ? typesOf(heroForm.cards) : plainCards.length > 0 ? typesOf(plainCards) : species.types
  const entry = entries?.[heroForm?.artworkId ?? species.dexNr]

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
        <Link
          to={`/pokedex${loadReturn()?.search ?? ''}`}
          state={{ returning: true }}
          onClick={(e) => {
            // came from the Pokédex (←/→ replace entries, so it's one back): go back rather than stack another entry
            if (location.state?.fromDex) {
              e.preventDefault()
              navigate(-1)
            }
          }}
          className="flex items-center hover:text-white"
        >
          <ChevronLeft className="size-4" /> Pokédex
        </Link>
        <span className="flex items-center gap-4">
          {prev && (
            <Link to={`/pokedex/${prev.dexNr}`} replace state={location.state} className="flex items-center hover:text-white">
              <ChevronLeft className="size-4" />
              {speciesName(prev, i18n.language)}
            </Link>
          )}
          {steps !== allSpecies && (
            <span title="Position in the Pokédex's filtered list" className="tabular-nums">
              {index + 1}/{steps.length}
            </span>
          )}
          {next && (
            <Link to={`/pokedex/${next.dexNr}`} replace state={location.state} className="flex items-center hover:text-white">
              {speciesName(next, i18n.language)}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </span>
      </nav>

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="mx-auto flex w-56 shrink-0 flex-col gap-2 sm:mx-0 sm:w-72 lg:w-80">
          {/* the shown form's types glow behind its artwork (Alolan Vulpix in Water); uncaught species stay a silhouette */}
          <div
            className="relative rounded-2xl border-1 border-neutral-700 border-solid bg-neutral-800/60 p-4"
            style={{ backgroundImage: typeGlow(heroTypes, '70') }}
          >
            {shiny ? (
              <>
                <Sprite artworkId={species.dexNr} caught={shinyOwned > 0} shiny alt={name} className={shinyOwned === 0 ? 'opacity-25' : undefined} />
                {shinyOwned === 0 && <span className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-neutral-400">No shiny caught yet</span>}
              </>
            ) : (
              <>
                <Sprite
                  artworkId={heroForm?.artworkId ?? species.dexNr}
                  caught={heroOwned > 0}
                  alt={heroForm?.name ?? name}
                  className={heroOwned === 0 ? 'opacity-25' : undefined}
                />
                {heroOwned === 0 && <span className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-neutral-400">Not caught yet</span>}
              </>
            )}
            {shinyCards.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowShiny(!shiny)
                  pickForm(undefined)
                }}
                title={shiny ? 'Show regular artwork' : `Show shiny artwork (${shinyOwned}/${shinyCards.length} shiny cards)`}
                className={`absolute top-2 right-2 cursor-pointer rounded-full border-1 border-solid px-2 py-0.5 text-xs transition-colors ${shiny ? 'border-pink-300 bg-pink-300/20 text-pink-200' : 'border-neutral-600 bg-neutral-900/60 text-neutral-300 hover:border-pink-300'}`}
              >
                ✵ {shinyOwned}/{shinyCards.length}
              </button>
            )}
          </div>
          {heroForms.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {[{ artworkId: species.dexNr, name, caught: owned > 0 }, ...heroForms.map((f) => ({ ...f, caught: ownedCount(collection, f.cards) > 0 }))].map(
                (f) => {
                  const selected = f.artworkId === (heroForm?.artworkId ?? species.dexNr)
                  return (
                    <button
                      key={f.artworkId}
                      type="button"
                      title={f.name}
                      aria-pressed={selected}
                      onClick={() => {
                        pickForm(f.artworkId === species.dexNr ? undefined : f.artworkId)
                        setShowShiny(false)
                      }}
                      className={`cursor-pointer rounded-lg border-1 border-solid p-0.5 transition-colors ${selected ? 'border-blue-300 bg-neutral-800' : 'border-neutral-700 hover:border-neutral-500'}`}
                    >
                      <Sprite artworkId={f.artworkId} caught={f.caught} alt={f.name} className="size-11" />
                    </button>
                  )
                },
              )}
            </div>
          )}
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
            {species.group && (
              <span className="flex items-center gap-1 rounded-full border-1 border-neutral-600 border-solid px-2 py-0.5 font-normal text-sm">
                <GroupIcon group={species.group} />
                {groupLabels[species.group]}
              </span>
            )}
          </h1>
          {heroForm && <p className="font-medium text-blue-200 text-sm">{heroForm.name}</p>}
          {entry && (
            <>
              <p className="text-neutral-400">{entry.g}</p>
              {/* a form without a known entry shows none rather than the species' */}
              {entry.f && <blockquote className="mt-3 max-w-xl border-l-2 border-neutral-600 pl-3 text-neutral-200 italic">{entry.f}</blockquote>}
              <p className="mt-2 text-sm text-neutral-400 tabular-nums">
                {(entry.h / 10).toLocaleString(i18n.language)} m · {(entry.w / 10).toLocaleString(i18n.language)} kg
              </p>
            </>
          )}
          {/* stats fill the width beside the larger artwork: printings first, then a tile each */}
          <dl className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Stat label="Printings" className="col-span-full">
              <span className="flex items-center gap-3">
                <span className="font-semibold text-lg tabular-nums">
                  {owned}
                  <span className="font-normal text-neutral-400 text-sm">/{species.cards.length}</span>
                </span>
                <ProgressBar value={owned} max={species.cards.length} color={typeColors[species.types[0]]} className="h-2 grow" />
              </span>
            </Stat>
            <Stat label="Forms">{species.forms.length}</Stat>
            <Stat label="Illustrators">{artists.size}</Stat>
            <Stat label="First appeared" className="col-span-full sm:col-span-1">
              {firstSet} · {t(getExpansionById(firstSet).name)}
            </Stat>
            {best && best.pct > 0 && (
              <Stat label="Best pack for a missing one" className="col-span-full">
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
        const artworkId = formArtworkId(species, form)
        // a form with its own PokéAPI entry has its own size (Mega Charizard X weighs 110.5 kg, Charizard 90.5)
        const formEntry = artworkId !== species.dexNr ? entries?.[artworkId] : undefined
        return (
          // long sections (Pikachu has dozens of printings) fold away; open by default
          <details key={form} open className="group mb-8">
            <summary className="mb-3 flex cursor-pointer list-none items-center gap-3 font-semibold text-lg [&::-webkit-details-marker]:hidden">
              <Sprite artworkId={artworkId} caught={formOwned} alt="" className="size-10 shrink-0" />
              <span className="min-w-0">
                {getCardNameByLang(cards[0], i18n.language)}
                {formEntry && (
                  <span className="block font-normal text-neutral-400 text-xs tabular-nums">
                    {(formEntry.h / 10).toLocaleString(i18n.language)} m · {(formEntry.w / 10).toLocaleString(i18n.language)} kg
                  </span>
                )}
              </span>
              <span className="text-sm text-neutral-400 tabular-nums">
                {cards.filter((c) => owns(c.internal_id)).length}/{cards.length}
              </span>
              <ChevronDown className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {cards.map((card) => {
                const amount = collection?.get(card.internal_id)?.amount_owned ?? 0
                return (
                  <li key={card.internal_id}>
                    <CardThumb
                      card={card}
                      className={amount === 0 ? 'opacity-55 transition-opacity hover:opacity-100' : undefined}
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
          </details>
        )
      })}
    </main>
  )
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800/60 px-3 py-2', className)}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  )
}
