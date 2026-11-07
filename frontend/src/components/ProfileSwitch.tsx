// Personal fork: Main / Alt switch. The collection pages, scanner and import show and edit the active profile;
// the alt one is tinted amber so it's hard to edit the wrong account by accident.
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
