/**
 * THE WEB CONSOLE'S READING OF A SEAL THAT IS BLOCKED OR RETRIED (fix wave I, driver B; finding
 * G75b-02; contract note `delegation_progress/contract_wave_i.md`). One reader for the seal dialog,
 * the Monitor banner and the Dashboard row: the shared `sealAttentionOf` - no member of the state is
 * read by name here. Null: the seal runs, has not started, or the session is not the open one.
 */
import { SEAL_RECORDING_KEPT_SENTENCE, sealAttentionOf, useSim, type SealAttention, type SimState } from '@dems/shared/sim'

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
