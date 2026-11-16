// Personal fork: the luck report (lib/luck.ts). One sentence up top: what the ☆-and-rarer cards are worth in packs
// against the packs the cards say were opened. Then luck per rarity, and per expansion with a dial for where it sits.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SetLogo } from '@/components/CardThumb'
import { Skeleton } from '@/components/Skeleton'
import { formatRarity } from '@/components/utils'
import { type ExpansionLuck, evidenceNames, getLuck, judgedNames, luckWords, roundPacks, typicalCount } from '@/lib/luck'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Rarity } from '@/types'

const big = 'font-semibold text-neutral-50 tabular-nums'
const note = 'mt-3 text-pretty text-neutral-400 text-sm sm:text-base'

// outside the middle 30–70%, a rarity or expansion is tinted as lucky or unlucky
const tint = (percentile: number) => (percentile >= 0.7 ? 'text-amber-300' : percentile <= 0.3 ? 'text-sky-400' : 'text-neutral-300')

/** Where the luck sits between unlucky and lucky: a dot on a track with the middle marked. Not progress: there's no end to reach. */
function LuckDial({ percentile }: { percentile: number }) {
  const lucky = percentile >= 0.5
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-neutral-700/70" aria-hidden>
      <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-neutral-500" />
      <span
        className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ${lucky ? 'bg-amber-300' : 'bg-sky-400'}`}
        style={{ left: `${Math.min(98, Math.max(2, 100 * percentile))}%` }}
      />
    </span>
  )
}

function Row({ row }: { row: ExpansionLuck }) {
  const { t } = useTranslation(['common/sets'])
  const opened = row.atLeast ? `at least ${roundPacks(row.packs)}` : `about ${roundPacks(row.packs)}`
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:grid-cols-[7rem_1fr_14rem]">
      <SetLogo expansionId={row.expansion.id} className="h-9 max-w-[7rem] justify-self-start" />
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-neutral-100">{t(row.expansion.name, { ns: 'common/sets' })}</p>
        <p className="text-neutral-400">
          Opened {opened} packs
          {!row.atLeast && row.packs >= 1 && (
            <span className="text-neutral-500">
              {' '}
              ({roundPacks(row.low)}–{roundPacks(row.high)})
            </span>
          )}
          {' · '}
          {row.rares} ☆+ owned, worth {roundPacks(row.worth)} packs
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1">
        {row.atLeast ? (
          <p className="text-neutral-500 text-xs">Every {evidenceNames[row.evidenceLevel]} owned, so the packs are a floor and luck can't be judged here.</p>
        ) : (
          <>
            <LuckDial percentile={row.judged.percentile} />
            <p className="mt-1.5 text-neutral-400 text-xs">
              {luckWords(row.judged.percentile)}
              {row.evidenceLevel > 0 && ` on ${judgedNames[row.evidenceLevel]}`}
            </p>
          </>
        )}
      </div>
      {/* each rarity against its typical count; the ones that counted the packs are greyed, as their luck can't be read */}
      <ul className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:col-span-3">
        {row.byRarity.map((r) => {
          const judged = r.judged && !row.atLeast
          return (
            <li
              key={r.rarity}
              className={judged ? 'text-neutral-400' : 'text-neutral-600'}
              title={
                judged
                  ? `${r.owned} of ${r.total} owned · ${luckWords(r.percentile)}`
                  : `${r.owned} of ${r.total} owned · used to count the packs here, so not judged`
              }
            >
              <span className={judged ? undefined : 'opacity-50'}>{formatRarity(r.rarity as Rarity)}</span>{' '}
              <span className={`font-medium tabular-nums ${judged ? tint(r.percentile) : ''}`}>{r.owned}</span>
              {judged && <span className="tabular-nums"> · typical {typicalCount(r.expected)}</span>}
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function Luck() {
  const { data: collection, isLoading } = useProfileCollection('main')
  const { setIsLoginDialogOpen } = useSelectedCard()
  const luck = useMemo(() => (collection ? getLuck(collection) : undefined), [collection])
  const floors = luck?.expansions.filter((r) => r.atLeast) ?? []
  const { t } = useTranslation(['common/sets'])

  return (
    <main className="mx-auto max-w-4xl px-4 pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Luck</h1>
      </header>

      {isLoading ? (
        <div role="status" aria-label="Loading" className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !luck ? (
        <p className="py-16 text-center text-neutral-400">
          <button type="button" className="cursor-pointer underline" onClick={() => setIsLoginDialogOpen(true)}>
            Log in
          </button>{' '}
          to see your luck.
        </p>
      ) : luck.expansions.length === 0 ? (
        <p className="py-16 text-center text-neutral-400">Nothing to go on yet: log some cards first.</p>
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-neutral-800 bg-gradient-to-br from-amber-300/10 via-transparent to-sky-400/10 p-5 sm:p-7">
            <p className="text-balance text-lg text-neutral-300 sm:text-2xl">
              Your ☆-and-rarer cards are worth about <span className={big}>{roundPacks(luck.worth)} packs</span>.
              {!luck.atLeast && (
                <>
                  {' '}
                  Your cards say you opened about <span className={big}>{roundPacks(luck.packs)}</span>.
                </>
              )}
            </p>
            {/* With a floor in the mix the two totals can't be compared, so luck gets its own like-for-like numbers */}
            {luck.judged.expansions === 0 ? (
              <p className={note}>
                You opened at least {roundPacks(luck.packs)} packs. Every expansion here is too complete to tell how many more, or how lucky they were.
              </p>
            ) : luck.atLeast ? (
              <>
                <p className={note}>
                  Where luck can be judged ({floors.length === 1 ? 'every expansion but one' : `${luck.judged.expansions} expansions`}), your rares are worth{' '}
                  {roundPacks(luck.judged.worth)} packs and you opened about {roundPacks(luck.judged.packs)}:{' '}
                  <span className="text-neutral-100">{luckWords(luck.judged.percentile)}</span> who opened as many.
                </p>
                <p className="mt-1.5 text-neutral-500 text-sm">
                  {floors.map((r) => t(r.expansion.name, { ns: 'common/sets' })).join(', ')}: at least {roundPacks(luck.packs - luck.judged.packs)} packs more,
                  too complete to judge.
                </p>
              </>
            ) : (
              <p className={note}>
                That's <span className="text-neutral-100">{luckWords(luck.judged.percentile)}</span> who opened as many packs.
              </p>
            )}
          </section>

          {luck.byRarity.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 font-medium text-neutral-300 text-sm">By rarity</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {luck.byRarity.map((r) => (
                  <li key={r.rarity} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4">
                    <p className="flex items-baseline gap-2">
                      <span className="text-base">{formatRarity(r.rarity)}</span>
                      <span className={`font-semibold text-xl tabular-nums ${tint(r.percentile)}`}>{r.owned}</span>
                      <span className="text-neutral-500 text-xs tabular-nums">typical {typicalCount(r.expected)}</span>
                    </p>
                    <div className="mt-3 mb-2">
                      <LuckDial percentile={r.percentile} />
                    </div>
                    <p className="text-neutral-400 text-xs">{luckWords(r.percentile)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="mb-2 font-medium text-neutral-300 text-sm">By expansion</h2>
          <ul className="flex flex-col gap-3">
            {luck.expansions.map((row) => (
              <Row key={row.expansion.id} row={row} />
            ))}
          </ul>

          <details className="mt-6 text-neutral-400 text-sm">
            <summary className="cursor-pointer text-neutral-300">How this works</summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>
                <span className="text-neutral-200">Packs opened</span> is an estimate from which ◊–◊◊◊◊ are in your card dex: each extra pack makes fewer new
                ones turn up, so the ones still missing say how far along you are, booster by booster. The range in brackets is where the true number probably
                is.
              </p>
              <p>
                <span className="text-neutral-200">Once every ◊–◊◊◊◊ is owned</span> they can't say how many more packs followed, so the next rarities count
                instead: ☆, then ☆☆ and ✵. A rarity that counted the packs isn't judged for luck in that expansion (it's greyed in its row), and the estimate
                gets rougher and tends to run about a tenth high.
              </p>
              <p>
                <span className="text-neutral-200">Worth</span> is how many packs a typical player needs to own as many ☆-and-rarer cards as you do, opening the
                same mix of boosters.
              </p>
              <p>
                <span className="text-neutral-200">It can't see how a card arrived.</span> Gifts from the alt add to the packs opened, so your luck reads worse
                than it was. Trades, Wonder Picks and pack points add rares, so it reads better. Deluxe and special packs are left out.
              </p>
            </div>
          </details>
        </>
      )}
    </main>
  )
}

export default Luck
