/**
 * The v2 answer of operation 41 `verifyEvidence`, read defensively (blueprint row 87, M7-W6;
 * evidence package spec §D, §F.3; API contract C3 §3 op 41; UX spec flow 5 step 6, P-16).
 *
 * ONE reader for this app (the web console has its own copy of the same rules: one helper per app). It takes the answer as `unknown` and returns what the verify view may
 * draw, or `null` for a v1 answer (no `files` member: the 14 v1 demo packages and Simulated mode,
 * which keep their own view).
 *
 * Two groups of members:
 *
 * 1. THE CONTRACT TODAY (`EvidenceVerifyResultSchema`): `ok`, `at`, `files[]` (stored bytes,
 *    plaintext, fragment chain, fragment count per camera file), `transcriptOk?`, `manifestOk`,
 *    `signatureOk`. A member that is absent or of another type reads as NOT passed: nothing here is
 *    a pass by default.
 * 2. THE REPORT MEMBERS (optional in the schema since row 141; shapes = `PackageVerifyResult` of
 *    `@dems/shared/evidence-verify`): `overall`, `interrupted`, `checks[]` (the per-check report
 *    V-01 to V-15 with its findings), `fragments[]`, `failedFragmentCount`, `transcriptState`,
 *    `sources`. Absent = `null` = the view shows nothing extra. A member that is present but
 *    malformed is dropped, named in `malformed`, and never guessed.
 *
 * THE SOURCES BLOCK (row 92; R-11, spec §D.1): `sources` absent = `null` = nothing is drawn (a v1
 * answer). Present: its `state` is DEVELOPMENT only for `development === true` with the code
 * DEVELOPMENT, DECLARED_PRODUCTION only for `development === false` with that code, and
 * NOT_TRUSTWORTHY for everything else: `development: null`, the codes NOT_TRUSTWORTHY and UNKNOWN,
 * a block that cannot be read. Nothing that is unclear is ever read as production.
 *
 * A check with an ID this reader does not know is kept and drawn by its ID, so a sixteenth check
 * would never be hidden.
 *
 * The verdict is the Core's `ok` and nothing else: no row, check or finding is ever combined into
 * it, and `ok` is PASS only for the boolean `true`.
 */
import type { TFunction } from 'i18next';
import { en } from '@dems/shared/i18n';

export type V2Verdict = 'PASS' | 'FAIL';
export type V2FailureClass = 'TAMPERED' | 'CORRUPT' | 'MISSING' | 'UNREADABLE';
export type V2CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';
export type V2SkipReason = 'BLOCKED' | 'KEY_UNAVAILABLE' | 'OUT_OF_SCOPE';
export type V2Overall = 'PASS' | V2FailureClass;

/**
 * The seven codes of `VerifiedTranscriptState` (row 119). The list is the key set of this view's own
 * wording (`evidence.verifyV2.transcriptState`), which a test holds equal to the verifier's table
 * (`TRANSCRIPT_STATE_REPORT`): a code is known here exactly when it has a line to show. The verifier
 * module itself is not imported at run time (it would bring the package schemas into the bundle).
 */
export type V2TranscriptState = keyof typeof en.evidence.verifyV2.transcriptState;
export const V2_TRANSCRIPT_STATES = Object.keys(en.evidence.verifyV2.transcriptState) as readonly V2TranscriptState[];

/** The 15 checks of the verifier (spec §D; V-15 `Source class` is row 141's). */
export const V2_KNOWN_CHECK_IDS = ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14', 'V-15'] as const;
export type V2KnownCheckId = (typeof V2_KNOWN_CHECK_IDS)[number];

export interface V2FileRow {
  readonly fileId: string;
  readonly trackId: string;
  readonly ok: boolean;
  readonly storedOk: boolean;
  readonly plainOk: boolean;
  readonly chainOk: boolean;
  readonly fragmentCount: number | null;
  /**
   * Fix wave K (G89b-06, erratum PE-WK-46): present and `false` when the plaintext check (V-05) did
   * NOT run for THIS file - `plainOk: false` is then "not a pass", not a failed comparison. Absent:
   * `plainOk` is the result of the check. The Core never writes `true`; read by name, as the web does.
   */
  readonly plainChecked?: false;
}

