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
 * 2. PENDING MEMBERS, not in the schema yet (requests of rows 85 and 119 in
 *    `delegation_progress/file_requests.md`; shapes = `PackageVerifyResult` of
 *    `@dems/shared/evidence-verify`): `overall`, `interrupted`, `checks[]` (the per-check report
 *    with its findings), `fragments[]`, `transcriptState`. Absent = `null` = the view shows nothing
 *    extra. A member that is present but malformed is dropped, named in `malformed`, and never
 *    guessed. TO WIRE when the op 41 schema gains them: nothing in this file — the client parses
 *    the answer with the registry schema (CL-4), so the members arrive here as soon as it does.
 *
 * SLOT for row 141 (V-15 and the `sources` block): a check with an ID this reader does not know is
 * kept and drawn by its ID, so a fifteenth check is never hidden; `sources` is not read here.
 *
 * The verdict is the Core's `ok` and nothing else: no row, check or finding is ever combined into
 * it, and `ok` is PASS only for the boolean `true`.
 */
import type { TFunction } from 'i18next';
import { en } from '@dems/shared/i18n';

export type V2Verdict = 'PASS' | 'FAIL';
export type V2FailureClass = 'TAMPERED' | 'CORRUPT' | 'MISSING' | 'UNREADABLE';
export type V2CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';
export type V2SkipReason = 'BLOCKED' | 'KEY_UNAVAILABLE';
export type V2Overall = 'PASS' | V2FailureClass;

/**
 * The seven codes of `VerifiedTranscriptState` (row 119). The list is the key set of this view's own
 * wording (`evidence.verifyV2.transcriptState`), which a test holds equal to the verifier's table
 * (`TRANSCRIPT_STATE_REPORT`): a code is known here exactly when it has a line to show. The verifier
 * module itself is not imported at run time (it would bring the package schemas into the bundle).
 */
export type V2TranscriptState = keyof typeof en.evidence.verifyV2.transcriptState;
export const V2_TRANSCRIPT_STATES = Object.keys(en.evidence.verifyV2.transcriptState) as readonly V2TranscriptState[];

/** The 14 checks this row words (spec §D); V-15 is row 141's. */
export const V2_KNOWN_CHECK_IDS = ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14'] as const;
export type V2KnownCheckId = (typeof V2_KNOWN_CHECK_IDS)[number];

export interface V2FileRow {
  readonly fileId: string;
  readonly trackId: string;
  readonly ok: boolean;
  readonly storedOk: boolean;
  readonly plainOk: boolean;
  readonly chainOk: boolean;
  readonly fragmentCount: number | null;
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

export interface VerifyV2Answer {
  /** The Core's verdict: PASS only for `ok === true`. */
  readonly verdict: V2Verdict;
  readonly at: number | null;
  readonly files: readonly V2FileRow[];
  /** null: the answer has no transcript check (an item without a transcript document). */
  readonly transcriptOk: boolean | null;
  readonly manifestOk: boolean;
  readonly signatureOk: boolean;
  // ── Pending members: null = the answer does not carry it ──
  readonly overall: V2Overall | null;
  readonly interrupted: boolean | null;
  readonly checks: readonly V2Check[] | null;
  readonly transcriptState: V2TranscriptState | null;
  /** Every fragment the answer names as failed (from `fragments[]` and the findings); empty when it names none. */
  readonly failedFragments: readonly V2FailedFragment[];
  /** A chain break named for a file without a failed fragment of its own. */
  readonly chainBreaks: readonly { readonly trackId: string; readonly fromSeq: number }[];
  /** Pending members that were present but not of the expected shape (dropped). */
  readonly malformed: readonly string[];
}

const FAILURE_CLASSES: readonly string[] = ['TAMPERED', 'CORRUPT', 'MISSING', 'UNREADABLE'];
const CHECK_STATUSES: readonly string[] = ['PASS', 'FAIL', 'SKIPPED'];
const SKIP_REASONS: readonly string[] = ['BLOCKED', 'KEY_UNAVAILABLE'];
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

/** The name of a check: this row's wording for V-01 to V-14, the bare ID for any other (row 141's slot). */
export function v2CheckName(id: string, t: TFunction): string {
  return (V2_KNOWN_CHECK_IDS as readonly string[]).includes(id) ? `${id} · ${t(`evidence.verifyV2.checks.${id as V2KnownCheckId}`)}` : id;
}
