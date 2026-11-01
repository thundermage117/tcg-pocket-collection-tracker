// Personal fork: the most traded-for cards you don't have yet, by the same demand score as Rankings' "Most wanted".
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { getMostWanted, type RankedCard, tiers } from '@/lib/rankings'
import { useSelectedCard } from '@/services/collection/useCollection'
import type { Rarity } from '@/types'

const COUNT = 8

let mostWanted: RankedCard[] | undefined

interface Props {
  wantedIds: Set<number> // cards the overview's filters count as missing
  rarity: Rarity[]
}

export function MostWantedMissing({ wantedIds, rarity }: Props) {
  const { setSelectedCardId } = useSelectedCard()
  mostWanted ??= getMostWanted()
  const entries = mostWanted.filter((e) => wantedIds.has(e.card.internal_id)).slice(0, COUNT)
  if (entries.length === 0) {
    return null
  }

  const params = new URLSearchParams({ tab: 'wanted', missing: '1' })
  if (rarity.length > 0) {
    params.set('rarity', rarity.join(','))
  }

  return (
    <section className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold text-base sm:text-lg">Most wanted you're missing</h2>
        <Link to={`/rankings?${params}`} className="flex items-center gap-0.5 text-neutral-400 text-xs hover:text-neutral-200">
          See all in Rankings
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {/* Phones scroll sideways so the strip stays one row and the heatmap stays close */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:grid md:grid-cols-8 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
        {entries.map((e) => {
          const tier = tiers[e.tier]
          return (
            <div key={e.card.card_id} className="w-24 shrink-0 md:w-auto">
              <CardThumb
                card={e.card}
                // tier and position share the bottom label; a top badge would cover the card's name
                label={
                  <>
                    <span style={{ color: tier.color }}>{tier.name}</span> #{e.position}
                  </>
                }
                labelTitle={`${tier.name} tier, #${e.position} in Most wanted`}
                onClick={() => setSelectedCardId(e.card.internal_id)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
