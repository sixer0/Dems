/**
 * THE CS-22 BOOT CHECKS OF REAL CAPTURE (blueprint row 61 / M3-W5; register CS-22, CS-09; specs
 * R-2 AC-3; capture spec §A.1.2, §A.2, §H; decisions D72(a), D72(l), D83 (O-2), D85; pair-58
 * findings A-3, A-12, F-10, R-5; check `M3-BC-1`).
 *
 * This file is PURE: facts in, a refusal (or none) out. It reads no file, starts no process and
 * reads no flag. The capture operation is handed in as the decision of THE ONE FUNCTION
 * (`captureOperationDecisionOf`, `../fence/operation.ts`): nothing here compares the capture mode
 * or the demo flag itself.
 *
 *   SIMULATED         INERT. Nothing is inspected, nothing is started, every stored adapter kind
 *                     stays inert (D83 O-2). Two things are SAID, never refused:
 *                       - table row 5 of spec §A.1.2 (`simulated` without demo controls) is
 *                         LABELLED: the passed line carries `SIMULATED_WITHOUT_DEMO_CONTROLS`
 *                         (decision of this row; see the implementation note for why it is not
 *                         refused);
 *                       - a worker program configured in `simulated` is a WARNING (A-12): it is
 *                         never started.
 *   REAL_PRODUCTION   every check below, in this order; the first that fails stops the start:
 *   REAL_DEVELOPMENT    1. the worker program is configured                (the missing key)
 *                       2. the worker program passes the path rule         (regular file,
 *                          executable, owned by root or the server's user, not writable by group
 *                          or others, no directory on the way writable by them: the SAME rule as
 *                          the helper program of the development fence, spec §A.1.2 row 9)
 *                       3. the evidence store is a private directory of the server's user on a
 *                          volume that takes an exclusive create, a sync and a HARD LINK (the
 *                          worker reaches the final name of a camera file by `link()`, D72(b),
 *                          D85 R-5: on a volume without hard links every session would end fatal)
 *                       4. the evidence signing key loads (fails closed, SEC35-07)
 *                       4b-2. REAL_PRODUCTION only (task 4 row 228; X1-5, SX-10, UD-4): the WHOLE
 *                          organisational unit of the ACTIVE certificate - the one checks 4 and 4b
 *                          judged - is `Evidence signing <configured installation id>`. A key of
 *                          another installation, a key with the default unit, with none or with
 *                          several, and a Core whose installation id is not known are refused by
 *                          `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`. A renamed installation
 *                          rotates to a key that carries the new name (`evidence:rotate-key`)
 *                       4b-3. REAL_PRODUCTION only (task 4 row 228b; review 230 R-4, decision C84): the
 *                          configured installation id is NOT one of `ReservedInstallationId` - the ids
 *                          the repository's own test fixtures, its published demonstration data and its
 *                          documentation use. Such an id is refused by
 *                          `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS` even when the key names it: a key
 *                          a test fixture made can then never be the key of a real installation
 *                       4c. REAL_PRODUCTION only: NO operator's stored credential verifies against
 *                          the PUBLISHED demo password of the seed (batch N; security review S99-01,
 *                          ruling D241). The count of such operators is said; operators that cannot
 *                          be read are a refusal too (fail closed). Provisioning operators is a task
 *                          of its own: until it exists, a seeded database is not a production one
 *                       4d. REAL_PRODUCTION only, and only when the composition hands the host facts in
 *                          (`deps.host`; task 4 row 80, WP-20): THE HOST CHECKS of `host-checks.ts` -
 *                          the core-file limit, the start switches, the relay and guard programs under
 *                          the path rule of check 2, then on Linux the questions of the host profile
 *                          (the loopback owner rule first: BR-12). The first prerequisite that is
 *                          missing is refused by ITS OWN code, with a reason of fixed words; on another
 *                          platform the questions are not asked and that is SAID (a warning)
 *                       4d-2. REAL_PRODUCTION only, and only when the host facts are handed in (row P1; decision
 *                          U21 (2), C66 (1)): THE PLATFORM of the host is one a production Core is allowed on -
 *                          `linux` (the whole host profile was asked in 4d) or `darwin` (it was not asked, and
 *                          the warning of 4d said so). Every other platform, and a platform that is not stated,
 *                          is refused by `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED` with a fixed word. Asked AFTER 4d,
 *                          so a host that cannot be seen is still refused by 4d's own first code (C46). What was
 *                          asked is a FACT OF THE OUTCOME (`hostProfile`), for the evidence: see below
 *                       4e. REAL_PRODUCTION only, and only when the composition hands them in (`deps.programs`;
 *                          task 4 row 81, WP-20): THE DELIVERED PROGRAMS of `program-checks.ts` - the relay's
 *                          stated media library, the file of the address helper, its grant (the socket's
 *                          directory and the two unit files), and the interface file against the stored row.
 *                          Each is refused by its own code; a file that names another interface than the
 *                          row is `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`
 *                       ROW HC (decisions C55 DD-2, C53 (4c), C49 (2), C94 (j)) - three additions around 4d and 4e,
 *                       REAL_PRODUCTION only; no earlier check and no check of 4, 4b, 4b-2, 4b-3, 4c, 4d-2 is changed:
 *                       4d-0. BEFORE 4d: a Core that was handed NO host facts (`deps.hostFactsHandedIn === false`: the
 *                          mount says so when nothing came through its door) is refused by a code OF ITS OWN,
 *                          `CAPTURE_HOST_FACTS_NOT_HANDED_IN` / `NO_HOST_FACTS`. Until this row that start was refused
 *                          one line later by 4d's first code, `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE`,
 *                          which named a limit nobody had read. Facts that WERE handed in and whose limit cannot be
 *                          read keep that code (C46)
 *                       4d-3. AFTER 4d-2: a configured socket path of the address helper (`DEMS_CAPTURE_ALIAS_SOCKET`)
 *                          is THE path the delivered socket unit installs, or the start is refused by
 *                          `CAPTURE_HOST_ALIAS_SOCKET_PATH` / `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE` (R119-10): the
 *                          boot asks the installed node, so the client may dial no other. Unset is not asked. A
 *                          comparison of two texts: it asks the host nothing, on every platform
 *                       4e, amended. THE ADDRESS HELPER IS NOT MANDATORY (C94 (j) reverses C49 (1)). On Linux, a host
 *                          with NOTHING of the helper - no socket node (4d), no helper file, no directory of the
 *                          socket and no unit file (4e) - is not refused: the fact is said in one line,
 *                          `CAPTURE_HOST_ALIAS_HELPER_ABSENT` (a warning, with an error-log row), and the commissioning
 *                          functions answer their own refusal. A helper that is there and wrong, and a helper of
 *                          which only a part is there, are refused by the codes of before
 *                       5. the worker - started with the SAME arguments a session start passes -
 *                          answers `HELLO` with this protocol, NO proof-build mark (F-10) and THE
 *                          version this Core was built to drive (`CAPTURE_WORKER_VERSION`; gate 64
 *                          condition C7, ruling D194): an older or a newer worker binary is refused
 *                          HERE, by name, and not at the first session start
 *
 * A refused combination of the flags (`decision.refusal`) is the capture fence's refusal; this
 * step repeats it with the fence's own code, so that it can never run a real check - or pass - on
 * a configuration the one function refused, whatever the order of the boot steps.
 *
 * A refusal names a code, a reason code and configuration keys. It never holds a path, a value of
 * the environment or a text of the operating system.
 */
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { CaptureOperation } from '../adapters/kinds';
import { HelperProgramRefusal, helperProgramRefusal, type ProgramFacts, type ProgramInspector } from '../adapters/local';
import type { CaptureOperationDecision } from '../fence/operation';
import { CaptureHostRefusal, HOST_REFUSAL_TEXT, hostCheckOutcomeOf, type CaptureHostDeps } from './host-checks';
import { CaptureProgramRefusal, PROGRAM_REFUSAL_TEXT, deliveredProgramOutcomeOf, type DeliveredProgramDeps } from './program-checks';
// Row HC: the installed socket path (check 4d-3) and the finding of the socket question that 4d hands to 4e.
import { ALIAS_SOCKET_INSTALLED_PATH, type AliasSocketFinding } from './host-checks';

