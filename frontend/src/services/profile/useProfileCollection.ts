// Personal fork: explicit main / alt collections, for pages that need both at once (the active one is useCollection).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { withAltCards } from '@/lib/altSupport'
import { updateCards } from '@/services/collection/collectionService'
import { collectionQuery } from '@/services/collection/useCollection'
import type { CardAmountUpdate, Collection } from '@/types'
import { type Profile, useCountAlt, useProfileAccount, useProfileEmail } from './useProfile'

export function useProfileCollection(profile: Profile) {
  const email = useProfileEmail(profile)
  const { data: account } = useProfileAccount(profile)
  return useQuery(collectionQuery(email, account?.collection_last_updated))
}

/**
 * Main's collection for planning (what's missing, which pack to open): with "Count alt" on, cards the alt can gift
 * or trade to main count as owned. Ignores the header's Main / Alt switch, since the goal is always main.
 */
export function useMainWithAlt() {
  const main = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')
  const countAlt = useCountAlt()
  const merged = useMemo(() => (main.data ? withAltCards(main.data, alt) : undefined), [main.data, alt])
  // cards main lacks that the alt covers, for the switch's label
  const covered = useMemo(() => {
    let n = 0
    for (const [id, row] of merged ?? []) {
      if (row.amount_owned > 0 && (main.data?.get(id)?.amount_owned ?? 0) === 0) {
        n++
      }
    }
    return n
  }, [merged, main.data])
  return { data: countAlt ? merged : main.data, isLoading: main.isLoading, covered }
}

/** One copy of a card changing hands: `from` loses it, `to` gains it. */
export interface Transfer {
  internal_id: number
  from: Profile
  to: Profile
}

/** Absolute rows to write per profile: what a transfer writes, or what its undo puts back. */
export type ProfileRows = Partial<Record<Profile, CardAmountUpdate[]>>

/** Writes rows to both collections and updates their caches; the shared half of transfer and restore. */
function useWriteProfileRows<T>(prepare: (collections: Record<Profile, Collection>, input: T) => { write: ProfileRows; before: ProfileRows }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const emails = { main: useProfileEmail('main'), alt: useProfileEmail('alt') }

  return useMutation({
    mutationFn: async (input: T) => {
      // Read from the cache at call time, not the last render: an undo can fire from a toast after its page unmounted.
      // The cache never holds the localStorage placeholder, and absolute amounts get written, so that's the one to use.
      const collections = {
        main: emails.main ? queryClient.getQueryData<Collection>(['collection', emails.main]) : undefined,
        alt: emails.alt ? queryClient.getQueryData<Collection>(['collection', emails.alt]) : undefined,
      }
      if (!collections.main || !collections.alt) {
        throw new Error('Collections not loaded yet')
      }
      const loaded = collections as Record<Profile, Collection>
      const { write, before } = prepare(loaded, input)
      const results = []
      for (const profile of ['main', 'alt'] as const) {
        const updates = write[profile] ?? []
        if (updates.length > 0) {
          const email = emails[profile] as string
          results.push({ email, ...(await updateCards(email, updates, loaded[profile])) })
        }
      }
      return { results, before }
    },
    onSuccess: ({ results }) => {
      for (const { email, cards, account } of results) {
        queryClient.setQueryData(['collection', email], new Map(cards)) // updateCards edits the cached Map in place
        queryClient.setQueryData(['account', email], account)
      }
    },
    onError: async (error) => {
      toast({ title: 'Error moving cards', description: error.message, variant: 'destructive' })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['collection'] }), queryClient.invalidateQueries({ queryKey: ['account'] })])
    },
  })
}

const rowOf = (collection: Collection, internal_id: number): CardAmountUpdate => {
  const row = collection.get(internal_id)
  return { internal_id, amount_owned: row?.amount_owned ?? 0, collected: row?.collected ?? false }
}

/**
 * Moves cards between the two collections (a gift or a trade between your own accounts). The result's `before`
 * holds the touched rows as they were, for `useRestoreCards` to undo it exactly (including the card dex flag).
 */
export function useTransferCards() {
  return useWriteProfileRows((collections, transfers: Transfer[]) => {
    const write: ProfileRows = {}
    const before: ProfileRows = {}
    for (const profile of ['main', 'alt'] as const) {
      const collection = collections[profile]
      const delta = new Map<number, number>()
      for (const t of transfers) {
        const change = (t.to === profile ? 1 : 0) - (t.from === profile ? 1 : 0)
        delta.set(t.internal_id, (delta.get(t.internal_id) ?? 0) + change)
      }
      const changed = [...delta].filter(([, change]) => change !== 0)
      before[profile] = changed.map(([internal_id]) => rowOf(collection, internal_id))
      write[profile] = changed.map(([internal_id, change]) => {
        const row = rowOf(collection, internal_id)
        const amount_owned = Math.max(0, row.amount_owned + change)
        return { internal_id, amount_owned, collected: row.collected || amount_owned > 0 }
      })
    }
    return { write, before }
  })
}

/** Puts rows back as a transfer's `before` recorded them. */
export function useRestoreCards() {
  return useWriteProfileRows((collections, rows: ProfileRows) => ({
    write: rows,
    before: Object.fromEntries(Object.entries(rows).map(([p, r]) => [p, r.map((row) => rowOf(collections[p as Profile], row.internal_id))])),
  }))
}
