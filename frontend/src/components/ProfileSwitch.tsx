// Personal fork: Main / Alt switch. Only the Collection, Scan and Import pages follow it (isProfileRoute), so ProfileBar
// sits under the header on those pages only, tinted amber while the alt is picked so it's hard to edit the wrong account.
import { useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { isProfileRoute, type Profile, setActiveProfile, useSelectedProfile } from '@/services/profile/useProfile'

const labels: Record<Profile, string> = { main: 'Main', alt: 'Alt' }

export function ProfileSwitch({ className }: { className?: string }) {
  const active = useSelectedProfile()

  return (
    <fieldset aria-label="Collection" className={cn('flex shrink-0 rounded-full border border-neutral-700 p-0.5 text-xs font-medium', className)}>
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

/** Under the header on the pages that follow the switch: the switch, and while the alt is picked, a warning around it. */
export function ProfileBar() {
  const { pathname } = useLocation()
  const active = useSelectedProfile()
  if (!isProfileRoute(pathname)) {
    return null
  }

  return (
    <div className="mx-auto mb-2 max-w-7xl px-4 md:px-6">
      <div
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
          active === 'alt' ? 'border-amber-500/60 bg-amber-500/10 text-amber-100' : 'border-transparent text-neutral-400',
        )}
      >
        <ProfileSwitch />
        {active === 'alt' ? (
          <span>
            Editing your <strong className="text-amber-400">Alt</strong> collection. Changes save to the alt account.
          </span>
        ) : (
          <span>Editing your main collection.</span>
        )}
      </div>
    </div>
  )
}
