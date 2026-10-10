/**
 * THE PASS RULES OF A KILL-MATRIX CELL, as pure functions over what the harness READ (rows, file
 * names, the manifest, the answer of operation 41). Each returns the list of what is wrong; an
 * empty list is a pass. Nothing here reads a file or a table, so every rule has a failing control
 * in `cells.test.ts`.
 */
import type { SealingStepId } from '../../pipeline/contract';
import { SEALING_STEP_ORDER } from '../../pipeline/contract';
import type { Expectation, KillPoint } from './cells';

export interface JobRow {
  readonly step: string;
  readonly status: string;
  readonly attempt: number;
  readonly checkpoint: unknown;
}

export interface FragmentRow {
  readonly trackId: string;
  readonly seq: number;
  readonly sha256: string;
}

export interface ManifestView {
  readonly interrupted: boolean;
  readonly tracks: readonly { readonly trackId: string; readonly bytes: number; readonly sha256Plain: string; readonly fragmentCount: number }[];
  readonly files: readonly { readonly trackId: string; readonly fragments: readonly { readonly seq: number; readonly sha256Plain: string; readonly interrupted: boolean }[] }[];
}

export interface VerifyView {
  readonly statusCode: number;
  readonly ok: unknown;
  readonly overall: unknown;
  readonly interrupted: unknown;
  readonly checks: readonly { readonly id: string; readonly status: string }[];
}

/** The journal at the moment a process died at `point`: what must be there for the kill to be the one the cell names. */
export function judgeKillPoint(point: KillPoint, rows: readonly JobRow[]): string[] {
  const wrong: string[] = [];
  const index = SEALING_STEP_ORDER.indexOf(point.step);
  const row = rows.find((entry) => entry.step === point.step);
  for (const earlier of SEALING_STEP_ORDER.slice(0, index)) {
    if (rows.find((entry) => entry.step === earlier)?.status !== 'DONE') wrong.push(`${earlier} is not DONE at a kill in ${point.step}`);
  }
  for (const later of SEALING_STEP_ORDER.slice(index + 1)) {
    if (rows.some((entry) => entry.step === later)) wrong.push(`${later} has a row at a kill in ${point.step}`);
  }
  if (point.phase === 'AFTER_CHECKPOINT' && row?.status !== 'DONE') wrong.push(`${point.step} is ${row?.status ?? 'absent'}, not DONE, after its checkpoint`);
  // A step that writes no RUNNING row before its DONE row (the transcript step of a session without STT) has no row yet.
  if (point.phase === 'AFTER_WORK' && row !== undefined && row.status !== 'RUNNING') wrong.push(`${point.step} is ${row.status}, not RUNNING, before its checkpoint`);
  if (point.phase === 'BEFORE' && row !== undefined && row.status === 'DONE') wrong.push(`${point.step} is DONE before it started`);
  return wrong;
}

/** The journal of a sealed session: six rows, all DONE, the attempts as the kills make them. */
export function judgeSealedJobs(rows: readonly JobRow[], sealRuns: number): string[] {
  const wrong: string[] = [];
  const steps = rows.map((row) => row.step).sort();
  if (JSON.stringify(steps) !== JSON.stringify([...SEALING_STEP_ORDER].sort())) wrong.push(`the journal holds ${steps.join(', ') || 'no row'}, not the six steps`);
  for (const row of rows) {
    if (row.status !== 'DONE') wrong.push(`${row.step} is ${row.status}`);
    if (row.attempt < 1 || row.attempt > sealRuns) wrong.push(`${row.step} says attempt ${row.attempt} after ${sealRuns} run(s)`);
  }
  const last = rows.find((row) => row.step === SEALING_STEP_ORDER[SEALING_STEP_ORDER.length - 1]);
  if (last !== undefined && last.attempt !== sealRuns) wrong.push(`the last step says attempt ${last.attempt}: the session was sealed by run ${last.attempt}, the harness started ${sealRuns}`);
  return wrong;
}

/** Every member of `frozen` is in `final` with the same value (the checkpoint a killed run froze is the one the next run finished with). */
export function judgeFrozenKept(step: SealingStepId, frozen: unknown, final: unknown): string[] {
  if (frozen === null || typeof frozen !== 'object') return [];
  if (final === null || typeof final !== 'object') return [`${step}: the finished row has no checkpoint`];
  return Object.entries(frozen as Record<string, unknown>)
    .filter(([key, value]) => JSON.stringify((final as Record<string, unknown>)[key]) !== JSON.stringify(value))
    .map(([key]) => `${step}: the checkpoint member ${key} of the killed run is not the finished run's`);
}

