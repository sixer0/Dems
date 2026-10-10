/**
 * THE ADMISSION OF A DEVELOPMENT DISCOVERY SOURCE (fix wave H, driver D; gate 70 finding B-1;
 * decision D196; test strategy CR-5; SEC35-27 (6), SEC35-41 (a)).
 *
 * A development discovery source is a camera search that never reaches a network: the fake ONVIF
 * device of the test support, on loopback, in the place of the WS-Discovery group. It is handed
 * to a Core by ONE program, the lane launcher of the test support
 * (`test/support/lane-camera-stub-cli.ts`, started by `scripts/lane/lane.sh start <lane>
 * --with-camera-stub`). No file under `src/` names that program, the stub or its loopback target
 * (static rules CPB1-12, G-R9): the product's entry point cannot load any of them, with or
 * without a flag.
 *
 * THIS FILE IS THE FENCE'S HALF: the launcher asks it before it starts anything, and does what it
 * answers. The decision reads the ONE decision of the capture operation (`operation.ts`); it reads
 * no flag, no file and no environment itself.
 *
 *   capture operation     the launcher asked for the source     answer
 *   REAL_DEVELOPMENT      yes                                   ADMITTED
 *   REAL_PRODUCTION       yes                                   REFUSED - `DevelopmentDiscoveryError`,
 *                                                               code DEV_CAMERA_STUB_IN_PRODUCTION:
 *                                                               the launcher does not start the Core
 *   SIMULATED             yes                                   IGNORED (`SIMULATED_HAS_NO_SEARCH`):
 *                                                               the Core starts without the source
 *                                                               and the launcher says so
 *   a refused flag set    yes                                   IGNORED (`CAPTURE_FENCE_REFUSES_BOOT`):
 *                                                               the boot fence stops the start itself
 *   any                   no                                    IGNORED (`NOT_REQUESTED`)
 *
 * Why SIMULATED ignores instead of refusing: a simulated Core has no camera search at all
 * (operation 93 answers `503 DISCOVERY_NOT_READY`) and states no source class on any operation
 * (decision D196, G70-01); a stub candidate there would be listed as `FAKE` / `DEVELOPMENT`.
 *
 * Pure: a decision in, an answer out.
 */
import { CaptureOperation } from '../adapters/kinds';
import type { CaptureOperationDecision } from './operation';

/** The one refusal of a development discovery source. Stable; it appears in the launcher's final log line. */
export const DEV_CAMERA_STUB_IN_PRODUCTION = 'DEV_CAMERA_STUB_IN_PRODUCTION';

/** Why a requested source is not handed to the Core although the start goes on. */
export const DevelopmentDiscoveryIgnored = {
  NOT_REQUESTED: 'NOT_REQUESTED',
  SIMULATED_HAS_NO_SEARCH: 'SIMULATED_HAS_NO_SEARCH',
  CAPTURE_FENCE_REFUSES_BOOT: 'CAPTURE_FENCE_REFUSES_BOOT',
} as const;
export type DevelopmentDiscoveryIgnored = (typeof DevelopmentDiscoveryIgnored)[keyof typeof DevelopmentDiscoveryIgnored];

export type DevelopmentDiscoveryAdmission =
  | { readonly admitted: true; readonly operation: typeof CaptureOperation.REAL_DEVELOPMENT }
  | { readonly admitted: false; readonly operation: CaptureOperation; readonly ignored: DevelopmentDiscoveryIgnored };

/** A production configuration that was asked to take a development discovery source. The message names keys and codes only. */
export class DevelopmentDiscoveryError extends Error {
  readonly code = DEV_CAMERA_STUB_IN_PRODUCTION;
  constructor() {
    super(
      'The camera stub is refused: this configuration is REAL_PRODUCTION (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES=1). ' +
        'A production Core never searches a development source. Start the lane without --with-camera-stub, or start a development lane.',
    );
    this.name = 'DevelopmentDiscoveryError';
  }
}

/** THE decision. Throws `DevelopmentDiscoveryError` for a production configuration; see the table in the header. */
export function developmentDiscoveryAdmissionOf(decision: CaptureOperationDecision, requested: boolean): DevelopmentDiscoveryAdmission {
  const ignored = (reason: DevelopmentDiscoveryIgnored): DevelopmentDiscoveryAdmission => Object.freeze({ admitted: false, operation: decision.operation, ignored: reason });
  // Anything but the literal `true` is "not asked for".
  if (requested !== true) return ignored(DevelopmentDiscoveryIgnored.NOT_REQUESTED);
  // A refused flag combination answers SIMULATED and is stopped by the boot fence: nothing is handed in.
  if (decision.refusal !== null) return ignored(DevelopmentDiscoveryIgnored.CAPTURE_FENCE_REFUSES_BOOT);
  if (decision.operation === CaptureOperation.REAL_PRODUCTION) throw new DevelopmentDiscoveryError();
  if (decision.operation === CaptureOperation.REAL_DEVELOPMENT) return Object.freeze({ admitted: true, operation: CaptureOperation.REAL_DEVELOPMENT });
  return ignored(DevelopmentDiscoveryIgnored.SIMULATED_HAS_NO_SEARCH);
}
