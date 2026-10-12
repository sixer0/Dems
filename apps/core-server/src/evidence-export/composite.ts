/**
 * THE COMPOSITE of an export: the side-by-side video made on demand (blueprint row 91 / M8-W2;
 * evidence package spec §G.3; OD-16; register NM-12; AU3-13).
 *
 * WHAT THIS FILE IS. The seam between the export job and a video encoder, and the licence gate in
 * front of it. The job calls `encode` with the two DECRYPTED camera files as streams and a file to
 * write; what comes back is hashed, put into the archive as `composite/composite.mp4`, marked
 * `derived` and recorded in the export manifest (`export-manifest.ts` refuses any other marking).
 *
 * THE LICENCE GATE (binding in the row text: "its encoder chosen ONLY after the M8 licence check
 * recorded in DOC-05"). The check is recorded in `THIRD_PARTY_NOTICES.md`, section "FFmpeg for the
 * on-demand composite: M8 licence check". Its conclusion:
 *
 *   - the FFmpeg program on this machine is a GPL build (`--enable-gpl --enable-version3`, with
 *     libx264 and libx265 linked in): distributing THAT build puts GPL-3.0-or-later obligations on
 *     the distributed program whichever encoder a command line then selects;
 *   - which FFmpeg build a distributed DEMS Core carries - none, that GPL build, or an LGPL-only
 *     build - is a decision of the product owner that the record cannot make.
 *
 * So NO ENCODER IS SELECTED HERE: `selectedCompositeEncoder()` answers null, the composition hands
 * that to the job, and a COMPOSITE export ends FAILED with `COMPOSITE_ENCODER_NOT_SELECTED` (an
 * audited `EVIDENCE_EXPORT_FAILED`, the answer the contract gives a failed job). Everything behind
 * the seam is built and tested with a stand-in encoder. State: `blocked: licence decision`.
 *
 * WHAT IS DECIDED ALREADY, whatever the owner chooses: an encoder that exists only in a GPL build
 * is refused by name (`COMPOSITE_ENCODER_REFUSED`), so wiring one in later cannot happen silently.
 */
import type { PackageVideoTrackId } from '@dems/shared/evidence-package';

/** One decrypted camera file, as a stream. The bytes exist in memory only, one piece at a time. */
export interface CompositeSource {
  readonly trackId: PackageVideoTrackId;
  /** The plaintext of the whole file, in order. May be read once. */
  read(): AsyncIterable<Uint8Array>;
}

export interface CompositeEncoder {
  /** What `export.composite.encoder` records (field 118), e.g. the encoder's name in its program. */
  readonly name: string;
  /**
   * Writes the side-by-side video of the two files to `outputFile` (it does not exist yet; it lies
   * inside the export folder). Rejects when it cannot; the job then removes what was written.
   */
  encode(sources: readonly [CompositeSource, CompositeSource], outputFile: string): Promise<void>;
}

/** Where the licence check is recorded (DOC-05). */
export const COMPOSITE_LICENCE_RECORD = 'THIRD_PARTY_NOTICES.md: FFmpeg for the on-demand composite: M8 licence check (2026-10-09)';

/** The state of the gate. It changes only with a recorded decision of the product owner. */
export const COMPOSITE_ENCODER_GATE = 'BLOCKED_LICENCE_DECISION' as const;

/**
 * Encoders that exist only in a GPL build of FFmpeg (the record's table): using one means the
 * distributed build is GPL. Refused by name until a recorded decision says the product ships so.
 */
export const GPL_ONLY_ENCODERS: readonly string[] = Object.freeze(['libx264', 'libx264rgb', 'libx265', 'libxvid', 'libxavs', 'libxavs2', 'libdavs2']);

const ENCODER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** True when an encoder of that name may be recorded and used: a plain name that is not GPL-only. */
export function compositeEncoderAllowed(name: string): boolean {
  return ENCODER_NAME.test(name) && !GPL_ONLY_ENCODERS.includes(name.toLowerCase());
}

/** The encoder of the product. Null while the licence decision is open: see the header. */
export function selectedCompositeEncoder(): CompositeEncoder | null {
  return null;
}

/**
 * WHAT THIS CORE CAN EXPORT, as operation 40 states it (`exportKinds`; fix wave J, truth rule 3d,
 * findings JA2-03 / JW-03). A PACKAGE always; a COMPOSITE only with a selected encoder - and while
 * none is selected the entry carries the code the export job itself fails with, so that a client
 * disables the choice with its reason and operation 42 refuses the request before any job.
 */
export function exportKindsOf(compositeAvailable: boolean): { kind: 'PACKAGE' | 'COMPOSITE'; available: boolean; reason?: string }[] {
  return [
    { kind: 'PACKAGE', available: true },
    compositeAvailable ? { kind: 'COMPOSITE', available: true } : { kind: 'COMPOSITE', available: false, reason: 'COMPOSITE_ENCODER_NOT_SELECTED' },
  ];
}