/** The sealed plaintext against what the recorder wrote down fragment by fragment, and against a copy of the recording when one was taken. */
export function judgeMediaReference(manifest: ManifestView, rows: readonly FragmentRow[], rowsAtKill: Readonly<Record<string, number>> | null, recordingPrefixSha256: Readonly<Record<string, string>> | null): string[] {
  const wrong: string[] = [];
  for (const file of manifest.files) {
    const recorded = rows.filter((row) => row.trackId === file.trackId).sort((left, right) => left.seq - right.seq);
    if (file.fragments.length === 0) wrong.push(`${file.trackId} is sealed with no fragment`);
    if (recorded.length !== file.fragments.length) wrong.push(`${file.trackId}: ${file.fragments.length} sealed fragments, ${recorded.length} recorded rows`);
    file.fragments.forEach((fragment, index) => {
      if (recorded[index]?.seq !== fragment.seq || recorded[index]?.sha256 !== fragment.sha256Plain) wrong.push(`${file.trackId} fragment ${fragment.seq}: the sealed plaintext digest is not the recorded one`);
      if (fragment.interrupted !== manifest.interrupted) wrong.push(`${file.trackId} fragment ${fragment.seq}: interrupted ${fragment.interrupted}, the timeline says ${manifest.interrupted}`);
    });
    const track = manifest.tracks.find((entry) => entry.trackId === file.trackId);
    if (track === undefined || track.fragmentCount !== file.fragments.length) wrong.push(`${file.trackId}: the track record counts ${track?.fragmentCount ?? 'nothing'}, the file ${file.fragments.length}`);
    // Nothing the recorder had written down before the kill is missing from the seal (the durable prefix is never shortened).
    if (rowsAtKill !== null && file.fragments.length < (rowsAtKill[file.trackId] ?? 0)) wrong.push(`${file.trackId}: ${rowsAtKill[file.trackId]} fragments were durable at the kill, ${file.fragments.length} are sealed`);
    if (recordingPrefixSha256 !== null && track !== undefined && recordingPrefixSha256[file.trackId] !== track.sha256Plain) wrong.push(`${file.trackId}: the sealed plaintext is not the first ${track.bytes} bytes of the recording`);
  }
  if (manifest.files.length !== 2) wrong.push(`${manifest.files.length} camera files in the manifest, not 2`);
  return wrong;
}

/** Operation 41 on the sealed package: PASS, the interrupted flag as the cell expects, 15 checks, none failed. */
export function judgeVerify(expectation: Exclude<Expectation, 'FAILED_START'>, verify: VerifyView): string[] {
  const wrong: string[] = [];
  const interrupted = expectation === 'SEALED_INTERRUPTED';
  if (verify.statusCode !== 200) wrong.push(`verify answered ${verify.statusCode}`);
  if (verify.ok !== true || verify.overall !== 'PASS') wrong.push(`verify says ok ${String(verify.ok)}, overall ${String(verify.overall)}`);
  if (verify.interrupted !== interrupted) wrong.push(`verify says interrupted ${String(verify.interrupted)}, expected ${interrupted}`);
  if (verify.checks.length !== 15) wrong.push(`verify ran ${verify.checks.length} checks, not 15`);
  for (const check of verify.checks) if (check.status === 'FAIL') wrong.push(`verify check ${check.id} failed`);
  return wrong;
}

export interface FolderView {
  /** Names in `SESSION-<id>/`. */
  readonly top: readonly string[];
  /** Names in `SESSION-<id>/fragments/`, or null when the folder is not there. */
  readonly fragments: readonly string[] | null;
}

const SEALED_TOP = ['audit-session-extract.jsonl', 'device-certificate.pem', 'fragments', 'session-manifest.json', 'signature.sig'];
const SEALED_FRAGMENTS = ['VIDEO-01.mp4', 'VIDEO-02.mp4', 'fragments.json'];

/** A sealed package folder without a transcript document: exactly the declared files, no plaintext recording, no half-written file. */
export function judgeSealedFolder(folder: FolderView): string[] {
  const wrong: string[] = [];
  if (JSON.stringify([...folder.top].sort()) !== JSON.stringify(SEALED_TOP)) wrong.push(`the package folder holds ${[...folder.top].sort().join(', ')}`);
  if (JSON.stringify([...(folder.fragments ?? [])].sort()) !== JSON.stringify(SEALED_FRAGMENTS)) wrong.push(`fragments/ holds ${[...(folder.fragments ?? [])].sort().join(', ') || 'nothing'}`);
  return wrong;
}

/** A failed start (D84, D89 (b)): nothing sealed, nothing half-sealed, the start records kept. */
export function judgeFailedStart(view: { readonly items: number; readonly jobs: number; readonly sourceRows: number; readonly folder: FolderView | null; readonly armedProcessKilled: boolean | null }): string[] {
  const wrong: string[] = [];
  if (view.items !== 0) wrong.push(`${view.items} evidence item(s) after a failed start`);
  if (view.jobs !== 0) wrong.push(`${view.jobs} row(s) of sealing_jobs after a failed start: a sealing step was entered`);
  if (view.sourceRows !== 4) wrong.push(`${view.sourceRows} start records, not 4`);
  if (view.folder !== null) {
    if (view.folder.fragments !== null) wrong.push('a fragments/ folder exists after a failed start');
    for (const name of view.folder.top) if (['session-manifest.json', 'signature.sig', 'device-certificate.pem'].includes(name)) wrong.push(`${name} exists after a failed start`);
  }
  if (view.armedProcessKilled === true) wrong.push('the armed process was killed: recovery reached the sealing step');
  return wrong;
}
