import { useState } from 'react'

/**
 * IDs that appeared after the first render (M-C-07: only rows that arrive while the page is open get
 * the entry slide and the gold highlight; rows present at mount arrive with their panel). The set
 * holds the latest batch, so the highlight belongs to the newest insertion only (R9).
 */
export function useNewRowIds(ids: readonly string[]): ReadonlySet<string> {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(ids))
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const unseen = ids.filter((id) => !seen.has(id))
  if (unseen.length === 0) return fresh
  // Derived during render (no effect): remember the new IDs and mark them as the fresh batch.
  const nextSeen = new Set(seen)
  for (const id of unseen) nextSeen.add(id)
  const nextFresh = new Set(unseen)
  setSeen(nextSeen)
  setFresh(nextFresh)
  return nextFresh
}