/** ID of the boot step. It appears in the log line of a boot that stops at it. */
export const CAPTURE_BOOT_STEP = 'capture.boot';

/** Where the evidence signing key lives below the data directory (decision D-83-7: apart from the media root). */
export const SIGNING_STORE_SUBPATH = 'signer';

export const CaptureBootRefusal = {
  /** The one function refused the flags (the fence's code is the reason). */
  OPERATION_REFUSED: 'CAPTURE_OPERATION_REFUSED',
  /** `DEMS_CAPTURE_WORKER` is unset in a real operation. */
  WORKER_NOT_CONFIGURED: 'CAPTURE_WORKER_NOT_CONFIGURED',
  WORKER_PROGRAM_UNUSABLE: 'CAPTURE_WORKER_PROGRAM_UNUSABLE',
  EVIDENCE_STORE_UNUSABLE: 'CAPTURE_EVIDENCE_STORE_UNUSABLE',
  SIGNING_KEY_UNUSABLE: 'CAPTURE_SIGNING_KEY_UNUSABLE',
  /** The signing key of the store is a DEVELOPMENT key and the Core is REAL_PRODUCTION (fix pass F-M7, R88-08 (3); D178). */
  DEVELOPMENT_SIGNING_KEY: 'CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION',
  /**
   * The active certificate of a REAL_PRODUCTION Core does not name THIS installation (task 4 row 228; X1-5, SX-10): its
   * organisational unit is not, as a whole, `Evidence signing <configured installation id>`. The reason is a fixed word.
   */
  SIGNING_KEY_INSTALLATION_MISMATCH: 'CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH',
  /**
   * The installation id a REAL_PRODUCTION Core is configured with is one of the RESERVED ids of the repository's tests,
   * demonstration data and documentation (task 4 row 228b; `ReservedInstallationId`). The reason is a fixed word.
   */
  INSTALLATION_ID_RESERVED: 'CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS',
  /**
   * At least one operator of a REAL_PRODUCTION Core still signs in with the published demo password of the seed, or the
   * operators could not be read (batch N; S99-01, D241). The reason is `operators=<count>` or `OPERATORS_UNREADABLE`.
   */
  DEMO_PASSWORD_IN_PRODUCTION: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION',
  WORKER_NO_HANDSHAKE: 'CAPTURE_WORKER_NO_HANDSHAKE',
  /** The worker answered that its media library is not the verified one (decision D188 (a)). */
  WORKER_MEDIA_LIBRARY_MISMATCH: 'CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH',
  WORKER_PROTOCOL_MISMATCH: 'CAPTURE_WORKER_PROTOCOL_MISMATCH',
  WORKER_PROOF_BUILD: 'CAPTURE_WORKER_PROOF_BUILD',
  WORKER_VERSION_UNKNOWN: 'CAPTURE_WORKER_VERSION_UNKNOWN',
  /** The worker is a release build of ANOTHER version than this Core drives (wave H driver F; gate 64 C7, ruling D194). */
  WORKER_VERSION_MISMATCH: 'CAPTURE_WORKER_VERSION_MISMATCH',
  /**
   * The platform of a REAL_PRODUCTION Core is not one a production Core is allowed on (row P1; decision U21 (2):
   * Linux and this Mac, `PRODUCTION_PLATFORMS`). The reason is a fixed word, never the platform's own text.
   */
  HOST_PLATFORM_NOT_SUPPORTED: 'CAPTURE_HOST_PLATFORM_NOT_SUPPORTED',
  /**
   * A REAL_PRODUCTION Core was handed NO host facts at all (row HC; decision C55 DD-2): nothing came through the door
   * the entry point opens, so nothing of the host was seen. The reason is the fixed word `NO_HOST_FACTS`.
   */
  HOST_FACTS_NOT_HANDED_IN: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN',
  /**
   * `DEMS_CAPTURE_ALIAS_SOCKET` is set and is not the path the delivered socket unit installs (row HC; decision
   * C53 (4c), R119-10). The reason is a fixed word, never the configured path.
   */
  HOST_ALIAS_SOCKET_PATH: 'CAPTURE_HOST_ALIAS_SOCKET_PATH',
  /** The prerequisites of the production host, one code each (task 4 row 80; `host-checks.ts`). REAL_PRODUCTION only. */
  ...CaptureHostRefusal,
  /** The delivered programs of the production host, one code each (task 4 row 81; `program-checks.ts`). REAL_PRODUCTION only. */
  ...CaptureProgramRefusal,
} as const;
export type CaptureBootRefusal = (typeof CaptureBootRefusal)[keyof typeof CaptureBootRefusal];

