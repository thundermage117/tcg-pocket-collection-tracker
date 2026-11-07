// Personal fork: a second (alt) game account tracked under the same login. Its rows live under the key
// `alt:<login email>` in the same tables (scripts/sql/personal-migrations/2026-11-alt-collection.sql), so the
// upstream collection code works for it unchanged; only the email it's given changes.
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { accountQuery } from '@/services/account/useAccount'
import { userQuery } from '@/services/auth/useAuth'
import { removeLocalCacheItems } from '@/services/collection/collectionService'

export type Profile = 'main' | 'alt'

// Session only: every new visit starts on main, so you can't come back days later still editing the alt.
const storageKey = 'tcg_active_profile'
const listeners = new Set<() => void>()

function readProfile(): Profile {
  try {
    localStorage.removeItem(storageKey) // older builds kept it here
    return sessionStorage.getItem(storageKey) === 'alt' ? 'alt' : 'main'
  } catch {
    return 'main'
  }
}

let active: Profile = readProfile()

export function setActiveProfile(profile: Profile) {
  active = profile
  try {
    sessionStorage.setItem(storageKey, profile)
  } catch {
    // private mode: the switch still works for this session
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The only pages that show and edit the alt. Everywhere else (planning, trading, Pokédex, decks, missions, card dialogs
// opened there) is main's, whatever the switch says: the alt doesn't trade with others and only matters as a source for main.
const profileRoutes = ['/collection', '/scan', '/import']

/** Whether `pathname` follows the Main / Alt switch. `/collection/<friend id>` doesn't: it's a friend's collection. */
export const isProfileRoute = (pathname: string) => profileRoutes.includes(pathname)

/** The profile picked in the switch, whatever the page. */
export function useSelectedProfile(): Profile {
  return useSyncExternalStore(subscribe, () => active)
}

/** The profile this page shows and edits: the switch's pick on the Collection, Scan and Import pages, main elsewhere. */
export function useActiveProfile(): Profile {
  const selected = useSelectedProfile()
  return isProfileRoute(useLocation().pathname) ? selected : 'main'
}

const countAltKey = 'tcg_count_alt'
let countAlt = (() => {
  try {
    return localStorage.getItem(countAltKey) === '1'
  } catch {
    return false
  }
})()

/** Whether Overview and Packs treat cards the alt can hand to main as owned. Off by default. */
export function useCountAlt() {
  return useSyncExternalStore(subscribe, () => countAlt)
}

export function setCountAlt(on: boolean) {
  countAlt = on
  try {
    localStorage.setItem(countAltKey, on ? '1' : '0')
  } catch {
    // session only
  }
  for (const listener of listeners) {
    listener()
  }
}

export const altEmail = (email: string) => `alt:${email}`

export function profileEmail(email: string | undefined, profile: Profile) {
  return email && profile === 'alt' ? altEmail(email) : email
}

/** The collection key for `profile`, or for the active profile when left out. */
export function useProfileEmail(profile?: Profile) {
  const activeProfile = useActiveProfile()
  const { data: user } = useQuery(userQuery)
  return profileEmail(user?.user.email, profile ?? activeProfile)
}

export function useProfileAccount(profile?: Profile) {
  return useQuery(accountQuery(useProfileEmail(profile)))
}

/** On logout: drop the alt's localStorage copy as well (useLogout only knows the login email) and go back to main. */
export function resetProfiles(email: string | undefined) {
  if (email) {
    removeLocalCacheItems(altEmail(email))
  }
  setActiveProfile('main')
}
