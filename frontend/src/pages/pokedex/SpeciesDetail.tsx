// Personal fork: every printing of one species, grouped by form, with what's owned and the best pack for a missing one.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { Spinner } from '@/components/Spinner'
import { formatRarity } from '@/components/utils'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { allSpecies, generationOf, getSpecies, lineOf, ownedCount, speciesName } from '@/lib/pokedex'
import { getCardNameByLang } from '@/lib/utils'
import { getPackChances, type PackChance } from '@/pages/overview/packChances'
import { oneIn } from '@/pages/packs/types'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import type { ExpansionId } from '@/types'
import { EvolutionChain } from './EvolutionChain'
import { dexLabel, ProgressBar } from './SpeciesTile'

export default function SpeciesDetail() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { nr } = useParams()
  const { data: collection, isLoading } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const species = getSpecies(Number(nr))

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
  const index = allSpecies.indexOf(species)
  const prev = allSpecies[index - 1]
  const next = allSpecies[index + 1]
  const line = lineOf(species)

  const setIndex = (id: string) => expansions.findIndex((e) => e.id === id)
  const firstSet = species.cards.reduce((a, c) => (setIndex(c.expansion) < setIndex(a.expansion) ? c : a)).expansion
  const artists = new Set(species.cards.map((c) => c.artist))

  // the overview's pick, limited to this species' missing printings
  const missing = species.cards.filter((c) => !owns(c.internal_id))
  const best = [...getPackChances(species.cards, [], missing, false)]
    .flatMap(([expansionId, chances]) => chances.map((chance) => ({ expansionId, ...chance })))
    .reduce<(PackChance & { expansionId: ExpansionId }) | undefined>((a, b) => (!a || b.pct > a.pct ? b : a), undefined)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
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

      <header className="mb-6">
        <p className="text-neutral-500 tabular-nums">
          {dexLabel(species.dexNr)} · Gen {generationOf(species.dexNr).nr}
        </p>
        <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
          {name}
          <span className="flex gap-1">
            {species.types.map((type) => (
              <img key={type} src={`/images/energy/${type}.webp`} alt={type} className="size-6" />
            ))}
          </span>
        </h1>
        <div className="mt-3 flex max-w-md items-center gap-3">
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
        return (
          <section key={form} className="mb-8">
            <h2 className="mb-3 flex items-baseline gap-3 font-semibold text-lg">
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