/** WHERE a check found something; never a value of the package. */
export interface V2Finding {
  readonly code: string;
  readonly failureClass: V2FailureClass | null;
  readonly trackId: string | null;
  readonly seq: number | null;
  readonly file: string | null;
  readonly member: string | null;
  readonly revisionNo: number | null;
}

export interface V2Check {
  readonly id: string;
  readonly status: V2CheckStatus;
  readonly failureClass: V2FailureClass | null;
  readonly skipped: V2SkipReason | null;
  readonly findings: readonly V2Finding[];
}

/** One fragment that did not verify, as far as the answer names it. */
export interface V2FailedFragment {
  readonly trackId: string;
  readonly seq: number;
  /** TAMPERED, CORRUPT, …; null when the answer gives no class for it. */
  readonly reason: V2FailureClass | null;
  /** The stored bytes of this fragment do not hash to the sealed value (V-04). */
  readonly storedMismatch: boolean;
  /** The first fragment of this file at which the chain leaves the recorded chain (V-06); null: not named. */
  readonly chainBrokenFromSeq: number | null;
}

/** What the verified package says of its sources, as the view may word it. */
export type V2SourcesState = 'DEVELOPMENT' | 'DECLARED_PRODUCTION' | 'NOT_TRUSTWORTHY';
/** The manifest's three source classes (fields 124, 125). */
export type V2SourceClass = 'PRODUCTION' | 'LOCAL_DEVICE' | 'FAKE';

export interface V2Sources {
  readonly state: V2SourcesState;
  /** One entry per camera file; empty unless the state is stated (DEVELOPMENT or DECLARED_PRODUCTION). */
  readonly tracks: readonly { readonly trackId: string; readonly deviceId: string; readonly sourceClass: V2SourceClass }[];
  /** One entry per interval of the session audio track; empty unless the state is stated. */
  readonly audioIntervals: readonly { readonly seq: number; readonly micDeviceId: string; readonly sourceClass: V2SourceClass }[];
}

/**
 * The signing key of a verified package, as the view may word it (fix pass F-M7, R88-07; D178).
 * `DEVELOPMENT`: the certificate that VERIFIED the signature carries the development-key mark -
 * the view says "Signed with a DEVELOPMENT key — not a production signature", on a result that
 * passed as on one that failed. `NOT_ESTABLISHED`: the Core answered `null` (the manifest, the
 * signature or the certificate did not verify), or the member is unreadable - never read as "no
 * development key". `NOT_DEVELOPMENT`: nothing is drawn.
 */
export type V2SigningKey = 'DEVELOPMENT' | 'NOT_DEVELOPMENT' | 'NOT_ESTABLISHED';

/** One statement of the verifier about what the package format does not cover: its code and the Core's own line. */
export interface V2Notice {
  readonly code: string;
  readonly report: string;
}

export interface VerifyV2Answer {
  /** The Core's verdict: PASS only for `ok === true`. */
  readonly verdict: V2Verdict;
  readonly at: number | null;
  readonly files: readonly V2FileRow[];
  /** null: the answer has no transcript check (an item without a transcript document). */
  readonly transcriptOk: boolean | null;
  readonly manifestOk: boolean;
  readonly signatureOk: boolean;
  // ── Report members: null = the answer does not carry it ──
  readonly overall: V2Overall | null;
  readonly interrupted: boolean | null;
  readonly checks: readonly V2Check[] | null;
  readonly transcriptState: V2TranscriptState | null;
  /** null: the answer carries no `sources` block (a v1 answer): nothing is drawn. */
  readonly sources: V2Sources | null;
  /**
   * What the answer says of the SIGNING KEY (`signature.developmentKey`; fix pass F-M7, R88-07).
   * null: the answer carries no such member (a v1 answer, an older Core): nothing is drawn.
   */
  readonly signingKey: V2SigningKey | null;
  /** What the package signature does NOT cover (`notices[]`; R88-06). Shown, never collapsed. */
  readonly notices: readonly V2Notice[];
  /** How many fragments did not verify, when the answer says it; larger than the list when the Core cut it. */
  readonly failedFragmentCount: number | null;
  /** Every fragment the answer names as failed (from `fragments[]` and the findings); empty when it names none. */
  readonly failedFragments: readonly V2FailedFragment[];
  /** A chain break named for a file without a failed fragment of its own. */
  readonly chainBreaks: readonly { readonly trackId: string; readonly fromSeq: number }[];
  /** Pending members that were present but not of the expected shape (dropped). */
  readonly malformed: readonly string[];
}

