/**
 * THE BUILD STAMP OF THE CAPTURE WORKER, AS THE CORE READS IT AT BOOT (audit 2026-11-05 row 88, C-P0-1b, defect DF-02;
 * rulings D15(b), D25 N5, D29 Q7, D38 DR-6; names and format verbatim from masterplan/01_specs_w1_register.md W6-W10).
 *
 * Why. On 2026-11-05 a worker binary built before the 4+4 plan change was still installed and said the same version
 * word and protocol as the new one (`capture-worker/0.6.0`, protocol 5): the boot gate compared only those two words
 * (`checks.ts`, `workerVersionRefusalOf`) and passed it. The worker build now writes `<program>.stamp` beside the
 * program (`apps/capture-worker/stamp.sh`, row 87). A production boot reads that stamp and refuses a program whose
 * stamp is missing or unreadable, names another version or protocol than this Core drives, or names another program
 * file than the one in place (`CAPTURE_WORKER_BUILD_STAMP_STALE`, check 5b of `checks.ts`). The stamp travels OUTSIDE
 * the handshake on purpose: the capture protocol stays 5 (D29 Q7).
 *
 * THE FORMAT (W8): ASCII, LF line ends, exactly four `key=value` lines in this order:
 *   workerVersion=capture-worker/N.N.N
 *   protocolVersion=N
 *   sourceSha256=<64 lowercase hex>   (the build's source set; recorded, not recomputed here: the Core has no sources)
 *   binarySha256=<64 lowercase hex>   (the sha256 of the program file; compared with the program in place)
 *
 * The file system is read through the one door of the local helpers (`adapters/local/process-door.ts`; static rule
 * G-R2): the path rule of the program (`helperProgramRefusal`) is applied to the stamp FIRST, then its first bytes
 * are read (`readFileHead`), and the program is read whole (`readWholeFile`, bounded) only when the stamp's words
 * already agree. A reason is one of the fixed words of `WorkerBuildStampProblem` - never a path, a byte of the stamp
 * or a hash.
 */
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { sha256Hex } from '@dems/shared/evidence-package';
import { FILE_WHOLE_MAX_BYTES, HelperProgramRefusal, helperProgramRefusal, inspectProgram, readFileHead, readWholeFile, type FileHeadReader, type ProgramInspector, type WholeFileReader } from '../adapters/local';
import { CAPTURE_WORKER_VERSION } from './checks';

/** W7: the stamp lies at `<program><suffix>`, where `<program>` is the path in `DEMS_CAPTURE_WORKER`. No key of its own. */
export const CAPTURE_WORKER_STAMP_SUFFIX = '.stamp';

/** W10: why a stamp does not vouch for the program in place. The REASON of `CAPTURE_WORKER_BUILD_STAMP_STALE`. */
export const WorkerBuildStampProblem = {
  /** No file at `<program>.stamp`. */
  MISSING: 'STAMP_MISSING',
  /** An absent key, a malformed or too long stamp, or a stamp file that fails the program path rule. */
  UNREADABLE: 'STAMP_UNREADABLE',
  /** `workerVersion` is not `CAPTURE_WORKER_VERSION`. */
  VERSION_MISMATCH: 'STAMP_VERSION_MISMATCH',
  /** `protocolVersion` is not `CAPTURE_PROTOCOL_VERSION`. */
  PROTOCOL_MISMATCH: 'STAMP_PROTOCOL_MISMATCH',
  /** `binarySha256` is not the sha256 of the program in place (or the program could not be read whole to tell). */
  BINARY_MISMATCH: 'STAMP_BINARY_MISMATCH',
} as const;
export type WorkerBuildStampProblem = (typeof WorkerBuildStampProblem)[keyof typeof WorkerBuildStampProblem];

/**
 * The longest stamp read. The four lines of W8 hold at most 31 + 21 + 78 + 78 = 208 bytes with a version word of
 * four-digit parts; anything longer is no stamp of this format.
 */
export const WORKER_STAMP_MAX_BYTES = 512;

/** The four keys of W8, in their order. */
export const WORKER_STAMP_KEYS = ['workerVersion', 'protocolVersion', 'sourceSha256', 'binarySha256'] as const;

