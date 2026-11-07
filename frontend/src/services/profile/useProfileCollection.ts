// Personal fork: explicit main / alt collections, for pages that need both at once (the active one is useCollection).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { updateCards } from '@/services/collection/collectionService'
import { collectionQuery } from '@/services/collection/useCollection'
import type { CollectionRow } from '@/types'
import { type Profile, useProfileAccount, useProfileEmail } from './useProfile'

export function useProfileCollection(profile: Profile) {
  const email = useProfileEmail(profile)
  const { data: account } = useProfileAccount(profile)
  return useQuery(collectionQuery(email, account?.collection_last_updated))
}

/** One copy of a card changing hands: `from` loses it, `to` gains it. */
export interface Transfer {
  internal_id: number
  from: Profile
  to: Profile
}

/** Moves cards between the two collections (a gift or a trade between your own accounts). */
export function useTransferCards() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const profiles = {
    main: { email: useProfileEmail('main'), query: useProfileCollection('main') },
    alt: { email: useProfileEmail('alt'), query: useProfileCollection('alt') },
  }

  return useMutation({
    mutationFn: async (transfers: Transfer[]) => {
      for (const { email, query } of Object.values(profiles)) {
        // absolute amounts get written, so never from the localStorage placeholder
        if (!email || !query.data || query.isPlaceholderData) {
          throw new Error('Collections not loaded yet')
        }
      }
      const results = []
      for (const profile of ['main', 'alt'] as const) {
        const { email, query } = profiles[profile]
        const collection = query.data as Map<number, CollectionRow>
        const delta = new Map<number, number>()
        for (const t of transfers) {
          const change = (t.to === profile ? 1 : 0) - (t.from === profile ? 1 : 0)
          delta.set(t.internal_id, (delta.get(t.internal_id) ?? 0) + change)
        }
        const updates = [...delta]
          .filter(([, change]) => change !== 0)
          .map(([internal_id, change]) => {
            const row = collection.get(internal_id)
            const amount_owned = Math.max(0, (row?.amount_owned ?? 0) + change)
            return { internal_id, amount_owned, collected: (row?.collected ?? false) || amount_owned > 0 }
          })
        if (updates.length > 0) {
          results.push({ email: email as string, ...(await updateCards(email as string, updates, collection)) })
        }
      }
      return results
    },
    onSuccess: (results) => {
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
