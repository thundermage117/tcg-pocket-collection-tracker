// Personal fork: the luck report (lib/luck.ts). Up top, luck in packs: where the pulled cards put you against the
// packs the cards say were opened, checked against the cards nobody can trade you, with traded-for rarities named and
// set aside. Then each rarity, rarest first, and the expansions with something to say.
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SetLogo } from '@/components/CardThumb'
import { Skeleton } from '@/components/Skeleton'
import { formatRarity } from '@/components/utils'
import {
  type ExpansionLuck,
  evidenceNames,
  getLuck,
  type LuckReport,
  luckInWords,
  luckWords,
  type RarityKind,
  type RarityTotal,
  rareRarities,
  roundPacks,
  typicalCount,
} from '@/lib/luck'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Rarity } from '@/types'

const big = 'font-semibold text-neutral-50 tabular-nums'
const note = 'mt-3 text-pretty text-neutral-400 text-sm sm:text-base'

// outside the middle 30–70%, a rarity or expansion is tinted as lucky or unlucky
const tint = (percentile: number) => (percentile >= 0.7 ? 'text-amber-300' : percentile <= 0.3 ? 'text-sky-400' : 'text-neutral-300')
// words that say "typical" stay neutral even when the percentile leans a little
const wordsTint = (words: string, percentile: number) => (words === 'right on par' || words.startsWith('about what') ? 'text-neutral-100' : tint(percentile))

// formatRarity gives an element for the star rarities, so the list is built as elements rather than joined text
const rarityList = (rarities: Rarity[]) =>
  rarities.map((r, i) => (
    <Fragment key={r}>
      {i > 0 && ', '}
      {formatRarity(r)}
    </Fragment>
  ))
const kindLabel: Record<RarityKind, string> = { untradable: "can't be traded", pulls: 'tradable', traded: 'traded for' }

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

function Headline({ luck }: { luck: LuckReport }) {
  const { t } = useTranslation(['common/sets'])
  const { pulls, untradable } = luck
  const floors = luck.expansions.filter((r) => r.atLeast)
  const opened = (
    <>
      about <span className={big}>{roundPacks(luck.packs)}</span>
      {!luck.atLeast && (
        <span className="text-neutral-500 text-base">
          {' '}
          ({roundPacks(luck.low)}–{roundPacks(luck.high)})
        </span>
      )}
    </>
  )

  return (
    <section className="mb-6 rounded-xl border border-neutral-800 bg-gradient-to-br from-amber-300/10 via-transparent to-sky-400/10 p-5 sm:p-7">
      {!pulls ? (
        <>
          <p className="text-balance text-lg text-neutral-300 sm:text-2xl">
            {luck.atLeast ? 'You opened at least' : 'You opened'} {opened} packs.
          </p>
          {luck.judgedExpansions === 0 && <p className={note}>Every expansion here is too complete to tell how many more, or how lucky they were.</p>}
        </>
      ) : (
        <>
          <p className="text-balance text-lg text-neutral-300 sm:text-2xl">
            {luck.atLeast && luck.judgedExpansions < luck.expansions.length ? 'Where luck can be read, you' : 'You'} opened{' '}
            {luck.atLeast ? <span className={big}>about {roundPacks(pulls.packs)}</span> : opened} packs, and your pulls{' '}
            {pulls.expected < 10 ? (
              <>
                are <span className={big}>{pulls.owned}</span> where {typicalCount(pulls.expected)} is typical:{' '}
              </>
            ) : (
              <>
                are where a typical player is at <span className={big}>{roundPacks(pulls.worth)}</span>:{' '}
              </>
            )}
            <span className={`font-semibold ${wordsTint(luckInWords(pulls), pulls.percentile)}`}>{luckInWords(pulls)}</span>.
          </p>
          <p className={note}>
            That's {luckWords(pulls.percentile)} who opened as many, on {rarityList(pulls.rarities)}.
          </p>
          {untradable && (
            <p className="mt-1.5 text-pretty text-neutral-400 text-sm sm:text-base">
              The cards nobody can trade you ({rarityList(untradable.rarities)}) alone: {untradable.owned} against {typicalCount(untradable.expected)} typical,{' '}
              <span className={wordsTint(luckInWords(untradable), untradable.percentile)}>{luckInWords(untradable)}</span>.
            </p>
          )}
        </>
      )}
      {luck.byRarity
        .filter((r) => r.kind === 'traded')
        .map((r) => (
          <p key={r.rarity} className="mt-1.5 text-pretty text-neutral-500 text-sm">
            {formatRarity(r.rarity)} looks traded for: {r.owned} owned where your packs give about {typicalCount(r.expected)}, so roughly{' '}
            {Math.max(0, Math.round(r.owned - r.expected))} came another way. It's left out of the luck.
          </p>
        ))}
      {luck.rarerDiamonds.some((r) => r.owned - r.expected >= 5) && (
        <p className="mt-1.5 text-pretty text-neutral-500 text-sm">
          Packs are counted from ◊ and ◊◊ only. Your{' '}
          {luck.rarerDiamonds.map((r, i) => (
            <Fragment key={r.rarity}>
              {i > 0 && ' and '}
              {r.rarity} ({r.owned} where packs give about {typicalCount(r.expected)})
            </Fragment>
          ))}{' '}
          run ahead of them, as alt gifts, trades and pack points fill those in.
        </p>
      )}
      {floors.length > 0 && pulls && (
        <p className="mt-1.5 text-neutral-500 text-sm">
          {floors.map((r) => t(r.expansion.name, { ns: 'common/sets' })).join(', ')}: at least {roundPacks(luck.packs - pulls.packs)} packs more, too complete
          to judge.
        </p>
      )}
    </section>
  )
}

