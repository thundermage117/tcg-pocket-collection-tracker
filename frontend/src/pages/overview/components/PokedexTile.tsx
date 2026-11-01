// Personal fork: species owned, linking to the Pokédex. Ignores the overview's filters, like the Pokédex itself.
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { allSpecies, ownedCount } from '@/lib/pokedex'
import { ProgressBar } from '@/pages/pokedex/Pokedex'
import type { Collection } from '@/types'

export function PokedexTile({ collection, className }: { collection: Collection; className?: string }) {
  const owned = allSpecies.filter((s) => ownedCount(collection, s.cards) > 0).length
  return (
    <Link
      to="/pokedex"
      className={`flex items-center gap-3 rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 px-4 py-3 transition-colors hover:border-neutral-500 ${className ?? ''}`}
    >
      <span className="shrink-0 font-bold">Pokédex</span>
      <ProgressBar value={owned} max={allSpecies.length} className="h-2 grow" />
      <span className="shrink-0 text-sm tabular-nums">
        {owned}
        <span className="text-neutral-400">/{allSpecies.length} species</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-neutral-400" />
    </Link>
  )
}
