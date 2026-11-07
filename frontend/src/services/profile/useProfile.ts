// Personal fork: a second (alt) game account tracked under the same login. Its rows live under the key
// `alt:<login email>` in the same tables (scripts/sql/personal-migrations/2026-11-alt-collection.sql), so the
// upstream collection code works for it unchanged; only the email it's given changes.
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { accountQuery } from '@/services/account/useAccount'
import { userQuery } from '@/services/auth/useAuth'
import { removeLocalCacheItems } from '@/services/collection/collectionService'

export type Profile = 'main' | 'alt'

const storageKey = 'tcg_active_profile'
const listeners = new Set<() => void>()

function readProfile(): Profile {
  try {
    return localStorage.getItem(storageKey) === 'alt' ? 'alt' : 'main'
  } catch {
    return 'main'
  }
}

let active: Profile = readProfile()

export function setActiveProfile(profile: Profile) {
  active = profile
  try {
    localStorage.setItem(storageKey, profile)
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

/** The profile the collection pages show and edit. */
export function useActiveProfile(): Profile {
  return useSyncExternalStore(subscribe, () => active)
}

const countAltKey = 'tcg_count_alt'
let countAlt = (() => {
  try {
    return localStorage.getItem(countAltKey) !== '0'
  } catch {
    return true
  }
})()

/** Whether Overview and Packs treat cards the alt can hand to main as owned. On by default. */
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