const FAILURE_CLASSES: readonly string[] = ['TAMPERED', 'CORRUPT', 'MISSING', 'UNREADABLE'];
const CHECK_STATUSES: readonly string[] = ['PASS', 'FAIL', 'SKIPPED'];
const SKIP_REASONS: readonly string[] = ['BLOCKED', 'KEY_UNAVAILABLE', 'OUT_OF_SCOPE'];
const SOURCE_CLASSES: readonly string[] = ['PRODUCTION', 'LOCAL_DEVICE', 'FAKE'];
const MAX_INTERVALS = 4096;
const MAX_NOTICES = 8;
const NOTICE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;
const CHECK_ID = /^V-\d{2}$/;
/** The largest report this reader walks (a hostile or broken answer must not be drawn at any length). */
const MAX_CHECKS = 32;
const MAX_FINDINGS = 64;
const MAX_FRAGMENTS = 256;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 96): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null);
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const failureClass = (value: unknown): V2FailureClass | null => (typeof value === 'string' && FAILURE_CLASSES.includes(value) ? (value as V2FailureClass) : null);

function readFile(value: unknown): V2FileRow | null {
  if (!isRecord(value)) return null;
  const trackId = text(value.trackId);
  if (trackId === null) return null;
  const storedOk = value.storedOk === true;
  const plainOk = value.plainOk === true;
  const chainOk = value.chainOk === true;
  return {
    fileId: text(value.fileId) ?? trackId,
    trackId,
    // A file row passes only when the Core says so AND its three parts do.
    ok: value.ok === true && storedOk && plainOk && chainOk,
    storedOk,
    plainOk,
    chainOk,
    fragmentCount: whole(value.fragmentCount),
    ...(value.plainChecked === false ? { plainChecked: false as const } : {}),
  };
}

function readFinding(value: unknown): V2Finding | null {
  if (!isRecord(value)) return null;
  const code = text(value.code);
  if (code === null) return null;
  return {
    code,
    failureClass: failureClass(value.failureClass),
    trackId: text(value.trackId),
    seq: whole(value.seq),
    file: text(value.file, 256),
    member: text(value.member, 256),
    revisionNo: whole(value.revisionNo),
  };
}

function readCheck(value: unknown): V2Check | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 8);
  if (id === null || !CHECK_ID.test(id)) return null;
  if (typeof value.status !== 'string' || !CHECK_STATUSES.includes(value.status)) return null;
  const findings = Array.isArray(value.findings)
    ? value.findings
        .slice(0, MAX_FINDINGS)
        .map(readFinding)
        .filter((finding): finding is V2Finding => finding !== null)
    : [];
  return {
    id,
    status: value.status as V2CheckStatus,
    failureClass: failureClass(value.failureClass),
    skipped: typeof value.skipped === 'string' && SKIP_REASONS.includes(value.skipped) ? (value.skipped as V2SkipReason) : null,
    findings,
  };
}

/** The report, or null when it is absent; `false` when it is present but unusable. */
function readChecks(value: unknown): readonly V2Check[] | null | false {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CHECKS) return false;
  const checks = value.map(readCheck);
  // One unreadable entry makes the whole report unusable: a list with a hole could hide a failure.
  if (checks.some((check) => check === null)) return false;
  const ids = new Set(checks.map((check) => check?.id));
  return ids.size === checks.length ? (checks as V2Check[]) : false;
}

