import { useState } from 'react'
import type { AuditRow } from '@dems/shared/sim'

/**
 * The ID of the newest list item when it arrived after mount (for the M-C-07 highlight), derived
 * during render: the first ID seen at mount never highlights.
 */
export function useNewestArrival(newestId: string | null): string | null {
  const [state, setState] = useState<{ baseline: string | null; latest: string | null }>({ baseline: newestId, latest: null })
  if (newestId !== null && newestId !== state.baseline && newestId !== state.latest) {
    setState({ baseline: state.baseline, latest: newestId })
    return newestId
  }
  return state.latest
}

/**
 * The same array as last render while its rows are the same objects in the same order, so a lens
 * whose rows did not change skips re-rendering its feed when an unrelated audit entry arrives.
 */
export function useStableRows(rows: AuditRow[]): AuditRow[] {
  const [kept, setKept] = useState(rows)
  const same = kept.length === rows.length && kept.every((row, index) => row === rows[index])
  if (!same) {
    setKept(rows)
    return rows
  }
  return kept
}