const TEXT: Readonly<Record<CaptureBootRefusal, string>> = Object.freeze({
  CAPTURE_OPERATION_REFUSED: 'This combination of DEMS_CAPTURE_MODE, DEMS_DEMO_CONTROLS and DEMS_CAPTURE_DEV_SOURCES is refused. See the line of the capture fence for the remedy.',
  CAPTURE_WORKER_NOT_CONFIGURED: 'DEMS_CAPTURE_MODE=real needs the capture worker program in DEMS_CAPTURE_WORKER. Build it (make -C apps/capture-worker) and set the key to the absolute path of build/capture-worker.',
  CAPTURE_WORKER_PROGRAM_UNUSABLE:
    'The program in DEMS_CAPTURE_WORKER cannot be used: it must be a regular executable file owned by root or by the user of the server, not writable by group or others, with no directory on the way to it writable by them.',
  CAPTURE_EVIDENCE_STORE_UNUSABLE:
    'The evidence store (DEMS_MEDIA_DIR, default <data directory>/media/sessions) cannot be used: it must be a directory of the user of the server, owner-only (no permission for group or others: chmod 700), on a volume that supports exclusive create, sync and hard links. Recordings lie in this directory in PLAINTEXT from the start of a session until its seal completes (they are encrypted at seal time), recordings the Core could not seal stay in its .quarantine folder, a recording that is being sealed is staged in its .sealing folder and the audio tap of a running session lies in its .transcriber folder: nobody but the server may read the store or these folders, and none of them may be a link (chmod 700 each).',
  CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION:
    'The evidence signing key in <data directory>/signer is a DEVELOPMENT key (its certificate says "DEVELOPMENT KEY - NOT FOR PRODUCTION"): a production Core does not start with it, because every package it sealed would carry a development signature. Provision the production signing key, or run the Core in development capture mode.',
  CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH:
    'The certificate of the evidence signing key in <data directory>/signer does not name this installation: a production Core starts only with a key whose organisational unit is exactly "Evidence signing <installation device id>", with the installation device id this Core is configured with. A key copied from another installation, a key of a test and a key made before the installation was named are refused. If the installation was renamed, rotate to a key that carries the new name (npm run evidence:rotate-key -w @dems/core-server -- --data-dir <dir>), then start again.',
  CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS:
    'The installation device id this Core is configured with is reserved: it is an id of the tests, of the published demonstration data or of the documentation of this software, and no installation may carry it, because a key made by a test could name it. A production Core does not start with it. Give the installation an id of its own, rotate the evidence signing key in <data directory>/signer to a key that carries that id (npm run evidence:rotate-key -w @dems/core-server -- --data-dir <dir>), then start again.',
  CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION:
    'An operator of this Core can still sign in with the published demonstration password of the seed (it is printed in the repository and on the sign-in cards of a demonstration): a production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES) does not start while that is so, or while its operators cannot be read. Give every operator a credential of their own, or run the Core in development capture mode.',
  CAPTURE_SIGNING_KEY_UNUSABLE: 'The evidence signing key cannot be loaded from <data directory>/signer: real capture does not start without the key that seals its packages. Provision the key once, then start again.',
  CAPTURE_WORKER_NO_HANDSHAKE: 'The program in DEMS_CAPTURE_WORKER did not answer as a capture worker: no HELLO frame within the limit.',
  CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH:
    'The capture worker in DEMS_CAPTURE_WORKER cannot be used: the libavformat it runs with on this host is not the version it was built and verified against (the media library was upgraded or replaced after the build), so its recordings would not be the verified ones. Build the worker again on this host (make -C apps/capture-worker) and run its checks, or restore the media library version it was built with; then start again.',
  CAPTURE_WORKER_PROTOCOL_MISMATCH: 'The capture worker speaks another version of the capture protocol than this server. Build the worker of this repository state (make -C apps/capture-worker).',
  CAPTURE_WORKER_PROOF_BUILD: 'The program in DEMS_CAPTURE_WORKER is a PROOF build (a negative control of the capture checks). It is never started by the Core. Set the key to build/capture-worker.',
  CAPTURE_WORKER_VERSION_UNKNOWN: 'The capture worker names a version this server does not know as a release build. Only capture-worker/<major>.<minor>.<patch> is started.',
  CAPTURE_WORKER_VERSION_MISMATCH:
    'The program in DEMS_CAPTURE_WORKER is a capture worker of another version than the one this server was built to drive: the two are released together and neither is used with another. Build the worker of this repository state (make -C apps/capture-worker) and set the key to it.',
  CAPTURE_HOST_PLATFORM_NOT_SUPPORTED:
    'A production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES) runs on Linux, where the whole host profile (scripts/host/HOST-PROFILE-UBUNTU-24.04.md) is checked at every start, or on macOS, where the host profile is NOT checked and every start and every sealed package says so. The platform of this host is neither, or was not stated: the Core does not start here. Run the Core on a prepared Linux host, or in development capture mode.',
  CAPTURE_HOST_FACTS_NOT_HANDED_IN:
    'A production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES) was started without the facts of its host: nothing told it its platform, its core-file limit, its start arguments or how to ask the host a question, so no host check could be made and none is assumed to pass. The server entry of this software hands these facts in at every start; a Core started another way must hand them in through the same door (the host facts of the capture boot checks) before the boot steps run.',
  CAPTURE_HOST_ALIAS_SOCKET_PATH:
    'DEMS_CAPTURE_ALIAS_SOCKET is set to another path than the one the delivered socket unit of the address helper installs (item HOST-44; scripts/host/netalias/dems-core-netalias.socket): a production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES) checks the installed socket at every start and would then send its requests to one it never checked. Remove the key, or set it to the path of the delivered unit; then start again.',
  ...HOST_REFUSAL_TEXT,
  ...PROGRAM_REFUSAL_TEXT,
});

/** The reason of `DEMO_PASSWORD_IN_PRODUCTION` when the operators could not be read at all: the check fails closed. */
export const OPERATORS_UNREADABLE = 'OPERATORS_UNREADABLE';

/** Row HC: the reason of `HOST_FACTS_NOT_HANDED_IN` (check 4d-0). A fixed word. */
export const NO_HOST_FACTS = 'NO_HOST_FACTS';
/** Row HC: the reason of `HOST_ALIAS_SOCKET_PATH` (check 4d-3). A fixed word, never the configured path. */
export const CONFIGURED_PATH_NOT_THE_INSTALLED_ONE = 'CONFIGURED_PATH_NOT_THE_INSTALLED_ONE';
/** Row HC: the `code` of the one line a production boot on Linux says when nothing of the address helper is installed (C94 (j)). Not a refusal. */
export const ALIAS_HELPER_ABSENT = 'CAPTURE_HOST_ALIAS_HELPER_ABSENT';

