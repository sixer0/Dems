import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `transcription` feature, mounted at `features.transcription.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Blueprint row 118 (R-8; ux §8a, tablet and phone
 * columns): the read-only status of the speech-to-text configuration.
 *
 * Shared words come from `@dems/shared/i18n`: `common.status.enabled` / `disabled`,
 * `common.actions.retry` / `retryIn`, `common.states.notAvailable`. No throughput or speed wording
 * exists here or anywhere (D230). No word of this file names an endpoint, a credential value or a
 * reference: the tablet and the phone never receive them (ux §8a "Secrecy").
 */
export const transcriptionEn = {
  title: 'Transcription status',
  hint: 'Read-only on this device. Change the transcription settings from the web console.',
  card: {
    title: 'Speech-to-text',
    description: 'How the next session turns speech into text.',
  },
  rows: {
    enabled: 'Transcription',
    backend: 'Backend',
    model: 'Model',
    labelling: 'Speaker labelling',
    credential: 'Credential',
    lastTest: 'Last connection test',
  },
  labelling: {
    on: 'On',
    off: 'Off',
  },
  backend: {
    'omlx-server': 'oMLX server',
    'cpu-local': 'Local CPU',
  },
  credential: {
    set: 'Set',
    notSet: 'Not set',
  },
  test: {
    never: 'Not tested yet',
    ready: 'Reachable, model available',
    modelMissing: 'Reachable, model not available',
    unreachable: 'Not reachable',
    at: '{{time}}',
  },
  pending: {
    title: 'Changed — applies to the next session',
    body: 'The session that is open keeps the settings it started with.',
  },
  stale: 'The latest status could not be read. The values shown may be out of date.',
  signedOut: 'Sign in to see the transcription status.',
  error: {
    title: 'The transcription status could not be read',
    body: 'Check the Core link and try again. Recording is not affected.',
    maxRetries: 'Too many tries. Close and reopen the app to try again.',
  },
} as const satisfies ResourceTree;