const FRAGMENT_STORED_CODES: readonly string[] = ['FRAGMENT_HASH_MISMATCH', 'FRAGMENT_BYTES_TRUNCATED', 'FRAGMENT_TAMPERED', 'STORED_BYTES_INCONSISTENT'];

interface FragmentDraft {
  trackId: string;
  seq: number;
  reason: V2FailureClass | null;
  storedMismatch: boolean;
}

function fragmentsOf(checks: readonly V2Check[] | null, listed: unknown, malformed: string[]): Pick<VerifyV2Answer, 'failedFragments' | 'chainBreaks'> {
  const drafts = new Map<string, FragmentDraft>();
  const chainFrom = new Map<string, number>();
  const put = (trackId: string, seq: number, reason: V2FailureClass | null, storedMismatch: boolean) => {
    const key = `${trackId}#${seq}`;
    const held = drafts.get(key);
    if (held === undefined) drafts.set(key, { trackId, seq, reason, storedMismatch });
    else {
      // TAMPERED is the gravest class (spec §D); a class once known is never lost.
      if (reason === 'TAMPERED' || held.reason === null) held.reason = reason ?? held.reason;
      held.storedMismatch ||= storedMismatch;
    }
  };
  for (const check of checks ?? []) {
    if (check.status !== 'FAIL') continue;
    for (const finding of check.findings) {
      if (finding.trackId === null || finding.seq === null || finding.seq < 1) continue;
      if (finding.code === 'CHAIN_BROKEN') {
        const held = chainFrom.get(finding.trackId);
        if (held === undefined || finding.seq < held) chainFrom.set(finding.trackId, finding.seq);
      } else if (FRAGMENT_STORED_CODES.includes(finding.code)) {
        put(finding.trackId, finding.seq, finding.failureClass, finding.code !== 'STORED_BYTES_INCONSISTENT');
      }
    }
  }
  if (listed !== undefined && listed !== null) {
    if (!Array.isArray(listed) || listed.length > MAX_FRAGMENTS) malformed.push('fragments');
    else {
      for (const entry of listed) {
        const trackId = isRecord(entry) ? text(entry.trackId) : null;
        const seq = isRecord(entry) ? whole(entry.seq) : null;
        if (!isRecord(entry) || trackId === null || seq === null || seq < 1) {
          malformed.push('fragments');
          break;
        }
        put(trackId, seq, failureClass(entry.reason), entry.storedOk === false);
      }
    }
  }
  const failedFragments = [...drafts.values()]
    .sort((a, b) => (a.trackId === b.trackId ? a.seq - b.seq : a.trackId < b.trackId ? -1 : 1))
    .map((draft) => {
      const from = chainFrom.get(draft.trackId);
      return { ...draft, chainBrokenFromSeq: from === undefined ? null : from };
    });
  const withFragment = new Set(failedFragments.map((fragment) => fragment.trackId));
  const chainBreaks = [...chainFrom.entries()]
    .filter(([trackId]) => !withFragment.has(trackId))
    .map(([trackId, fromSeq]) => ({ trackId, fromSeq }))
    .sort((a, b) => (a.trackId < b.trackId ? -1 : 1));
  return { failedFragments, chainBreaks };
}

const NOT_TRUSTWORTHY_SOURCES: V2Sources = { state: 'NOT_TRUSTWORTHY', tracks: [], audioIntervals: [] };
const sourceClass = (value: unknown): V2SourceClass | null => (typeof value === 'string' && SOURCE_CLASSES.includes(value) ? (value as V2SourceClass) : null);

/**
 * The `sources` block (R-11). `null`: absent. A block this reader cannot read whole is NOT
 * TRUSTWORTHY and named in `malformed`: an entry that is dropped could be the development one.
 */