function RarityCard({ r }: { r: RarityTotal }) {
  const traded = r.kind === 'traded'
  return (
    <li className={`rounded-xl border border-neutral-800 p-3 sm:p-4 ${traded ? 'bg-neutral-900/30' : 'bg-neutral-900/60'}`}>
      <p className="flex items-baseline gap-2">
        <span className="text-base">{formatRarity(r.rarity)}</span>
        <span className={`font-semibold text-xl tabular-nums ${traded ? 'text-neutral-400' : tint(r.percentile)}`}>{r.owned}</span>
        <span className="text-neutral-500 text-xs tabular-nums">
          {traded ? 'packs give' : 'typical'} {typicalCount(r.expected)}
        </span>
        <span className="ml-auto text-neutral-500 text-xs">{kindLabel[r.kind]}</span>
      </p>
      {traded ? (
        <p className="mt-3 text-neutral-500 text-xs">
          About {Math.max(0, Math.round(r.owned - r.expected))} more than packs give. Not judged: trades and luck can't be told apart in one count.
        </p>
      ) : (
        <>
          <p className={`mt-2 font-medium text-sm ${wordsTint(luckInWords(r), r.percentile)}`}>{luckInWords(r)}</p>
          <div className="mt-2 mb-2">
            <LuckDial percentile={r.percentile} />
          </div>
          <p className="text-neutral-400 text-xs">
            {luckWords(r.percentile)}
            <span className="text-neutral-500">
              {' '}
              · {r.expansions} {r.expansions === 1 ? 'expansion' : 'expansions'}
            </span>
          </p>
        </>
      )}
    </li>
  )
}

