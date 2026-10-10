/**
 * The words of the sealed player that wave K M1 added (G94b-01), mounted under
 * `features.evidence.player` (the `player` entry of `./i18n.ts`: `src/i18n/features.ts` keeps one
 * tree per feature folder, and the player lives in `features/evidence/`). The player's other words
 * are in the shared tree (`evidence.playback.*`, `evidence.media.*`).
 *
 * `noSeek` states what the PLAYER reported, nothing about the recording: the stream it was handed
 * holds no seek index, so a position cannot be chosen; Play and Pause are not affected.
 */
import type { ResourceTree } from '@/i18n/resources';

export const sealedPlayerEn = {
  noSeek: 'A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work.',
} as const satisfies ResourceTree;