function readSources(value: unknown, malformed: string[]): V2Sources | null {
  if (value === undefined) return null;
  const broken = (): V2Sources => {
    malformed.push('sources');
    return NOT_TRUSTWORTHY_SOURCES;
  };
  if (!isRecord(value)) return broken();
  const { code, development } = value;
  if (code === 'NOT_TRUSTWORTHY' || code === 'UNKNOWN') return development === null ? NOT_TRUSTWORTHY_SOURCES : broken();
  // Stated only when the code and the recomputed boolean agree; `null` is never production.
  const state: V2SourcesState | null = code === 'DEVELOPMENT' && development === true ? 'DEVELOPMENT' : code === 'DECLARED_PRODUCTION' && development === false ? 'DECLARED_PRODUCTION' : null;
  if (state === null || !Array.isArray(value.tracks) || value.tracks.length > 2 || !Array.isArray(value.audioIntervals) || value.audioIntervals.length > MAX_INTERVALS) return broken();
  const tracks: V2Sources['tracks'][number][] = [];
  for (const entry of value.tracks) {
    const trackId = isRecord(entry) ? text(entry.trackId) : null;
    const deviceId = isRecord(entry) ? text(entry.deviceId, 64) : null;
    const held = isRecord(entry) ? sourceClass(entry.sourceClass) : null;
    if (trackId === null || deviceId === null || held === null) return broken();
    tracks.push({ trackId, deviceId, sourceClass: held });
  }
  const audioIntervals: V2Sources['audioIntervals'][number][] = [];
  for (const entry of value.audioIntervals) {
    const seq = isRecord(entry) ? whole(entry.seq) : null;
    const micDeviceId = isRecord(entry) ? text(entry.micDeviceId, 64) : null;
    const held = isRecord(entry) ? sourceClass(entry.sourceClass) : null;
    if (seq === null || micDeviceId === null || held === null) return broken();
    audioIntervals.push({ seq, micDeviceId, sourceClass: held });
  }
  // A block that says "production" while it lists a development class contradicts itself.
  const listsDevelopment = [...tracks, ...audioIntervals].some((entry) => entry.sourceClass !== 'PRODUCTION');
  if (listsDevelopment !== (state === 'DEVELOPMENT')) return broken();
  return { state, tracks, audioIntervals };
}

/**
 * Reads an answer of operation 41. `null`: not a v2 answer (it has no `files` member), the caller
 * keeps the v1 view.
 */
