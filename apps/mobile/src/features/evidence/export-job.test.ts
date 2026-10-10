// Blueprint row 92 (M8-W3): the pure rules of the background export job (operations 42 and 87) and
// of the transcript pane (operations 84 to 86). The web console holds the same cases, and the
// screens on the Live bed, for its own copies.
import { describe, expect, it } from '@jest/globals';
import { COMPOSITE_NOT_SELECTED, answeredJobIdOf, exportJobIdOf, forwardProgress, isTerminalJob, readExportJob } from './export-job-model';
import {
  REVISION_TEXT_MAX,
  currentRevisionNumber,
  deriveSegments,
  paneStateOf,
  readRefusalOf,
  readTranscriptDocument,
  readTranscriptRevisions,
  reviseRefusalOf,
  revisionNoteOk,
  revisionRequestOf,
  validateRevisionText,
} from './transcript-model';

const H = (char: string): string => char.repeat(64);
const JOB = { jobId: 'EXPJ-000032', evidenceId: 'EV-20261009-0001', kind: 'PACKAGE', status: 'RUNNING', progressPct: 40, etaMs: null, derived: false, createdAt: 1_790_824_500_000 };
const SEGMENTS = [
  { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: null },
  { index: 1, startMs: 4_600, endMs: 8_100, text: 'Baik, saya Ahmad Fauzi.', speaker: null },
];
const DOCUMENT = { documentVersion: 'dems.transcript/1', language: 'id', speakerState: 'UNAVAILABLE', segments: SEGMENTS, sha256: H('a'), machineTranscriptHash: H('b'), assembledAt: 1_790_823_600_000, revision: 0 };
const revision = (number: number, to: string) => ({
  revisionId: `TRV-00000${number}`,
  number,
  authorId: 'OPR-001',
  baseRevision: number - 1,
  machineTranscriptHash: H('b'),
  signedBy: 'KEY-EVSIGN-01',
  signature: { value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
  createdAt: 1_790_824_500_000,
  changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to }],
});

describe('the export job', () => {
  it('the job ID of an export; a job answer is read defensively; a composite is always derived', () => {
    expect(exportJobIdOf('EXP-000032')).toBe('EXPJ-000032');
    for (const id of ['EXPJ-000032', 'EXP-32', '']) expect(exportJobIdOf(id)).toBeNull();
    // Pass D5: the job the 202 names wins when it is one; anything else falls back to the rule.
    expect(exportJobIdOf('EXP-000032', 'EXPJ-000777')).toBe('EXPJ-000777');
    for (const answered of [undefined, null, 'EXP-000777', 'EXPJ-7', 7]) expect(exportJobIdOf('EXP-000032', answered)).toBe('EXPJ-000032');
    expect(answeredJobIdOf({ ok: true, status: 202, exportId: 'EXP-000032', jobId: 'EXPJ-000777' })).toBe('EXPJ-000777');
    expect(answeredJobIdOf({ ok: true, status: 202, exportId: 'EXP-000032' })).toBeNull();
    expect(readExportJob(JOB)).toEqual({ jobId: 'EXPJ-000032', evidenceId: 'EV-20261009-0001', kind: 'PACKAGE', status: 'RUNNING', progressPct: 40, derived: false, manifestHash: null, signature: null, failureReason: null });
    for (const bad of [null, [], { ...JOB, status: 'DONE' }, { ...JOB, jobId: 'EXP-000032' }]) expect(readExportJob(bad)).toBeNull();
    expect(readExportJob({ ...JOB, kind: 'COMPOSITE', derived: false })?.derived).toBe(true);
    expect(readExportJob({ ...JOB, status: 'FAILED', failureReason: COMPOSITE_NOT_SELECTED })?.failureReason).toBe('COMPOSITE_ENCODER_NOT_SELECTED');
    expect(readExportJob({ ...JOB, failureReason: 'X_Y' })?.failureReason).toBeNull();
  });

  it('progress only moves forward; COMPLETE is 100; a job is finished at COMPLETE and at FAILED', () => {
    expect(forwardProgress(40, { status: 'RUNNING', progressPct: 20 })).toBe(40);
    expect(forwardProgress(40, { status: 'RUNNING', progressPct: 55 })).toBe(55);
    expect(forwardProgress(40, { status: 'COMPLETE', progressPct: 0 })).toBe(100);
    expect(forwardProgress(40, { status: 'FAILED', progressPct: 10 })).toBe(40);
    expect([isTerminalJob({ status: 'QUEUED' }), isTerminalJob({ status: 'RUNNING' }), isTerminalJob({ status: 'COMPLETE' }), isTerminalJob({ status: 'FAILED' }), isTerminalJob(null)]).toEqual([false, false, true, true, false]);
  });
});