/** A real start the boot checks refuse. `code` and `reason` are machine codes; the message names keys and the remedy. */
export class CaptureBootError extends Error {
  readonly code: CaptureBootRefusal;
  /** Which rule failed (a code of the path rule, of the volume probe, of the signer, of the handshake), or null. */
  readonly reason: string | null;
  constructor(code: CaptureBootRefusal, reason: string | null = null, detail: string | null = null) {
    super(`${TEXT[code]}${reason === null ? '' : ` Reason: ${reason}.`}${detail === null ? '' : ` ${detail}`}`);
    this.name = 'CaptureBootError';
    this.code = code;
    this.reason = reason;
  }
}

// ── 1 and 2: the worker program ───────────────────────────────────────────────────────────────

export const WorkerProgramProblem = { ...HelperProgramRefusal, NOT_SET: 'NOT_SET', NOT_EXECUTABLE: 'NOT_EXECUTABLE' } as const;
export type WorkerProgramProblem = (typeof WorkerProgramProblem)[keyof typeof WorkerProgramProblem];

const EXECUTE_BITS = 0o111;
const GROUP_OR_OTHER_WRITE = 0o022;
const GROUP_OR_OTHER_ANY = 0o077;

/** The worker path against the path rule (the rule of the helper program, spec §A.1.2 row 9), plus "is set" and "can be executed". */
export function workerProgramProblemOf(program: string | null, inspect: ProgramInspector): WorkerProgramProblem | null {
  if (program === null || program === '') return WorkerProgramProblem.NOT_SET;
  const facts: ProgramFacts = inspect(program);
  const refused = helperProgramRefusal(facts);
  if (refused !== null) return refused;
  return facts.file !== null && (facts.file.mode & EXECUTE_BITS) !== 0 ? null : WorkerProgramProblem.NOT_EXECUTABLE;
}

// ── 3: the evidence store and its volume ──────────────────────────────────────────────────────

/** What the probe found (`evidence-volume.ts`). Facts only: the rule is `evidenceStoreProblemOf`. */
export interface EvidenceVolumeFacts {
  readonly absolute: boolean;
  /** The directory is there (it was, or the probe created it with mode 0700). */
  readonly present: boolean;
  readonly directory: boolean;
  readonly ownerUid: number | null;
  /** The permission bits of the directory (`mode & 0o7777`). */
  readonly mode: number | null;
  /** The user the server runs as; -1 when the platform has none. */
  readonly serverUid: number;
  /** A new file was created EXCLUSIVELY in the directory and its bytes were written. */
  readonly exclusiveCreate: boolean;
  /** The same name could NOT be created a second time (the volume honours the exclusive flag). */
  readonly exclusiveRefusesSecond: boolean;
  /** The file was synced to the device. */
  readonly synced: boolean;
  /** A second name was linked to the file, and both names are one file (same inode, two links). */
  readonly hardLink: boolean;
  /** A link onto a name that exists was refused: the property the worker's final name rests on. */
  readonly linkRefusesExisting: boolean;
  /** Both probe names were removed again. */
  readonly cleaned: boolean;
  /** The real figures of the volume (CS-09), or null when the volume did not say. */
  readonly totalBytes: number | null;
  readonly freeBytes: number | null;
  /**
   * The HIDDEN FOLDERS of the store that hold plaintext, as far as they exist (fix pass F-M7c):
   * `.quarantine` (recordings the Core could not seal), `.sealing` (the staging of a seal; wave H
   * driver F) and `.transcriber`, `.transcriber/sessions` (the raw audio tap of a session, ruling D180). `directory` is false for a link or a file - the
   * probe follows nothing. Absent: a probe that does not look (a test's facts).
   */
  readonly privateFolders?: readonly PrivateFolderFacts[];
}

export interface PrivateFolderFacts {
  /** The path below the store root, `/`-joined: one of `EVIDENCE_STORE_PRIVATE_FOLDERS`. */
  readonly name: string;
  readonly directory: boolean;
  readonly ownerUid: number | null;
  readonly mode: number | null;
}

/** The hidden folders of the evidence store the boot holds to the owner-only rule, with the reason each is refused by. */
export const EVIDENCE_STORE_PRIVATE_FOLDERS: Readonly<Record<string, 'QUARANTINE_READABLE_BY_OTHERS' | 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS' | 'SEALING_STAGING_READABLE_BY_OTHERS'>> = Object.freeze({
  '.quarantine': 'QUARANTINE_READABLE_BY_OTHERS',
  // The staging of a seal (wave H driver F; the row-96 docs note): `.sealing/<session>/` holds the session's files while they are sealed.
  '.sealing': 'SEALING_STAGING_READABLE_BY_OTHERS',
  '.transcriber': 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS',
  '.transcriber/sessions': 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS',
});

export const EvidenceStoreProblem = {
  NOT_ABSOLUTE: 'NOT_ABSOLUTE',
  NOT_CREATABLE: 'NOT_CREATABLE',
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  OWNER: 'OWNER',
  WRITABLE_BY_OTHERS: 'WRITABLE_BY_OTHERS',
  /** Group or others may read or enter the store (fix pass F-M7, R88-04): recordings are plaintext there until sealed (D147). */
  READABLE_BY_OTHERS: 'READABLE_BY_OTHERS',
  /** The quarantine folder exists and is not an owner-only directory of the server (fix pass F-M7c): what the Core could not seal lies there in plaintext. */
  QUARANTINE_READABLE_BY_OTHERS: 'QUARANTINE_READABLE_BY_OTHERS',
  /** The transcriber's scratch root exists and is not an owner-only directory of the server (fix pass F-M7c; D180): the raw audio tap of a session lies there. */
  TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS: 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS',
  /**
   * The staging folder of the seal exists and is not an owner-only directory of the server (wave H driver F):
   * a session's recording lies below `.sealing/<session>/` while it is sealed, plaintext until its files are encrypted.
   */
  SEALING_STAGING_READABLE_BY_OTHERS: 'SEALING_STAGING_READABLE_BY_OTHERS',
  NOT_WRITABLE: 'NOT_WRITABLE',
  NO_EXCLUSIVE_CREATE: 'NO_EXCLUSIVE_CREATE',
  NO_SYNC: 'NO_SYNC',
  NO_HARD_LINKS: 'NO_HARD_LINKS',
  LINK_REPLACES_EXISTING: 'LINK_REPLACES_EXISTING',
  PROBE_LEFT_BEHIND: 'PROBE_LEFT_BEHIND',
} as const;
export type EvidenceStoreProblem = (typeof EvidenceStoreProblem)[keyof typeof EvidenceStoreProblem];