export function readVerifyV2(answer: unknown): VerifyV2Answer | null {
  if (!isRecord(answer) || !Array.isArray(answer.files)) return null;
  const malformed: string[] = [];
  const files: V2FileRow[] = [];
  let filesBroken = false;
  for (const entry of answer.files) {
    const row = readFile(entry);
    if (row === null) filesBroken = true;
    else files.push(row);
  }

  const checksRead = readChecks(answer.checks);
  if (checksRead === false) malformed.push('checks');
  const checks = checksRead === false ? null : checksRead;

  let overall: V2Overall | null = null;
  if (answer.overall !== undefined && answer.overall !== null) {
    if (answer.overall === 'PASS' || failureClass(answer.overall) !== null) overall = answer.overall as V2Overall;
    else malformed.push('overall');
  }
  let interrupted: boolean | null = null;
  if (answer.interrupted !== undefined && answer.interrupted !== null) {
    if (typeof answer.interrupted === 'boolean') interrupted = answer.interrupted;
    else malformed.push('interrupted');
  }
  let transcriptState: V2TranscriptState | null = null;
  if (answer.transcriptState !== undefined && answer.transcriptState !== null) {
    const code = isRecord(answer.transcriptState) ? answer.transcriptState.code : null;
    if (typeof code === 'string' && (V2_TRANSCRIPT_STATES as readonly string[]).includes(code)) transcriptState = code as V2TranscriptState;
    else malformed.push('transcriptState');
  }
  const sources = readSources(answer.sources, malformed);
  // R88-07: the signing key. A member that is there and unreadable is NOT "no development key".
  let signingKey: V2SigningKey | null = null;
  if (answer.signature !== undefined) {
    const held = isRecord(answer.signature) ? answer.signature.developmentKey : undefined;
    if (held === true) signingKey = 'DEVELOPMENT';
    else if (held === false) signingKey = 'NOT_DEVELOPMENT';
    else {
      signingKey = 'NOT_ESTABLISHED';
      if (held !== null) malformed.push('signature');
    }
  }
  // R88-06: the notices, each with the Core's own line. An entry that cannot be read is named, not guessed.
  const notices: V2Notice[] = [];
  if (answer.notices !== undefined) {
    if (!Array.isArray(answer.notices) || answer.notices.length > MAX_NOTICES) malformed.push('notices');
    else {
      for (const entry of answer.notices) {
        const code = isRecord(entry) && typeof entry.code === 'string' && NOTICE_CODE.test(entry.code) ? entry.code : null;
        const report = isRecord(entry) ? text(entry.report, 256) : null;
        if (code === null || report === null) malformed.push('notices');
        else notices.push({ code, report });
      }
    }
  }
  let failedFragmentCount: number | null = null;
  if (answer.failedFragmentCount !== undefined && answer.failedFragmentCount !== null) {
    failedFragmentCount = whole(answer.failedFragmentCount);
    if (failedFragmentCount === null) malformed.push('failedFragmentCount');
  }

  return {
    // A file entry that cannot be read is a contract break: never a pass.
    verdict: answer.ok === true && !filesBroken ? 'PASS' : 'FAIL',
    at: typeof answer.at === 'number' && Number.isFinite(answer.at) ? answer.at : null,
    files,
    transcriptOk: typeof answer.transcriptOk === 'boolean' ? answer.transcriptOk : null,
    manifestOk: answer.manifestOk === true,
    signatureOk: answer.signatureOk === true,
    overall,
    interrupted,
    checks,
    transcriptState,
    sources,
    signingKey,
    notices,
    failedFragmentCount,
    ...fragmentsOf(checks, answer.fragments, malformed),
    malformed: [...new Set(malformed)],
  };
}

/**
 * THE verdict mapping of the verify view (negative control of row 87: a FAIL must never draw as
 * passed). A v2 answer: the reader's verdict (PASS only for `ok === true` with readable file
 * rows). A v1 answer: PASS only for the boolean `true`.
 */
export function verdictOfAnswer(result: unknown, v2: VerifyV2Answer | null): V2Verdict {
  if (v2 !== null) return v2.verdict;
  return isRecord(result) && result.ok === true ? 'PASS' : 'FAIL';
}

// ── What the view draws ─────────────────────────────────────────────────────────────────────────

export type V2RowId = `file:${string}` | 'transcript' | 'manifest' | 'signature';

/** One row of the v2 result: a camera file, the transcript, the manifest, the signature. */
export interface V2Row {
  readonly id: V2RowId;
  readonly ok: boolean;
  /** A camera file only. */
  readonly file: V2FileRow | null;
}

/** The rows of today's contract, in a fixed order. The transcript row exists only when the answer judges one. */
/**
 * How ONE part of a camera file's row is worded (fix wave K, G89b-06). The file row has three
 * parts and each belongs to one check of the same result: stored bytes = V-04, decrypted bytes =
 * V-05, fragment chain = V-06. A part whose check the verifier did NOT RUN (`SKIPPED`: an earlier
 * check failed, no session key, outside the run) was not checked - it reads "Not run", never FAIL:
 * a skipped V-05 is not a failure of the plaintext (ev D). Without a check list, or with the check
 * run, the row's own flag decides as before. The file row can also say so itself
 * (`plainChecked === false`, PE-WK-46): that is per FILE, so it decides the decrypted-bytes part
 * first, before the result's check list (the web reads it the same way).
 */
export type V2FilePart = 'stored' | 'plain' | 'chain';
export const V2_FILE_PART_CHECK = { stored: 'V-04', plain: 'V-05', chain: 'V-06' } as const satisfies Record<V2FilePart, V2KnownCheckId>;
export type V2PartOutcome = 'PASS' | 'FAIL' | 'SKIPPED';

