/**
 * The Paired Devices page's own log reporter (plan row W81; row W0's one helper, decision D165).
 * Bound once here with the prefix `pair`; the page calls it only for the branch the refusal
 * presenter left to it (rule 2 of the page rows).
 *
 * **Never pass a pairing code here** — not in `message`, not in `context` (rule 4; finding
 * CPW1-12: the sink's redactor knows `ses_`, `dvc_`, `bio_` and nothing else). The messages are the
 * fixed sentences below; `context` carries an operation ID, a code ID (`PCD-…`, which names a code
 * without being one), a device ID, an error code and lengths, never a typed reason or an answer.
 */
import { createPageReporter } from '@/lib/page-report'

const page = createPageReporter('pair')

export const reportPairingError = page.report
export const newPairingCorrelationId = page.newCorrelationId

/** The fixed sentences of the page's records. */
export const PAIRING_RECORD = {
  statusRead: 'The status of the pairing code could not be read.',
  registryRead: 'The device registry could not be read.',
  issue: 'The pairing code could not be issued.',
  cancel: 'The pairing code could not be cancelled.',
  revoke: 'The device could not be revoked.',
  panel: 'A panel of the Paired Devices page failed to render.',
} as const