function Row({ row }: { row: ExpansionLuck }) {
  const { t } = useTranslation(['common/sets'])
  const opened = row.atLeast ? `at least ${roundPacks(row.packs)}` : `about ${roundPacks(row.packs)}`
  const judged = !row.atLeast && row.judged.total > 0
  const words = luckInWords({ owned: row.judged.owned, expected: row.judged.expected, worth: row.judgedWorth, packs: row.packs })
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
          {judged && (
            <>
              {' · '}
              <span className={wordsTint(words, row.judged.percentile)}>{words}</span>
            </>
          )}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1">
        {row.atLeast ? (
          <p className="text-neutral-500 text-xs">Every {evidenceNames[row.evidenceLevel]} owned, so the packs are a floor and luck can't be judged here.</p>
        ) : judged ? (
          <>
            <LuckDial percentile={row.judged.percentile} />
            <p className="mt-1.5 text-neutral-400 text-xs">{luckWords(row.judged.percentile)}</p>
          </>
        ) : null}
      </div>
      {/* each rarity against its typical count; the ones that counted the packs or were traded for are greyed */}
      <ul className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:col-span-3">
        {row.byRarity
          .filter((r) => rareRarities.includes(r.rarity as Rarity))
          .map((r) => {
            const shown = r.judged && !row.atLeast
            return (
              <li
                key={r.rarity}
                className={shown ? 'text-neutral-400' : 'text-neutral-600'}
                title={
                  r.setAside
                    ? `${r.owned} of ${r.total} owned · traded for, so not judged`
                    : shown
                      ? `${r.owned} of ${r.total} owned · ${luckWords(r.percentile)}`
                      : `${r.owned} of ${r.total} owned · used to count the packs here, so not judged`
                }
              >
                <span className={shown ? undefined : 'opacity-50'}>{formatRarity(r.rarity as Rarity)}</span>{' '}
                <span className={`font-medium tabular-nums ${shown ? tint(r.percentile) : ''}`}>{r.owned}</span>
                {shown && <span className="tabular-nums"> · typical {typicalCount(r.expected)}</span>}
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
  // the newest expansion always shows (it's the one being opened); the rest only when they have something to say
  const [newest, ...older] = luck?.expansions ?? []
  const clear = older.filter((r) => r.clear)
  const quiet = older.filter((r) => !r.clear)

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
      ) : !newest ? (
        <p className="py-16 text-center text-neutral-400">Nothing to go on yet: log some cards first.</p>
      ) : (
        <>
          <Headline luck={luck} />

          {luck.byRarity.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 font-medium text-neutral-300 text-sm">By rarity, rarest first</h2>
              <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
                {luck.byRarity.map((r) => (
                  <RarityCard key={r.rarity} r={r} />
                ))}
              </ul>
            </section>
          )}

          <h2 className="mb-2 font-medium text-neutral-300 text-sm">By expansion</h2>
          <ul className="flex flex-col gap-3">
            <Row row={newest} />
            {clear.map((row) => (
              <Row key={row.expansion.id} row={row} />
            ))}
          </ul>
          {quiet.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-neutral-400 text-sm">
                {quiet.length} more {quiet.length === 1 ? 'expansion' : 'expansions'} with nothing unusual, or too complete to judge
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {quiet.map((row) => (
                  <Row key={row.expansion.id} row={row} />
                ))}
              </ul>
            </details>
          )}

          <details className="mt-6 text-neutral-400 text-sm">
            <summary className="cursor-pointer text-neutral-300">How this works</summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>
                <span className="text-neutral-200">Packs opened</span> is an estimate from which ◊ and ◊◊ are in your card dex: each extra pack makes fewer new
                ones turn up, so the ones still missing say how far along you are, booster by booster. The range in brackets is where the true number probably
                is. ◊◊◊ and ◊◊◊◊ are left out: the last few missing are what the estimate leans on most, and those are the ones gifts, trades and pack points
                fill in. Once every ◊ and ◊◊ is owned, the next rarities count instead (☆, then ☆☆ and ✵), and they aren't judged in that expansion.
              </p>
              <p>
                <span className="text-neutral-200">Ahead or behind</span>: how many packs a typical player needs to own as many of your pulled cards, against
                the packs you opened. Where fewer than 10 are typical (Crowns, say), one card would swing that by hundreds of packs, so it's told as odds
                instead: how many players have as few, or as many. The percentile under it is the share of players with as many packs who'd own fewer.
              </p>
              <p>
                <span className="text-neutral-200">It can't see how a card arrived</span>, so it goes by what each rarity's count can say. ☆☆☆ and Crown can't
                be traded, so their gap is pure luck. A tradable rarity that's far ahead of the pack odds in most expansions looks traded for: it's set aside,
                and only its gap is shown, since trades and luck add up to one count. The other tradable rarities count as pulls.
              </p>
              <p>
                Gifts from the alt add ◊–◊◊◊◊, which raises the packs estimate and makes luck read a little worse. Wonder Picks and pack points add rares, which
                makes it read better. Deluxe and special packs are left out.
              </p>
            </div>
          </details>
        </>
      )}
    </main>
  )
}

export default Luck