export function v2FilePartOutcome(file: Pick<V2FileRow, 'storedOk' | 'plainOk' | 'chainOk' | 'plainChecked'>, part: V2FilePart, checks: readonly Pick<V2Check, 'id' | 'status'>[] | null): V2PartOutcome {
  const ok = part === 'stored' ? file.storedOk : part === 'plain' ? file.plainOk : file.chainOk;
  if (ok) return 'PASS';
  if (part === 'plain' && file.plainChecked === false) return 'SKIPPED';
  const check = checks?.find((entry) => entry.id === V2_FILE_PART_CHECK[part]) ?? null;
  return check !== null && check.status === 'SKIPPED' ? 'SKIPPED' : 'FAIL';
}

export function v2Rows(answer: VerifyV2Answer): V2Row[] {
  const rows: V2Row[] = answer.files.map((file) => ({ id: `file:${file.trackId}`, ok: file.ok, file }));
  if (answer.transcriptOk !== null) rows.push({ id: 'transcript', ok: answer.transcriptOk, file: null });
  rows.push({ id: 'manifest', ok: answer.manifestOk, file: null }, { id: 'signature', ok: answer.signatureOk, file: null });
  return rows;
}

/** The rows that failed, as short names for the toast ("VIDEO-02", "Manifest"). */
export function v2FailedNames(answer: VerifyV2Answer, t: TFunction): string[] {
  return v2Rows(answer)
    .filter((row) => !row.ok)
    .map((row) => (row.file ? row.file.trackId : t(`evidence.verifyV2.rows.${row.id as 'transcript' | 'manifest' | 'signature'}`)));
}

/**
 * The sentence naming one failed fragment (spec §F.3: "VIDEO-02 fragment 3 tampered (stored-bytes
 * hash mismatch; chain broken from fragment 3)"). "tampered" is said only for the class TAMPERED.
 */
export function v2FragmentLine(fragment: V2FailedFragment, t: TFunction): string {
  const place = { track: fragment.trackId, seq: fragment.seq };
  if (fragment.reason !== 'TAMPERED') {
    const reason = fragment.reason === null ? t('evidence.verifyV2.outcome.FAIL') : t(`evidence.verifyV2.failureClass.${fragment.reason}`);
    return t('evidence.verifyV2.fragment.failed', { ...place, reason });
  }
  if (fragment.storedMismatch && fragment.chainBrokenFromSeq !== null) return t('evidence.verifyV2.fragment.tampered', { ...place, from: fragment.chainBrokenFromSeq });
  if (fragment.storedMismatch) return t('evidence.verifyV2.fragment.tamperedNoChain', place);
  return t('evidence.verifyV2.fragment.tamperedOther', place);
}

/** The key of the signing-key line (fix pass F-M7, R88-07); `NOT_DEVELOPMENT` has none: nothing is drawn. */
export const V2_SIGNING_KEY_LINE = {
  DEVELOPMENT: 'evidence.verifyV2Key.development',
  NOT_ESTABLISHED: 'evidence.verifyV2Key.notEstablished',
} as const satisfies Record<Exclude<V2SigningKey, 'NOT_DEVELOPMENT'>, string>;

/** The key of the source line, the FIRST line of a v2 result (spec §D.1; `common.sourceClass.verify`). */
export const V2_SOURCES_LINE = {
  DEVELOPMENT: 'common.sourceClass.verify.development',
  DECLARED_PRODUCTION: 'common.sourceClass.verify.production',
  NOT_TRUSTWORTHY: 'common.sourceClass.verify.untrusted',
} as const satisfies Record<V2SourcesState, string>;

/** The name of a check: the verifier's wording for V-01 to V-15, the bare ID for any other. */
export function v2CheckName(id: string, t: TFunction): string {
  return (V2_KNOWN_CHECK_IDS as readonly string[]).includes(id) ? `${id} · ${t(`evidence.verifyV2.checks.${id as V2KnownCheckId}`)}` : id;
}
