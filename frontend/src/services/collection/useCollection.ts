import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'
import { DialogContext } from '@/context/DialogContext.ts'
import { useToast } from '@/hooks/use-toast.ts'
import { getExtraCards, getWantedCards } from '@/lib/utils'
import { updateCollectionTimestamp } from '@/services/account/accountService'
import { userQuery } from '@/services/auth/useAuth.ts'
import {
  getCachedCollection,
  getCollection,
  getPublicCollection,
  setCollected,
  updateAmountWanted,
  updateCards,
} from '@/services/collection/collectionService.ts'
import { useProfileAccount, useProfileEmail } from '@/services/profile/useProfile'
import type { CardAmountUpdate, CollectionRow } from '@/types'

export function collectionQuery(email: string | undefined, collectionLastUpdated: Date | undefined) {
  return queryOptions({
    queryKey: ['collection', email],
    queryFn: () => getCollection(email as string, collectionLastUpdated as Date),
    enabled: Boolean(email) && Boolean(collectionLastUpdated),
    // Shows the localStorage copy while the account query works out whether it's still current. Mutations refuse to
    // run on it (isPlaceholderData), as they write absolute amounts.
    placeholderData: () => (email ? (getCachedCollection(email) ?? undefined) : undefined),
    staleTime: 500, // Set a short stale time here because we handle the cache internally already (in case someone is using two devices at the same time)
  })
}

export function useCollection() {
  // Personal fork: the active profile's collection (main or alt), see services/profile/useProfile.ts
  const email = useProfileEmail()
  const { data: account } = useProfileAccount()

  return useQuery(collectionQuery(email, account?.collection_last_updated))
}

export function useTradingCards() {
  const email = useProfileEmail()
  const { data: account } = useProfileAccount()

  return useQuery({
    ...collectionQuery(email, account?.collection_last_updated),
    // select would run on the placeholder before the account has loaded
    placeholderData: undefined,
    select: (collection) => {
      if (!account) {
        throw new Error('Trading cards can only be fetched for logged in users.')
      }
      return {
        wanted: getWantedCards(collection, account.trade_rarity_settings),
        extra: getExtraCards(collection, account.trade_rarity_settings),
      }
    },
  })
}

export function publicCollectionQuery(friendId: string | undefined) {
  return queryOptions({
    queryKey: ['collection', friendId],
    queryFn: () => getPublicCollection(friendId as string),
    enabled: !!friendId,
    throwOnError: true,
    // Public collections don't change while viewing and we don't want to refetch, so cache indefinitely
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

export function useUpdateCards() {
  const { toast } = useToast()
  const { isLoading: isLoadingUser } = useQuery(userQuery)
  const { data: collection, isLoading: isLoadingCollection, isPlaceholderData } = useCollection()
  const email = useProfileEmail()

  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: CardAmountUpdate[]) => {
      if (isLoadingUser || isLoadingCollection || isPlaceholderData) {
        throw new Error('Context not yet loaded')
      }
      if (!email) {
        throw new Error('Email is required to update cards')
      }
      return updateCards(email, updates, collection ?? new Map<number, CollectionRow>())
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['collection', email], result.cards)

      // Update account data in cache (for collection_last_updated timestamp)
      queryClient.setQueryData(['account', email], result.account)
    },
    onError: async (error) => {
      toast({ title: 'Error updating cards', description: error.message, variant: 'destructive' })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['collection'] }), queryClient.invalidateQueries({ queryKey: ['account'] })])
    },
  })
}

export function useUpdateAmountWanted() {
  const { toast } = useToast()
  const { isLoading: isLoadingUser } = useQuery(userQuery)
  const { data: collection, isLoading: isLoadingCollection, isPlaceholderData } = useCollection()
  const email = useProfileEmail()

  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ internal_id, amount_wanted, do_insert }: { internal_id: number; amount_wanted: number | null; do_insert?: boolean }) => {
      if (isLoadingUser || isLoadingCollection || isPlaceholderData) {
        throw new Error('Context not yet loaded')
      }
      if (!email) {
        throw new Error('Email is required to update amount wanted')
      }
      const now = new Date()
      return Promise.all([
        updateAmountWanted(email, collection ?? new Map<number, CollectionRow>(), internal_id, amount_wanted, now, do_insert),
        updateCollectionTimestamp(email, now),
      ])
    },
    onSuccess: async ([cards, account]) => {
      queryClient.setQueryData(['collection', email], cards)
      queryClient.setQueryData(['account', email], account)
    },
    onError: async (error) => {
      toast({ title: 'Error updating cards', description: error.message, variant: 'destructive' })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['collection'] }), queryClient.invalidateQueries({ queryKey: ['account'] })])
    },
  })
}

export function useSetCollected() {
  const { isLoading: isLoadingUser } = useQuery(userQuery)
  const { data: collection, isLoading: isLoadingCollection, isPlaceholderData } = useCollection()
  const email = useProfileEmail()

  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ internal_ids, collected }: { internal_ids: number[]; collected: boolean }) => {
      if (isLoadingUser || isLoadingCollection || isPlaceholderData) {
        throw new Error('Context not yet loaded')
      }
      if (!email) {
        throw new Error('Email is required to delete card')
      }
      return setCollected(email, collection ?? new Map<number, CollectionRow>(), internal_ids, collected)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['collection', email], result.cards)

      // Update account data in cache (for collection_last_updated timestamp)
      queryClient.setQueryData(['account', email], result.account)
    },
  })
}

export function useSelectedCard() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useLoginDialog must be used within a ProfileDialogProvider')
  }
  return context
}
