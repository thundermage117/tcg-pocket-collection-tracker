// Personal fork: main's progress towards the latest expansion's ☆☆ Wonder Pick unlock and what the alt can hand it next,
// for the today panel's Unlock, Gift and Trade rows. Always main's real collection: it ignores the Main / Alt switch and
// "Count alt's cards".
import { useMemo } from 'react'
import { allTwoStarsRegistered, altCovers, bestUnlockPack, canMoveToMain, latestExpansion, unlockProgress } from '@/lib/altSupport'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Card } from '@/types'

const packCount = latestExpansion.packs.filter((p) => p.name !== 'everypack').length

export function useUnlockPlan() {
  const { data: mainAccount } = useProfileAccount('main')
  const { data: main } = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')

  return useMemo(() => {
    if (!main || !alt || !mainAccount) {
      return undefined
    }
    const progress = unlockProgress(main)
    const cover = altCovers(main, mainAccount.trade_rarity_settings, alt)
    const altCanGive = (c: Card) => canMoveToMain(c) && (alt.get(c.internal_id)?.amount_owned ?? 0) > 0
    return {
      progress,
      cover,
      // nothing left for the Wonder Picks to show
      finished: progress.missing.length === 0 && allTwoStarsRegistered(main),
      altHas: progress.missing.filter((c) => c.rarity !== '☆' && altCanGive(c)).length,
      altStars: progress.missing.filter((c) => c.rarity === '☆' && altCanGive(c)).length,
      // only worth naming when the expansion has a choice of packs
      best: packCount > 1 ? bestUnlockPack(progress.missing.filter((c) => !altCanGive(c))) : undefined,
    }
  }, [main, alt, mainAccount])
}