/** The first reason the evidence store is refused for, or null when the worker may write camera files there. */
export function evidenceStoreProblemOf(facts: EvidenceVolumeFacts): EvidenceStoreProblem | null {
  if (!facts.absolute) return EvidenceStoreProblem.NOT_ABSOLUTE;
  if (!facts.present) return EvidenceStoreProblem.NOT_CREATABLE;
  if (!facts.directory) return EvidenceStoreProblem.NOT_A_DIRECTORY;
  // The store is the server's own: a directory of another user (root included) is one the server cannot keep private.
  if (facts.ownerUid === null || facts.serverUid < 0 || facts.ownerUid !== facts.serverUid) return EvidenceStoreProblem.OWNER;
  if (facts.mode === null || (facts.mode & GROUP_OR_OTHER_WRITE) !== 0) return EvidenceStoreProblem.WRITABLE_BY_OTHERS;
  // OWNER-ONLY (R88-04): the worker writes PLAINTEXT recordings here and the Core encrypts them at seal time
  // (ruling D147); the quarantine of what could not be sealed is here as well. No bit for group or others at all.
  if ((facts.mode & GROUP_OR_OTHER_ANY) !== 0) return EvidenceStoreProblem.READABLE_BY_OTHERS;
  // THE SAME RULE FOR THE HIDDEN FOLDERS THAT HOLD PLAINTEXT (F-M7c): a real directory (never a link), the server's own, no bit for group or others.
  for (const folder of facts.privateFolders ?? []) {
    const problem = EVIDENCE_STORE_PRIVATE_FOLDERS[folder.name];
    if (problem === undefined) continue;
    if (!folder.directory || folder.ownerUid === null || folder.ownerUid !== facts.serverUid || folder.mode === null || (folder.mode & GROUP_OR_OTHER_ANY) !== 0) return EvidenceStoreProblem[problem];
  }
  if (!facts.exclusiveCreate) return EvidenceStoreProblem.NOT_WRITABLE;
  if (!facts.exclusiveRefusesSecond) return EvidenceStoreProblem.NO_EXCLUSIVE_CREATE;
  if (!facts.synced) return EvidenceStoreProblem.NO_SYNC;
  if (!facts.hardLink) return EvidenceStoreProblem.NO_HARD_LINKS;
  if (!facts.linkRefusesExisting) return EvidenceStoreProblem.LINK_REPLACES_EXISTING;
  if (!facts.cleaned) return EvidenceStoreProblem.PROBE_LEFT_BEHIND;
  return null;
}

// ── 5: the worker's answer ────────────────────────────────────────────────────────────────────

export const HandshakeFailure = {
  /** The process could not be started. */
  SPAWN_FAILED: 'SPAWN_FAILED',
  /** No frame within the limit. */
  TIMEOUT: 'TIMEOUT',
  /** The process ended before it said `HELLO`. */
  EXITED: 'EXITED',
  /** Its first line is no frame of the protocol. */
  VIOLATION: 'VIOLATION',
  /** Its first frame is not `HELLO`. */
  HELLO_EXPECTED: 'HELLO_EXPECTED',
  /**
   * Its first frame is `CRASH` with the code `LIBAVFORMAT_VERSION_MISMATCH` (fix F-M3, R63-07; decision D188 (a)):
   * the worker runs on another libavformat than the one it was verified against, says so INSTEAD of `HELLO`, and exits.
   */
  MEDIA_LIBRARY_MISMATCH: 'MEDIA_LIBRARY_MISMATCH',
} as const;
export type HandshakeFailure = (typeof HandshakeFailure)[keyof typeof HandshakeFailure];

/** What the worker said when it was started once and asked for nothing (`worker-probe.ts`). */
export type WorkerHandshake =
  | { readonly outcome: 'HELLO'; readonly protocolVersion: number; readonly workerVersion: string }
  | { readonly outcome: 'NONE'; readonly failure: HandshakeFailure };

/** The mark a proof build of the worker puts on its version (`apps/capture-worker/src/ipc.c`, the `HELLO` line). */
export const PROOF_BUILD_MARK = '-PROOF';
/** The FORM of a release word. A word of another form is refused as unknown (a proof build under another mark as well). */
export const RELEASE_WORKER_VERSION = /^capture-worker\/\d{1,4}\.\d{1,4}\.\d{1,4}$/;
/**
 * THE VERSION OF THE CAPTURE WORKER THIS CORE WAS BUILT TO DRIVE (wave H driver F; gate 64 condition
 * C7, ruling D194): the word `apps/capture-worker/src/worker.h` defines as `WORKER_VERSION` -
 * `protocol-pins.test.ts` and `fault-lifecycle.test.ts` hold the two EQUAL, so a worker release without
 * this constant fails a test. The allowlist is this ONE word: the protocol number does not move for
 * an additive member, so a worker of an earlier tree (no fragment size bound, no stated sync level)
 * speaks the same protocol and has the release FORM - only its version tells it apart.
 */
export const CAPTURE_WORKER_VERSION = 'capture-worker/0.6.0';

/** True when a worker version carries the proof-build mark, in any case and at any place. */
export function isProofWorkerVersion(workerVersion: string): boolean {
  return workerVersion.toUpperCase().includes(PROOF_BUILD_MARK);
}

/**
 * Why the Core does not start a worker that said this `HELLO`, or null. ONE rule for the boot
 * check and for the supervisor's handshake of a session (a program can be replaced after boot).
 */
export function workerVersionRefusalOf(hello: { readonly protocolVersion: number; readonly workerVersion: string }): CaptureBootRefusal | null {
  if (hello.protocolVersion !== CAPTURE_PROTOCOL_VERSION) return CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH;
  if (isProofWorkerVersion(hello.workerVersion)) return CaptureBootRefusal.WORKER_PROOF_BUILD;
  if (!RELEASE_WORKER_VERSION.test(hello.workerVersion)) return CaptureBootRefusal.WORKER_VERSION_UNKNOWN;
  // A release word, and not the one this Core drives: refused by name (gate 64 C7). The word has the release form, so it can be repeated.
  if (hello.workerVersion !== CAPTURE_WORKER_VERSION) return CaptureBootRefusal.WORKER_VERSION_MISMATCH;
  return null;
}