export interface WorkerBuildStamp {
  readonly workerVersion: string;
  readonly protocolVersion: number;
  readonly sourceSha256: string;
  readonly binarySha256: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const PROTOCOL_WORD = /^[1-9][0-9]{0,3}$/;
/** A version word as written: printable ASCII without a space or `=`. Whether it is THE word is the caller's comparison. */
const VERSION_WORD = /^[\x21-\x3c\x3e-\x7e]{1,64}$/;

/** The stamp of W8 in these bytes, or null when they are not exactly that form. PURE. */
export function workerBuildStampOf(bytes: Uint8Array): WorkerBuildStamp | null {
  if (bytes.length === 0 || bytes.length > WORKER_STAMP_MAX_BYTES) return null;
  // ASCII, LF line ends only: every byte is a printable character or LF, and the last one is LF.
  for (const byte of bytes) if (byte !== 0x0a && (byte < 0x20 || byte > 0x7e)) return null;
  if (bytes[bytes.length - 1] !== 0x0a) return null;
  const lines = new TextDecoder('ascii').decode(bytes).slice(0, -1).split('\n');
  if (lines.length !== WORKER_STAMP_KEYS.length) return null;
  const values: string[] = [];
  for (const [index, key] of WORKER_STAMP_KEYS.entries()) {
    const line = lines[index] ?? '';
    if (!line.startsWith(`${key}=`)) return null;
    values.push(line.slice(key.length + 1));
  }
  const [workerVersion = '', protocolWord = '', sourceSha256 = '', binarySha256 = ''] = values;
  if (!VERSION_WORD.test(workerVersion) || !PROTOCOL_WORD.test(protocolWord) || !HEX64.test(sourceSha256) || !HEX64.test(binarySha256)) return null;
  return Object.freeze({ workerVersion, protocolVersion: Number(protocolWord), sourceSha256, binarySha256 });
}

/** The doors the reader goes through. Defaults: the real ones of `adapters/local/process-door.ts`. Test seams. */
export interface WorkerStampDoors {
  readonly inspect?: ProgramInspector;
  readonly readHead?: FileHeadReader;
  readonly readWhole?: WholeFileReader;
}

/**
 * Why the stamp beside `program` does not vouch for it, or null when it does. The checks in this order: the stamp is
 * there (MISSING), passes the path rule and has the form of W8 (UNREADABLE), names this Core's version (VERSION) and
 * protocol (PROTOCOL), and names the program in place (BINARY). The program is read only for the last question.
 * Never throws: a door that cannot read answers null, and that is a refusal word.
 */
export function workerBuildStampProblemOf(program: string, doors: WorkerStampDoors = {}): WorkerBuildStampProblem | null {
  const inspect = doors.inspect ?? inspectProgram;
  const readHead = doors.readHead ?? readFileHead;
  const readWhole = doors.readWhole ?? readWholeFile;
  const path = `${program}${CAPTURE_WORKER_STAMP_SUFFIX}`;
  const rule = helperProgramRefusal(inspect(path));
  if (rule === HelperProgramRefusal.NOT_FOUND) return WorkerBuildStampProblem.MISSING;
  if (rule !== null) return WorkerBuildStampProblem.UNREADABLE;
  // One byte more than the bound: a longer file is seen as too long, not cut to a valid-looking head.
  const bytes = readHead(path, WORKER_STAMP_MAX_BYTES + 1);
  const stamp = bytes === null ? null : workerBuildStampOf(bytes);
  if (stamp === null) return WorkerBuildStampProblem.UNREADABLE;
  if (stamp.workerVersion !== CAPTURE_WORKER_VERSION) return WorkerBuildStampProblem.VERSION_MISMATCH;
  if (stamp.protocolVersion !== CAPTURE_PROTOCOL_VERSION) return WorkerBuildStampProblem.PROTOCOL_MISMATCH;
  const programBytes = readWhole(program, FILE_WHOLE_MAX_BYTES);
  if (programBytes === null || sha256Hex(programBytes) !== stamp.binarySha256) return WorkerBuildStampProblem.BINARY_MISMATCH;
  return null;
}
