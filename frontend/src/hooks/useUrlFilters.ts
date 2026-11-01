// Personal fork: page filters kept in the URL (?set=B1&q=…) like the rankings page, so refresh, back and links keep
// the view. Changes replace the history entry rather than pushing one per keystroke. A missing key means the
// page's default, so pages pass `undefined` for a default value.
// Keys in `remember` are also saved to localStorage and used when the URL leaves them out, so a page opened from
// the nav comes back the way you left it.
import { useSearchParams } from 'react-router'

type Changes = Record<string, string | undefined>

function loadSaved(storageKey: string): Record<string, unknown> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}

export function useUrlFilters(storageKey: string, remember: readonly string[] = []) {
  const [params, setParams] = useSearchParams()

  const get = (key: string): string | undefined => {
    const value = params.get(key) ?? (remember.includes(key) ? loadSaved(storageKey)[key] : undefined)
    return typeof value === 'string' ? value : undefined
  }

  const update = (changes: Changes) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        }
        return next
      },
      { replace: true },
    )

    const remembered = Object.keys(changes).filter((key) => remember.includes(key))
    if (remembered.length > 0) {
      const saved = loadSaved(storageKey)
      for (const key of remembered) {
        if (changes[key]) {
          saved[key] = changes[key]
        } else {
          delete saved[key]
        }
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved))
      } catch {
        // storage unavailable: the URL still holds the choice for this visit
      }
    }
  }

  return { get, update }
}
