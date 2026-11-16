// Personal fork: the luck report (lib/luck.ts). One sentence up top: what the ☆-and-rarer cards are worth in packs
// against the packs the ◊–◊◊◊◊ say were opened. Then the same per expansion, with a dial for where the luck sits.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SetLogo } from '@/components/CardThumb'
import { Skeleton } from '@/components/Skeleton'
import { type ExpansionLuck, getLuck, luckWords, roundPacks } from '@/lib/luck'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useProfileCollection } from '@/services/profile/useProfileCollection'

const big = 'font-semibold text-neutral-50 tabular-nums'
const note = 'mt-3 text-pretty text-neutral-400 text-sm sm:text-base'

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
          <p className="text-neutral-500 text-xs">Every ◊–◊◊◊◊ owned, so the packs are a floor and luck can't be judged here.</p>
        ) : (
          <>
            <LuckDial percentile={row.percentile} />
            <p className="mt-1.5 text-neutral-400 text-xs">
              {luckWords(row.percentile)} · typical is {row.expected.toFixed(row.expected < 10 ? 1 : 0)} ☆+
            </p>
          </>
        )}
      </div>
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
                  Your ◊–◊◊◊◊ say you opened about <span className={big}>{roundPacks(luck.packs)}</span>.
                </>
              )}
            </p>
            {/* With a floor in the mix the two totals can't be compared, so luck gets its own like-for-like numbers */}
            {luck.judged.expansions === 0 ? (
              <p className={note}>
                You opened at least {roundPacks(luck.packs)} packs. Every expansion here has all its ◊–◊◊◊◊, so there's no telling how many more, or how lucky
                they were.
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
