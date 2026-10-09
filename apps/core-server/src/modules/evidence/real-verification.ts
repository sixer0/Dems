/**
 * The seam of operation 41 to the verification of a REAL sealed package (blueprint row 85, M7-W4;
 * C3 §3 operation 41; evidence package spec §D).
 *
 * This module answers operation 41 and does no verification itself: it reads no file and no key
 * and writes no row (its static rules 2, 4, 6 and 7 stay as they are). An item whose package is
 * a real `dems.evidence-manifest/2` folder on the media store is verified by another unit
 * (`src/evidence-verify`), handed in here once per app:
 *
 *     evidenceVerification(app).provide(verification)
 *
 * THE DISPATCH. The route asks the provided verification first. It answers `null` for an item
 * that is not its own - every item of today: the 13 dataset items and the 14 v1 demo packages -
 * and such an item is verified by the hosted action `verify` exactly as before this row. While no
 * verification is provided (every app of today: nothing provides one yet), the route does not
 * ask at all.
 *
 * WHAT THE PROVIDED VERIFICATION OWES. For an item of its own it resolves with the verdict of
 * record in the contract's shape ONLY after that verdict was recorded - the audit row
 * EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED and the custody entry - or it rejects: a verdict that
 * was not recorded never leaves the server. It is handed the principal whole and decides nothing
 * about access (stage 6 has decided before the handler runs).
 */
import type { EvidenceVerifyResultBody } from '@dems/shared/api';
import type { FastifyRequest } from 'fastify';

export interface RealEvidenceVerification {
  /** The recorded verdict of a real v2 item, or null when the item is not one. */
  verify(principal: FastifyRequest['principal'], evidenceId: string): Promise<EvidenceVerifyResultBody | null>;
}

export interface EvidenceVerificationControl {
  /** Hands in the verification of real packages. Once per app. */
  provide(verification: RealEvidenceVerification): void;
  /** What was provided, or null. */
  current(): RealEvidenceVerification | null;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, EvidenceVerificationControl>();

/** The control of an app. It exists from the first call: providing does not wait for the module to load. */
export function evidenceVerification(app: { readonly stages: object }): EvidenceVerificationControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let provided: RealEvidenceVerification | null = null;
  const control: EvidenceVerificationControl = {
    provide(verification) {
      if (provided !== null) throw new Error('the verification of real evidence packages was provided twice');
      provided = verification;
    },
    current: () => provided,
  };
  controls.set(app.stages, control);
  return control;
}