/** What a refused version is said with: expected and found. Only for a word of the release form (checked by the caller's refusal code). */
export function workerVersionMismatchReasonOf(found: string): string {
  return `expected ${CAPTURE_WORKER_VERSION}, found ${found}`;
}

// ── check 4b-3 (task 4 row 228b; review 230 R-4, decision C84): the reserved installation ids ──────────────────

/**
 * THE ONE CLOSED LIST of installation ids that no installation may carry: every id the repository's own test
 * fixtures and test configuration, its published demonstration data and its documentation name. The fixtures
 * IMPORT their id from here (a static test holds that no test support names another one), so an id a fixture
 * makes a key for is always refused by a production Core. A test that boots `REAL_PRODUCTION` states a synthetic
 * id of its own, which is not in this list, and makes its key for that id in a temporary directory.
 */
export const ReservedInstallationId = {
  /** The id of the test configuration and of the key the boot fixture makes by default. */
  TEST_CONFIGURATION: 'DEMS-TEST-01',
  /** The Core of the published demonstration data and of the seed. */
  DEMONSTRATION: 'DEMS-IR-01',
  /** The example the installer's prompt, the configuration notes and the database fixtures print. */
  DOCUMENTED_EXAMPLE: 'DEMS-JKT-07',
} as const;
export type ReservedInstallationId = (typeof ReservedInstallationId)[keyof typeof ReservedInstallationId];

/** The reason of the refusal: a fixed word, never the id. */
export const RESERVED_INSTALLATION_ID_REASON = 'RESERVED_INSTALLATION_ID';

/** True when `installationId` is one of the reserved ids. An id that is not known is not reserved: check 4b-2 has refused it. */
export function isReservedInstallationId(installationId: string | null | undefined): boolean {
  return typeof installationId === 'string' && (Object.values(ReservedInstallationId) as readonly string[]).includes(installationId);
}

// ── check 4d-2 (row P1; decisions U21 (2), C66 (1), C71 C-7): the platforms of a production Core ──────────────

/**
 * THE ONE CLOSED LIST of platforms a `REAL_PRODUCTION` Core starts on, with what each means for the host profile:
 * on `linux` every question of the profile is asked at every start (check 4d); on `darwin` NONE is asked - the
 * loopback owner rule, the crash collector, forwarding, the clock, sleep and the address helper's socket are
 * unchecked there, and the Core says so in its log, in its boot audit entry and in every manifest it seals.
 */
export const PRODUCTION_PLATFORMS = Object.freeze({ linux: 'ASKED', darwin: 'NOT_ASKED' } as const);
export type ProductionPlatform = keyof typeof PRODUCTION_PLATFORMS;

/** The reason of `HOST_PLATFORM_NOT_SUPPORTED`: a fixed word, never the platform's own text. */
export const PLATFORM_NOT_LINUX_OR_DARWIN = 'PLATFORM_NOT_LINUX_OR_DARWIN';

/** True when `platform` is one a production Core is allowed on. */
export function isProductionPlatform(platform: unknown): platform is ProductionPlatform {
  return typeof platform === 'string' && Object.prototype.hasOwnProperty.call(PRODUCTION_PLATFORMS, platform);
}

/**
 * WHAT A PRODUCTION BOOT STATES ABOUT ITS HOST PROFILE (row P1): the platform, and whether the questions of the
 * host profile are asked on it. Pure, and a function of the platform alone, so the fence can state it BEFORE the
 * checks run (`willBeAsked`) and the outcome can state it after they passed (`asked`): the two cannot differ.
 * Null for a platform no production Core starts on (check 4d-2 refuses it: there is no boot to state anything of).
 */
export interface HostProfileStatement {
  readonly platform: ProductionPlatform;
  /** True on `linux` (the whole profile); false on `darwin` (none of it). */
  readonly asked: boolean;
}
export function hostProfileStatementOf(platform: unknown): HostProfileStatement | null {
  return isProductionPlatform(platform) ? Object.freeze({ platform, asked: PRODUCTION_PLATFORMS[platform] === 'ASKED' }) : null;
}

// ── the step ──────────────────────────────────────────────────────────────────────────────────

/** Log and error-log sinks: the capture unit's one logging file hands them in (static rule G-R4). */
export interface CaptureBootSinks {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
  persist(entry: { readonly level: 'error' | 'warn'; readonly source: string; readonly message: string; readonly code: string; readonly context: Record<string, string | number> }): void;
}

export interface CaptureBootDeps {
  /** The decision of THE one function for this configuration. */
  readonly decision: CaptureOperationDecision;
  /** `config.captureWorkerPath`. */
  readonly workerProgram: string | null;
  readonly inspect: ProgramInspector;
  /** Probes the evidence store. Called in a real operation only. */
  probeEvidenceVolume(): EvidenceVolumeFacts;
  /** A code of the signer when the evidence signing key does not load, else null. Called in a real operation only. */
  signingKeyProblem(): string | null;
  /**
   * True when the certificate of the evidence signing key carries the development-key mark. Called
   * only after the key loaded, in REAL_PRODUCTION only: that operation refuses such a key (R88-08 (3)).
   */
  signingKeyIsDevelopment(): boolean;
  /**
   * Check 4b-2 (task 4 row 228): a fixed word when the organisational unit of the ACTIVE certificate - the
   * certificate checks 4 and 4b judged - is not `Evidence signing <configured installation id>`, else null.
   * Called in REAL_PRODUCTION only, after 4b. ABSENT: the question is not asked (a decision built by a test from
   * before the check); THE MOUNT ALWAYS HANDS IT IN, and its reader answers a word when it cannot tell.
   */
  readonly signingKeyInstallationProblem?: () => string | null;
  /**
   * Check 4b-3 (task 4 row 228b): the installation id this Core is configured with, or null when none is known.
   * Asked in REAL_PRODUCTION only, after 4b-2; a RESERVED id (`ReservedInstallationId`) is refused. ABSENT: the
   * question is not asked (a decision built by a test from before the check); THE MOUNT ALWAYS HANDS IT IN.
   */
  readonly installationId?: () => string | null;
  /**
   * HOW MANY operators have a stored credential that verifies against the published demo password of
   * the seed (S99-01), or null when the operators could not be read. Called in REAL_PRODUCTION only,
   * after the key checks and before any process is started. It returns a COUNT and nothing else: no
   * operator, no hash and no password crosses this line.
   */
  demoPasswordOperators(): Promise<number | null>;
  /** Starts the worker once and reads its first frame. Called in a real operation only, after every file check passed. */
  handshake(): Promise<WorkerHandshake>;
  /**
   * The facts of the host and the injected command runner (task 4 row 80). Asked in REAL_PRODUCTION only, after
   * the key and operator checks and before the worker is started. ABSENT: no host check runs (a composition
   * that has not wired them, and every test from before them).
   */
  readonly host?: CaptureHostDeps;
  /**
   * What the checks of the DELIVERED PROGRAMS need (task 4 row 81): the platform, the relay program, the runner
   * and the reader of the stored camera interface. Asked in REAL_PRODUCTION only, after the host checks and
   * before the worker is started. ABSENT: no such check runs (the same rule as `host`).
   */
  readonly programs?: DeliveredProgramDeps;
  /**
   * Row HC (C55 DD-2): FALSE when the mount was handed NO host facts and `host` / `programs` above are the ones of a
   * host that cannot be seen. A REAL_PRODUCTION start is then refused by `HOST_FACTS_NOT_HANDED_IN`, before 4d asks
   * anything. ABSENT or true: facts were handed in (or the caller is a test from before this member) - nothing is refused here.
   */
  readonly hostFactsHandedIn?: boolean;
  /**
   * Row HC (C53 (4c)): `config.captureAliasSocketPath` - the socket path the Core's client of the address helper would
   * dial, or null when the key is unset. Asked in REAL_PRODUCTION only (check 4d-3): a path that is set and is not the
   * installed one is refused. ABSENT: not asked (a test from before this member); THE MOUNT ALWAYS HANDS IT IN.
   */
  readonly configuredAliasSocket?: string | null;
  readonly sinks: CaptureBootSinks;
}

