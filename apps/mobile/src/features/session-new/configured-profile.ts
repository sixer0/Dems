/**
 * The profile a new session records with (fix wave Q, CT-08; D228 (3), as the web console).
 *
 * On a Core in its own capture New Session and Ready said "Recording Profile: Standard (1080p / 25 fps)" - the
 * label of the form's `profileId`, a choice of the simulator's model - one press away from the item the session
 * seals, which states "Sealed format (signed manifest) Camera 1: H264_720P30". What such a Core records with is
 * what its SELECTOR LINES IN FORCE say (`cameraLinesInForce`: the open session's snapshot, else the stored
 * selector), one part per track - the words of the web's "Configured profile". The `profileId` label is never
 * shown there. On a SIMULATED Core (and without a Core) the form's own label stays, as before.
 */
import { cameraLinesInForce, isOwnCaptureCoreState, useSim } from '@dems/shared/sim';

type LinesState = Parameters<typeof cameraLinesInForce>[0];

/** "VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30"; '' = no line states a profile ("Not reported"). A primitive. */
export function selectorProfileLinesOf(state: LinesState): string {
  const lines = cameraLinesInForce(state) as readonly { readonly trackId?: unknown; readonly profile?: unknown }[];
  return lines
    .filter((line): line is { readonly trackId: string; readonly profile: string } => typeof line.trackId === 'string' && typeof line.profile === 'string' && line.profile !== '' && line.profile.length <= 40)
    .slice()
    .sort((a, b) => a.trackId.localeCompare(b.trackId))
    .map((line) => `${line.trackId}: ${line.profile}`)
    .join(' · ');
}

export interface ConfiguredProfile {
  /** The Core states its own capture: the selector's lines are the profile, never the form's label. */
  readonly ownCapture: boolean;
  /** The lines in force, or '' (not reported). */
  readonly lines: string;
}

export function useConfiguredProfile(): ConfiguredProfile {
  const ownCapture = useSim((s) => isOwnCaptureCoreState(s));
  const lines = useSim((s) => selectorProfileLinesOf(s as unknown as LinesState));
  return { ownCapture, lines };
}
