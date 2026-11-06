/**
 * THE WEB CONSOLE'S READING OF A SEAL THAT IS BLOCKED OR RETRIED (fix wave I, driver B; finding
 * G75b-02; contract note `delegation_progress/contract_wave_i.md`). One reader for the seal dialog,
 * the Monitor banner and the Dashboard row: the shared `sealAttentionOf` - no member of the state is
 * read by name here. Null: the seal runs, has not started, or the session is not the open one.
 */
import { SessionState } from '@dems/shared/domain'
import { SEAL_RECORDING_KEPT_SENTENCE, sealAttentionOf, useSim, type SealAttention, type SimState } from '@dems/shared/sim'
import { isOwnCapture } from './own-capture'

export function selectSealAttention(state: SimState, sessionId: string | null): SealAttention | null {
  if (sessionId === null || state.session?.id !== sessionId) return null
  return sealAttentionOf({ session: state.session, alerts: state.alerts })
}

/** `sealAttentionOf` for the session a surface follows. A flat object of primitives: stable under `useSim`. */
export function useSealAttention(sessionId: string | null): SealAttention | null {
  return useSim((state) => selectSealAttention(state, sessionId))
}

/** The same for the open session, whatever its id (banner, Dashboard row). */
export function useOpenSealAttention(): SealAttention | null {
  return useSim((state) => selectSealAttention(state, state.session?.id ?? null))
}

/** One line for a banner or a row: the Core's sentence and that the recording is kept. */
export function sealAttentionLine(attention: SealAttention, fallback: string): string {
  const sentence = attention.kind === 'BLOCKED' ? attention.sentence : (attention.sentence ?? fallback)
  return `${sentence} ${SEAL_RECORDING_KEPT_SENTENCE}`
}

/**
 * Fix wave M (G75e-06 (b)): the blocked dialog stated its cause four times - the sentence of the failed
 * step, the sentence of the detail code and the alert's message all begin with it. The alert's message
 * is the whole statement (the cause, what restores the seal, what it costs meanwhile), so the other two
 * are drawn only when they say something the message does not: a sentence whose leading clause (up to
 * its first colon or full stop) the message already holds is not drawn again.
 */
export function saidAlready(message: string, sentence: string): boolean {
  const clause = sentence.split(/[:.]/, 1)[0]?.trim() ?? ''
  return clause === '' || message.includes(clause)
}

/**
 * Fix wave M (G75e-06 (a), ruling D234 (3)): THE CORE IS RUNNING A SEAL AGAIN BY ITSELF - the id of that
 * session, or null. What the header pill and the Dashboard ring say instead of "SECURE".
 *
 * | The state | Reading |
 * |---|---|
 * | `sealAttentionOf`: RETRYING (a step failed, the next run is waited for) | retried |
 * | the session is FINALIZING, of the Core's own capture (`isOwnCapture`), and a step states `attempt > 1` | retried: the retry RUN itself. Between "in 5 s" and its end the failed step reads `active` again - seen live as "SECURE" for the length of each run |
 * | `sealAttentionOf`: BLOCKED | not this state: the retries are used up (the pill is CRITICAL by the alert) |
 * | the simulator's session at `attempt > 1` | not this state: there the attempt grows on a recovery alone (the rule of "Resumed after restart") |
 */
export function sealRetryingSessionOf(state: Pick<SimState, 'session' | 'alerts'>): string | null {
  const session = state.session
  if (session === null) return null
  const attention = sealAttentionOf({ session, alerts: state.alerts })
  if (attention !== null) return attention.kind === 'RETRYING' ? session.id : null
  if (session.state !== SessionState.FINALIZING || !isOwnCapture(session)) return null
  return session.finalization.steps.some((step) => (step.attempt ?? 1) > 1) ? session.id : null
}