/** What the label of table row 5 reads (spec §A.1.2): the Core is not real capture, and the demo controls are off. */
export const SIMULATED_WITHOUT_DEMO_CONTROLS = 'SIMULATED_WITHOUT_DEMO_CONTROLS';

export interface CaptureBootOutcome {
  readonly operation: CaptureOperation;
  /** `SIMULATED_WITHOUT_DEMO_CONTROLS` for table row 5; null otherwise. */
  readonly label: typeof SIMULATED_WITHOUT_DEMO_CONTROLS | null;
  /** The version the worker named, in a real operation; null in `SIMULATED` (no worker is started). */
  readonly workerVersion: string | null;
  /** The real figures of the evidence volume (CS-09), in a real operation; null in `SIMULATED`. */
  readonly evidenceVolume: { readonly totalBytes: number | null; readonly freeBytes: number | null } | null;
  /**
   * Row P1: the platform this `REAL_PRODUCTION` boot passed on and whether the host profile was asked there
   * (check 4d-2). ABSENT in `SIMULATED` and `REAL_DEVELOPMENT` - no host profile is asked in either, by design,
   * and nothing is stated - and for a decision built without host facts (a test from before check 4d).
   */
  readonly hostProfile?: HostProfileStatement;
}

const SOURCE = 'capture.boot';
const PASSED = 'capture boot checks passed';
const REFUSED = 'the capture boot checks refuse this start: the server does not start';
const WORKER_IGNORED = 'a capture worker program is configured and capture mode is simulated: it is never started';
const HOST_PASSED = 'the host checks of a production Core passed';
const PROGRAMS_PASSED = 'the checks of the delivered programs of a production Core passed';
const HELPER_ABSENT = 'the address helper is not installed on this host (no socket, no helper file, no unit file): the commissioning functions that change an address are not available and answer their own refusal';
const HOST_NOT_LINUX ='the questions of the Linux host profile were not asked: this host is not Linux, so the loopback rule and the other host prerequisites are unchecked';

/**
 * Runs the checks. Throws `CaptureBootError` after logging and persisting it: the readiness runner
 * stops the start as it does for any boot step.
 */
