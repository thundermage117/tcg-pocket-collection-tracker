// Personal fork: the collection's active filters as removable chips, so the phone view shows what's on without
// opening the sheet. A chip resets its filter to the default, which drops it from the URL.
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getExpansionById } from '@/lib/CardsDB'
import type { Filters } from '@/lib/filters'

interface Props {
  filters: Filters
  setFilters: (updates: Partial<Filters>) => void
  omit?: (keyof Filters)[] // shown elsewhere, like the search box
}

type Chip = { key: string; label: string; reset: Partial<Filters> }

export default function ActiveFilterChips({ filters, setFilters, omit = [] }: Props) {
  const { t } = useTranslation(['filters', 'common/sets', 'common/packs'])
  const f = (key: string) => t(key, { ns: 'filters' })
  const list = (values: string[] | undefined, prefix: string) => values?.map((x) => f(`${prefix}.${x}`)).join(', ')

  const chips: Chip[] = []
  const add = (key: keyof Filters, on: boolean, label: string | undefined, reset: Partial<Filters>) => {
    if (on && label && !omit.includes(key)) {
      chips.push({ key, label, reset })
    }
  }
  const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

  add('search', Boolean(filters.search), `“${filters.search}”`, { search: '' })
  add('allTextSearch', Boolean(filters.allTextSearch), 'All texts', { allTextSearch: false })
  add(
    'expansion',
    filters.expansion !== undefined && filters.expansion !== 'all',
    filters.expansion && filters.expansion !== 'all' ? t(getExpansionById(filters.expansion).name, { ns: 'common/sets' }) : undefined,
    { expansion: 'all', pack: 'all' },
  )
  add('pack', filters.pack !== undefined && filters.pack !== 'all', filters.pack && t(filters.pack, { ns: 'common/packs' }), { pack: 'all' })
  add('rarity', Boolean(filters.rarity?.length), filters.rarity?.join(' '), { rarity: [] })
  add('cardType', Boolean(filters.cardType?.length), filters.cardType?.map(capitalize).join(', '), { cardType: [] })
  add('trainerSubtype', Boolean(filters.trainerSubtype?.length), list(filters.trainerSubtype, 'f-trainerSubtype'), { trainerSubtype: [] })
  add('ownership', filters.ownership !== undefined && filters.ownership !== 'all', `${f('carddex')}: ${f(`f-ownership.${filters.ownership}`)}`, {
    ownership: 'all',
  })
  add('trading', filters.trading !== undefined && filters.trading !== 'all', f(`f-trading.${filters.trading}`), { trading: 'all' })
  add('sortBy', filters.sortBy !== undefined && filters.sortBy !== 'expansion-newest', `Sort: ${f(`f-sortBy.${filters.sortBy}`)}`, {
    sortBy: 'expansion-newest',
  })
  add('sortDesc', Boolean(filters.sortDesc), 'Reversed', { sortDesc: false })
  add('deckbuildingMode', Boolean(filters.deckbuildingMode), 'Deck-building mode', { deckbuildingMode: false })
  add('stage', Boolean(filters.stage?.length), list(filters.stage, 'f-stage'), { stage: [] })
  add('pokemonKind', Boolean(filters.pokemonKind?.length), list(filters.pokemonKind, 'f-pokemonKind'), { pokemonKind: [] })
  add('ability', filters.ability !== undefined && filters.ability !== 'all', `${f('f-ability.label')}: ${f(`f-ability.${filters.ability}`)}`, {
    ability: 'all',
  })
  add('minHp', Boolean(filters.minHp), `HP ≥ ${filters.minHp}`, { minHp: 0 })
  add('maxHp', filters.maxHp !== undefined && filters.maxHp !== '∞', `HP ≤ ${filters.maxHp}`, { maxHp: '∞' })
  add('minRetreat', Boolean(filters.minRetreat), `Retreat ≥ ${filters.minRetreat}`, { minRetreat: 0 })
  add('maxRetreat', filters.maxRetreat !== undefined && filters.maxRetreat !== '∞', `Retreat ≤ ${filters.maxRetreat}`, { maxRetreat: '∞' })
  add('minNumber', Boolean(filters.minNumber), `${f('f-number.label')} ≥ ${filters.minNumber}`, { minNumber: 0 })
  add('maxNumber', filters.maxNumber !== undefined && filters.maxNumber !== '∞', `${f('f-number.label')} ≤ ${filters.maxNumber}`, { maxNumber: '∞' })

  if (chips.length === 0) {
    return null
  }
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]">
      {chips.map(({ key, label, reset }) => (
        <button
          key={key}
          type="button"
          onClick={() => setFilters(reset)}
          aria-label={`Remove filter: ${label}`}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 py-1 pr-1.5 pl-2.5 text-xs text-neutral-200 hover:bg-neutral-700"
        >
          {label}
          <X className="size-3.5 text-neutral-400" />
        </button>
      ))}
    </div>
  )
}
