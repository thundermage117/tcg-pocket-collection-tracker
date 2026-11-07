// Personal fork: Main / Alt switch. The collection pages, scanner and import show and edit the active profile;
// the alt one is tinted amber, and AltBanner sits under the header on every page, so it's hard to edit the wrong account by accident.
import { cn } from '@/lib/utils'
import { type Profile, setActiveProfile, useActiveProfile } from '@/services/profile/useProfile'

const labels: Record<Profile, string> = { main: 'Main', alt: 'Alt' }

export function ProfileSwitch({ className }: { className?: string }) {
  const active = useActiveProfile()

  return (
    <fieldset aria-label="Collection" className={cn('flex rounded-full border border-neutral-700 p-0.5 text-xs font-medium', className)}>
      {(['main', 'alt'] as const).map((profile) => (
        <button
          key={profile}
          type="button"
          aria-pressed={active === profile}
          onClick={() => setActiveProfile(profile)}
          className={cn(
            'cursor-pointer rounded-full px-3 py-1 transition-colors',
            active !== profile && 'text-neutral-400 hover:text-neutral-200',
            active === profile && profile === 'main' && 'bg-neutral-700 text-white',
            active === profile && profile === 'alt' && 'bg-amber-500 text-neutral-950',
          )}
        >
          {labels[profile]}
        </button>
      ))}
    </fieldset>
  )
}

/** Shown under the header on every page while the alt is active: almost every card on the site can be edited. */
export function AltBanner() {
  const active = useActiveProfile()
  if (active !== 'alt') {
    return null
  }

  return (
    <div className="mx-auto mb-2 max-w-7xl px-4 md:px-6">
      <div role="status" className="flex items-center gap-3 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
        <span className="grow">
          Editing your <strong className="text-amber-400">Alt</strong> collection. Changes save to the alt account.
        </span>
        <button
          type="button"
          onClick={() => setActiveProfile('main')}
          className="shrink-0 cursor-pointer rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-amber-400"
        >
          Back to Main
        </button>
      </div>
    </div>
  )
}