export async function runCaptureBootChecks(deps: CaptureBootDeps): Promise<CaptureBootOutcome> {
  const { decision, sinks } = deps;
  const { operation } = decision;
  const refuse = (code: CaptureBootRefusal, reason: string | null, counted: { readonly operators: number } | null = null): never => {
    const failure = new CaptureBootError(code, reason, counted === null ? null : `${counted.operators} operator(s) of this Core have it.`);
    const context = { code, operation, ...(reason === null ? {} : { reason }), ...(counted === null ? {} : { operators: counted.operators }) };
    sinks.error(context, REFUSED);
    sinks.persist({ level: 'error', source: SOURCE, message: REFUSED, code, context });
    throw failure;
  };

  if (decision.refusal !== null) return refuse(CaptureBootRefusal.OPERATION_REFUSED, decision.refusal);

  if (operation === CaptureOperation.SIMULATED) {
    // INERT: no file is inspected, no process is started, no stored kind is read (D83 O-2).
    if (deps.workerProgram !== null && deps.workerProgram !== '') {
      const context = { code: 'CAPTURE_WORKER_IGNORED_IN_SIMULATED', operation };
      sinks.warn(context, WORKER_IGNORED);
      sinks.persist({ level: 'warn', source: SOURCE, message: WORKER_IGNORED, code: context.code, context });
    }
    const label = decision.demoControls ? null : SIMULATED_WITHOUT_DEMO_CONTROLS;
    sinks.info({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation, checks: 'inert', ...(label === null ? {} : { label }) }, PASSED);
    return Object.freeze({ operation, label, workerVersion: null, evidenceVolume: null });
  }

  // 1, 2: the worker program.
  const program = workerProgramProblemOf(deps.workerProgram, deps.inspect);
  if (program === WorkerProgramProblem.NOT_SET) return refuse(CaptureBootRefusal.WORKER_NOT_CONFIGURED, null);
  if (program !== null) return refuse(CaptureBootRefusal.WORKER_PROGRAM_UNUSABLE, program);

  // 3: the evidence store, on its real volume.
  const volume = deps.probeEvidenceVolume();
  const store = evidenceStoreProblemOf(volume);
  if (store !== null) return refuse(CaptureBootRefusal.EVIDENCE_STORE_UNUSABLE, store);

  // 4: the evidence signing key.
  const signing = deps.signingKeyProblem();
  if (signing !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_UNUSABLE, signing);
  // 4b: a development key never signs for a production Core (R88-08 (3)). REAL_DEVELOPMENT accepts it.
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyIsDevelopment()) return refuse(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, null);
  // 4b-2: the active certificate names THIS installation (row 228; X1-5, SX-10). REAL_DEVELOPMENT and SIMULATED never ask.
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyInstallationProblem !== undefined) {
    const binding = deps.signingKeyInstallationProblem();
    if (binding !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_INSTALLATION_MISMATCH, binding);
  }
  // 4b-3: the configured installation id is not an id of the tests, the demonstration data or the documentation (row 228b; R-4).
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.installationId !== undefined && isReservedInstallationId(deps.installationId())) {
    return refuse(CaptureBootRefusal.INSTALLATION_ID_RESERVED, RESERVED_INSTALLATION_ID_REASON);
  }

  // 4c: the published demo password is no credential of a production Core (S99-01, D241). REAL_DEVELOPMENT and SIMULATED never ask.
  if (operation === CaptureOperation.REAL_PRODUCTION) {
    // A reader that throws is a reader that could not read: fail closed, and nothing of its error is passed on.
    const operators = await deps.demoPasswordOperators().catch(() => null);
    if (operators === null || !Number.isSafeInteger(operators) || operators < 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE);
    if (operators > 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${operators}`, { operators });
  }

  // 4d-0 (row HC; C55 DD-2): a Core that was handed NO host facts is refused by a code of its own, here - where 4d's first
  // check refused it until now with the code of a limit nobody had read. REAL_DEVELOPMENT and SIMULATED never ask.
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.hostFactsHandedIn === false) return refuse(CaptureBootRefusal.HOST_FACTS_NOT_HANDED_IN, NO_HOST_FACTS);
  // Row HC (C94 (j)): what 4d finds of the address helper's socket node, for 4e. Undefined: 4d did not run.
  let aliasSocket: AliasSocketFinding | undefined;

  // 4d: the host of a production Core (task 4 row 80; BR-12, AD-09 (1), C19). REAL_DEVELOPMENT and SIMULATED never ask,
  // and neither does a composition that hands no host facts in. The relay and the guard are held to the rule of check 2.
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.host !== undefined) {
    const host = await hostCheckOutcomeOf(deps.host, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
    if (host.failure !== null) return refuse(host.failure.code, host.failure.reason);
    aliasSocket = host.aliasSocket;
    if (host.commands === 'NOT_LINUX') {
      const context = { code: 'CAPTURE_HOST_PROFILE_NOT_ASKED', operation, hostChecks: host.inPlace };
      sinks.warn(context, HOST_NOT_LINUX);
      sinks.persist({ level: 'warn', source: SOURCE, message: HOST_NOT_LINUX, code: context.code, context });
    } else sinks.info({ code: 'CAPTURE_HOST_CHECKS_PASSED', operation, hostChecks: host.inPlace }, HOST_PASSED);
  }

  // 4d-2: the platform is one a production Core is allowed on (row P1; U21 (2)): `linux`, where 4d asked the whole host
  // profile, or `darwin`, where 4d asked none of it and said so. Asked like 4d; REAL_DEVELOPMENT and SIMULATED never ask.
  const hostProfile = operation === CaptureOperation.REAL_PRODUCTION && deps.host !== undefined ? hostProfileStatementOf(deps.host.platform) : undefined;
  if (hostProfile === null) return refuse(CaptureBootRefusal.HOST_PLATFORM_NOT_SUPPORTED, PLATFORM_NOT_LINUX_OR_DARWIN);

  // 4d-3 (row HC; C53 (4c), R119-10): a configured socket path of the address helper is the installed one. Two texts are
  // compared and the host is asked nothing; unset (null) and not handed in (a test from before the member) are not asked.
  if (operation === CaptureOperation.REAL_PRODUCTION && typeof deps.configuredAliasSocket === 'string' && deps.configuredAliasSocket !== ALIAS_SOCKET_INSTALLED_PATH) {
    return refuse(CaptureBootRefusal.HOST_ALIAS_SOCKET_PATH, CONFIGURED_PATH_NOT_THE_INSTALLED_ONE);
  }

  // 4e: the delivered programs of a production Core (task 4 row 81; F10 (d), C19, HOST-44 to HOST-46). Asked like 4d:
  // REAL_PRODUCTION only, and only when the composition hands them in. The relay is started once, with no start message.
  // Row HC (C94 (j)): 4e is told what 4d found of the socket node, and judges the helper as ONE installation.
  if (operation === CaptureOperation.REAL_PRODUCTION && deps.programs !== undefined) {
    const programs = await deliveredProgramOutcomeOf(aliasSocket === undefined ? deps.programs : { ...deps.programs, aliasSocket }, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
    if (programs.failure !== null) return refuse(programs.failure.code, programs.failure.reason);
    sinks.info({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation, programChecks: programs.inPlace, notAsked: programs.notAsked }, PROGRAMS_PASSED);
    if (programs.aliasHelper === 'ABSENT') {
      // NOT a refusal (C94 (j)): nothing of the helper is installed. Said once, as the host profile that was not asked is said.
      const context = { code: ALIAS_HELPER_ABSENT, operation };
      sinks.warn(context, HELPER_ABSENT);
      sinks.persist({ level: 'warn', source: SOURCE, message: HELPER_ABSENT, code: context.code, context });
    }
  }

  // 5: the worker itself, started once. Only now: nothing is started from a path that failed a rule above.
  const hello = await deps.handshake();
  // D188 (a): a worker on another media library is NAMED - it is not a worker that did not answer.
  if (hello.outcome !== 'HELLO' && hello.failure === HandshakeFailure.MEDIA_LIBRARY_MISMATCH) return refuse(CaptureBootRefusal.WORKER_MEDIA_LIBRARY_MISMATCH, 'LIBAVFORMAT_VERSION_MISMATCH');
  if (hello.outcome !== 'HELLO') return refuse(CaptureBootRefusal.WORKER_NO_HANDSHAKE, hello.failure);
  const version = workerVersionRefusalOf(hello);
  if (version !== null) return refuse(version, version === CaptureBootRefusal.WORKER_VERSION_MISMATCH ? workerVersionMismatchReasonOf(hello.workerVersion) : null);

  const evidenceVolume = Object.freeze({ totalBytes: volume.totalBytes, freeBytes: volume.freeBytes });
  sinks.info({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation, checks: 'real', workerVersion: hello.workerVersion, volumeTotalBytes: volume.totalBytes ?? -1, volumeFreeBytes: volume.freeBytes ?? -1 }, PASSED);
  return Object.freeze({ operation, label: null, workerVersion: hello.workerVersion, evidenceVolume, ...(hostProfile === undefined ? {} : { hostProfile }) });
}
