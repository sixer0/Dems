import { isUnsealableAlert, type SimState } from '@dems/shared/sim'

/**
 * The code of the cause of the session that ended UNSEALABLE, or null: the session did not end so.
 * Read from the alert of THAT session (`params.sessionId`), open or already acknowledged - the
 * dialog of an ended session states its end as long as the Core holds the alert (fix wave L,
 * G75d-04; `contract_wave_l.md` sections 1 and 3). '' = the alert names no cause code.
 */
export function selectUnsealableCause(sessionId: string | null): (state: SimState) => string | null {
  return (state) => {
    if (sessionId === null) return null
    const alert = state.alerts.find((entry) => isUnsealableAlert(entry) && (entry.params?.['sessionId'] === sessionId || entry.target === sessionId))
    if (alert === undefined) return null
    const cause = alert.params?.['cause']
    return typeof cause === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(cause) ? cause : ''
  }
}