describe('the transcript', () => {
  it('speaker labels default to UNAVAILABLE; a label is kept only for a LABELLED document', () => {
    const labelled = { ...DOCUMENT, speakerState: 'LABELLED', segments: SEGMENTS.map((segment, index) => ({ ...segment, speaker: `SPEAKER-${index + 1}` })) };
    expect(readTranscriptDocument(labelled)?.segments.map((segment) => segment.speaker)).toEqual(['SPEAKER-1', 'SPEAKER-2']);
    for (const speakerState of ['UNAVAILABLE', 'labelled', undefined, null, true]) {
      const document = readTranscriptDocument({ ...labelled, speakerState });
      expect(document?.speakerState).toBe('UNAVAILABLE');
      expect(document?.segments.map((segment) => segment.speaker)).toEqual([null, null]);
    }
    expect(readTranscriptDocument({ ...DOCUMENT, segments: [...SEGMENTS, { index: 2, startMs: 1 }] })).toBeNull();
    expect(readTranscriptRevisions({ items: [revision(1, 'x'), { number: 2 }] })).toBeNull();
  });

  it('a revision never overwrites the sealed text: the original is returned as read, the newest correction stands beside it', () => {
    const document = readTranscriptDocument(DOCUMENT)!;
    const sealed = JSON.stringify(document);
    const revisions = readTranscriptRevisions({ items: [revision(2, 'Baik, saya Ahmad Fawzi.'), revision(1, 'Baik, saya Ahmad Fausi.')] })!;
    const derived = deriveSegments(document, revisions);
    expect(derived.map((entry) => entry.segment.text)).toEqual(SEGMENTS.map((segment) => segment.text));
    expect(derived.map((entry) => entry.revised)).toEqual([null, { number: 2, authorId: 'OPR-001', text: 'Baik, saya Ahmad Fawzi.' }]);
    expect(derived[1]!.segment).toBe(document.segments[1]);
    expect(JSON.stringify(document)).toBe(sealed);
    expect([currentRevisionNumber(document, revisions), currentRevisionNumber({ revision: 5 }, revisions), currentRevisionNumber(null, [])]).toEqual([2, 5, 0]);
  });

  it('the pane states, the form check, the request and the refusals', () => {
    expect([paneStateOf({ state: 'DISABLED' }, false), paneStateOf({ state: 'READY' }, true), paneStateOf({ state: 'PARTIAL' }, true), paneStateOf({ state: 'PENDING' }, false), paneStateOf(null, true)]).toEqual(['DISABLED', 'ASSEMBLED', 'PARTIAL', 'UNAVAILABLE', 'ASSEMBLED']);
    expect([validateRevisionText('a', 'a'), validateRevisionText('a', 'b'), validateRevisionText('a', 'x'.repeat(REVISION_TEXT_MAX + 1))]).toEqual(['unchanged', null, 'tooLong']);
    expect(revisionRequestOf(3, 1, 'old', 'new', '  why it changed  ')).toEqual({ baseRevision: 3, changes: [{ segmentIndex: 1, from: 'old', to: 'new' }], note: 'why it changed' });
    // Pass D6: the note is REQUIRED (5 to 500 characters after trimming).
    expect(['', '   ', 'abcd', 'x'.repeat(501)].map(revisionNoteOk)).toEqual([false, false, false, false]);
    expect(['abcde', '  why it changed  ', 'x'.repeat(500)].map(revisionNoteOk)).toEqual([true, true, true]);
    expect([reviseRefusalOf(409, 'TRANSCRIPT_REVISION_CONFLICT'), reviseRefusalOf(409, 'TRANSCRIPT_NOT_READY'), reviseRefusalOf(403, 'NOT_PERMITTED'), reviseRefusalOf(null, 'NO_ANSWER')]).toEqual(['CONFLICT', 'NOT_READY', 'DENIED', 'OTHER']);
    expect([readRefusalOf(409, 'TRANSCRIPT_NOT_READY'), readRefusalOf(403, 'NOT_PERMITTED'), readRefusalOf(500, 'INTERNAL_ERROR')]).toEqual(['NOT_READY', 'DENIED', 'FAILED']);
  });
});
