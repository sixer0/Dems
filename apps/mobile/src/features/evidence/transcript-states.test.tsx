// Fix pass F-M6 (code review row 80, finding R80-01): the transcript pane names the state the
// item's summary REPORTS - what the seal signed - and never assumes one. One case per state.
import { describe, expect, it } from '@jest/globals';
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { readItemV2, TRANSCRIPT_MODEL_MEMBER, readTranscriptModel } from './item-v2';
import { transcriptQueryKey, transcriptRevisionsQueryKey } from './transcript';
import { paneStateOf, sealedWithoutDocument, type TranscriptDocument, REVISION_REASON_MEMBER, type TranscriptRevision } from './transcript-model';
import { TranscriptPane } from './transcript-pane';
import { EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE, EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE } from '@dems/shared/api';
import { Stepper } from '@/components/composed/stepper';
import { legendDevelopmentClass } from './audio-source-band';
import { EXPORT_STEPS, initialExportDestination } from './evidence-model';
import { answeredArchiveOnCoreOf } from './export-job-model';
import { readDetailFacts } from './item-facts';
import { V2_FILE_PART_CHECK, v2FilePartOutcome } from './verify-v2';

const EV = 'EV-20261001-0014';
const H = (char: string): string => char.repeat(64);
const DOCUMENT: TranscriptDocument = { speakerState: 'UNAVAILABLE', segments: [{ index: 0, startMs: 0, endMs: 900, text: 'first words', speaker: null }], machineTranscriptHash: H('b'), assembledAt: null, revision: 0 };

/** Puts the two reads of the pane in the cache (when a document is given) before the pane mounts: no request is part of these cases. */
function Seeded({ document, children }: { document: TranscriptDocument | null; children: ReactNode }) {
  const client = useQueryClient();
  if (document !== null && client.getQueryData(transcriptQueryKey(EV, null)) === undefined) {
    client.setQueryData(transcriptQueryKey(EV, null), document);
    client.setQueryData(transcriptRevisionsQueryKey(EV, null), []);
  }
  return <>{children}</>;
}

function pane(transcript: Record<string, unknown> | null, document: TranscriptDocument | null) {
  const test = createTestSim();
  const item = readItemV2({ id: EV, transcriptSha256: transcript?.['sha256'] ?? null, transcript });
  render(
    <RuntimeTestProviders sim={test.sim}>
      <Seeded document={document}>
        <TranscriptPane evidenceId={EV} item={item} operatorNames={{}} />
      </Seeded>
    </RuntimeTestProviders>,
  );
}
const summary = (more: Record<string, unknown>) => ({ sha256: H('b'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0, ...more });

describe('R80-01: the pane state is the summary\'s, never assumed', () => {
  it('the rule: ASSEMBLED only for READY with a document; no summary is UNKNOWN with or without a document', () => {
    expect([paneStateOf({ state: 'READY' }, true), paneStateOf({ state: 'PARTIAL' }, true), paneStateOf({ state: 'PARTIAL' }, false), paneStateOf({ state: 'DISABLED' }, false), paneStateOf(null, true), paneStateOf(null, false)]).toEqual(['ASSEMBLED', 'PARTIAL', 'PARTIAL', 'DISABLED', 'UNKNOWN', 'UNKNOWN']);
    expect([paneStateOf({ state: 'READY' }, false), paneStateOf({ state: 'PENDING' }, true), paneStateOf({ state: 'FAILED' }, true)]).toEqual(['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE']);
    expect([sealedWithoutDocument(null), sealedWithoutDocument({ state: 'DISABLED', sha256: null }), sealedWithoutDocument({ state: 'PARTIAL', sha256: null }), sealedWithoutDocument({ state: 'PARTIAL', sha256: H('b') }), sealedWithoutDocument({ state: 'READY', sha256: H('b') })]).toEqual([false, true, true, false, false]);
  });

  it('ASSEMBLED: a summary that says READY, with its document', () => {
    pane(summary({ state: 'READY', failedChunks: 0, backendUnreachable: false }), DOCUMENT);
    expect(screen.getByTestId('evidence-transcript-ASSEMBLED')).toBeTruthy();
    expect(screen.getByText('Transcript assembled')).toBeTruthy();
    expect(screen.queryByTestId('evidence-transcript-partial')).toBeNull();
  });

  it('PARTIAL with chunks: the parts without text and the unreachable backend are said beside the document', () => {
    pane(summary({ state: 'PARTIAL', failedChunks: 2, backendUnreachable: true }), DOCUMENT);
    expect(screen.getByTestId('evidence-transcript-PARTIAL')).toBeTruthy();
    expect(screen.getByText('Transcript partial')).toBeTruthy();
    expect(screen.getByText(/2 parts of the audio have no text\./)).toBeTruthy();
    expect(screen.getByText(/The transcription backend could not be reached/)).toBeTruthy();
    expect(screen.queryByTestId('evidence-transcript-no-document')).toBeNull();
  });

  it('PARTIAL without a document (unavailable at the seal): PARTIAL and "No transcript was sealed" - never "not available yet", and nothing is loaded', () => {
    pane(summary({ state: 'PARTIAL', sha256: null, machineTranscriptHash: null, labelsStatus: null, failedChunks: 4, backendUnreachable: false }), null);
    expect(screen.getByTestId('evidence-transcript-PARTIAL')).toBeTruthy();
    expect(screen.getByTestId('evidence-transcript-no-document')).toBeTruthy();
    expect(screen.getByText('No transcript was sealed with this recording.')).toBeTruthy();
    expect(screen.queryByText('The transcript is not available yet.')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-loading')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-not-ready')).toBeNull();
  });

  it('DISABLED: the declared absence, and nothing is loaded', () => {
    pane({ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }, null);
    expect(screen.getByTestId('evidence-transcript-DISABLED')).toBeTruthy();
    expect(screen.getByText('Transcript disabled by configuration')).toBeTruthy();
    expect(screen.queryByTestId('evidence-transcript-loading')).toBeNull();
  });

  it('NO SUMMARY: "Transcript state not reported" - the document is shown, and the state is NOT assembled', () => {
    pane(null, DOCUMENT);
    expect(screen.getByTestId('evidence-transcript-UNKNOWN')).toBeTruthy();
    expect(screen.getByText('Transcript state not reported')).toBeTruthy();
    expect(screen.queryByTestId('evidence-transcript-ASSEMBLED')).toBeNull();
    expect(screen.queryByText('Transcript assembled')).toBeNull();
    expect(screen.getByTestId('evidence-transcript-in-package')).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m2-item-facts.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave K, driver M2 - items 4 and 6 of the task. Every member is read BY THE NAME written in
// `delegation_progress/contract_wave_k.md` (S2), and the tests import the contract's own examples.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G81b-06 | The item's `transcriptModel` is shown on the item: a local model with its name, the DECLARED version, the quantisation and the file hash; a server backend with its name and the Core's own sentence (D160) - never a version or a hash | "the transcript model" |
// | G81b-09 | The reason of a revision is drawn in the revision list when the answer states one | "the revision list" |
// | G89b-06 | A part of a camera file's row whose check was SKIPPED reads "Not run", never FAIL | "the file row" |
// | G94b-07 | The band legend marks a development microphone from the item's own interval class, without a verify run | "the band legend" |
// | G94b-06 | `archiveOnCore` of operation 42's answer is read by name | "the accepted export" |
// | G94b-12 | `exportDestinationDefault` of operation 40 is read by name | "the default destination" |
// | G94b-13 | CONTROL: at Complete every badge of the wizard's stepper is `done` and draws its check | "the stepper" |
describe('item facts read by the names of the contract', () => {
const H = (char: string): string => char.repeat(64);
const EV = 'EV-20261001-0014';
const READY = { state: 'READY', sha256: H('a'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0 };
const DOCUMENT: TranscriptDocument = { speakerState: 'UNAVAILABLE', segments: [{ index: 0, startMs: 0, endMs: 900, text: 'first words', speaker: null }], machineTranscriptHash: H('b'), assembledAt: null, revision: 0 };

function Seeded({ revisions, children }: { revisions: readonly TranscriptRevision[]; children: ReactNode }) {
  const client = useQueryClient();
  if (client.getQueryData(transcriptQueryKey(EV, null)) === undefined) {
    client.setQueryData(transcriptQueryKey(EV, null), DOCUMENT);
    client.setQueryData(transcriptRevisionsQueryKey(EV, null), revisions);
  }
  return <>{children}</>;
}
function pane(item: Record<string, unknown>, revisions: readonly TranscriptRevision[] = []) {
  const test = createTestSim();
  render(
    <RuntimeTestProviders sim={test.sim}>
      <Seeded revisions={revisions}>
        <TranscriptPane evidenceId={EV} item={readItemV2({ id: EV, transcriptSha256: H('b'), transcript: READY, ...item })} operatorNames={{}} />
      </Seeded>
    </RuntimeTestProviders>,
  );
}

describe('the transcript model (G81b-06; contract_wave_k.md S2 section 1)', () => {
  it('the member is read by its name; the contract\'s two examples are read whole', () => {
    expect(TRANSCRIPT_MODEL_MEMBER).toBe('transcriptModel');
    expect(readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE)).toEqual(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE);
    expect(readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE)).toEqual(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE);
    expect(readItemV2({ [TRANSCRIPT_MODEL_MEMBER]: EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE }).transcriptModel?.name).toBe(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.name);
    // Absent, or not the contract's shape: NOT STATED - never a default.
    expect(readItemV2({}).transcriptModel).toBeNull();
    expect(readTranscriptModel({ name: 'x' })).toBeNull();
    expect(readTranscriptModel({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, reportedByServer: 'no' })).toBeNull();
    // A hash that is no SHA-256 is not a hash.
    expect(readTranscriptModel({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, modelSha256: 'abc' })?.modelSha256).toBeNull();
  });

  it('a LOCAL model: its name, the version "declared by the installation", the quantisation and the file hash', () => {
    pane({ transcriptModel: EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE });
    const model = EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE;
    expect(screen.getByTestId('evidence-transcript-model-local')).toBeTruthy();
    expect(screen.getByTestId('evidence-transcript-model-name')).toHaveTextContent(`Name: ${model.name}`);
    expect(screen.getByTestId('evidence-transcript-model-version')).toHaveTextContent(`Version (declared by the installation): ${model.version}`);
    expect(screen.getByTestId('evidence-transcript-model-quantisation')).toHaveTextContent(`Quantisation: ${model.quantisation}`);
    expect(screen.getByTestId('evidence-transcript-model-hash')).toHaveTextContent(`Model file SHA-256: ${model.modelSha256}`);
    expect(screen.queryByTestId('evidence-transcript-model-report')).toBeNull();
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it('a SERVER backend (D160): the name and the Core\'s own sentence - no version, no quantisation, no hash line', () => {
    pane({ transcriptModel: EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE });
    const model = EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE;
    expect(screen.getByTestId('evidence-transcript-model-server')).toBeTruthy();
    expect(screen.getByTestId('evidence-transcript-model-name')).toHaveTextContent(`Name: ${model.name}`);
    expect(screen.getByTestId('evidence-transcript-model-report')).toHaveTextContent(model.report);
    expect(model.report).toMatch(/reported by the STT server/);
    expect(screen.queryByTestId('evidence-transcript-model-version')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-model-quantisation')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-model-hash')).toBeNull();
  });

  it('CONTROL: an item that states no model draws nothing about one', () => {
    pane({});
    expect(screen.queryByTestId(/^evidence-transcript-model-/)).toBeNull();
    expect(screen.queryByText('Transcript model')).toBeNull();
  });
});

describe('the revision list (G81b-09)', () => {
  const revision = (more: Partial<TranscriptRevision>): TranscriptRevision => ({ revisionId: 'TRV-000001', number: 1, authorId: 'OPR-002', baseRevision: 0, signedBy: 'CORE-KEY-EVSIGN-01', simulated: false, createdAt: 1, changes: [{ segmentIndex: 0, from: 'first words', to: 'first word' }], ...more });

  it('the reason the answer states is drawn under the revision; the member has ONE name', () => {
    expect(REVISION_REASON_MEMBER).toBe('reason');
    pane({}, [revision({ reason: 'Street name corrected' })]);
    expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveTextContent('Reason: Street name corrected');
  });

  it('CONTROL: a revision that states no reason draws no reason line', () => {
    pane({}, [revision({})]);
    expect(screen.getByTestId('evidence-transcript-revision-1')).toBeTruthy();
    expect(screen.queryByTestId(/^evidence-transcript-revision-reason-/)).toBeNull();
  });
});

describe('the file row of a verify result (G89b-06)', () => {
  const file = { storedOk: false, plainOk: false, chainOk: false };
  const checks = [
    { id: 'V-04', status: 'FAIL' },
    { id: 'V-05', status: 'SKIPPED' },
    { id: 'V-06', status: 'FAIL' },
  ] as const;

  it('the parts and their checks: stored bytes V-04, decrypted bytes V-05, fragment chain V-06', () => {
    expect(V2_FILE_PART_CHECK).toEqual({ stored: 'V-04', plain: 'V-05', chain: 'V-06' });
  });

  it('the tamper demonstration: stored bytes FAIL, decrypted bytes NOT RUN (V-05 was skipped), fragment chain FAIL', () => {
    expect(v2FilePartOutcome(file, 'stored', checks)).toBe('FAIL');
    expect(v2FilePartOutcome(file, 'plain', checks)).toBe('SKIPPED');
    expect(v2FilePartOutcome(file, 'chain', checks)).toBe('FAIL');
  });

  it('CONTROL: a part whose check RAN and failed is FAIL; a part that passed is PASS whatever the check list says; no check list = the flag', () => {
    expect(v2FilePartOutcome(file, 'plain', [{ id: 'V-05', status: 'FAIL' }])).toBe('FAIL');
    expect(v2FilePartOutcome({ ...file, plainOk: true }, 'plain', checks)).toBe('PASS');
    expect(v2FilePartOutcome(file, 'plain', null)).toBe('FAIL');
    expect(v2FilePartOutcome(file, 'plain', [])).toBe('FAIL');
  });
});

describe('the band legend (G94b-07)', () => {
  const segments = [
    { seq: 1, inputId: 'MIC-01' },
    { seq: 2, inputId: 'MIC-02' },
  ];

  it('without a verify result the item\'s own interval class marks a development microphone', () => {
    const intervals = [
      { seq: 1, inputId: 'MIC-01', sourceClass: 'FAKE' as const },
      { seq: 2, inputId: 'MIC-02', sourceClass: 'PRODUCTION' as const },
    ];
    expect(legendDevelopmentClass('MIC-01', segments, null, intervals)).toBe('FAKE');
    // CONTROL: a production microphone, an interval without a class and no intervals at all draw no mark.
    expect(legendDevelopmentClass('MIC-02', segments, null, intervals)).toBeNull();
    expect(legendDevelopmentClass('MIC-01', segments, null, [{ seq: 1, inputId: 'MIC-01', sourceClass: null }])).toBeNull();
    expect(legendDevelopmentClass('MIC-01', segments, null)).toBeNull();
  });

  it('the item reader keeps `audioSourceIntervals[].sourceClass` as the manifest records it', () => {
    const item = readItemV2({ audioSourceIntervals: [{ seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 10, reason: 'START', sourceClass: 'LOCAL_DEVICE' }, { seq: 2, inputId: 'MIC-02', fromMs: 10, toMs: null, reason: 'MANUAL' }] });
    expect(item.audioIntervals.map((interval) => interval.sourceClass)).toEqual(['LOCAL_DEVICE', null]);
  });
});

describe('the accepted export and the default destination (contract_wave_k.md S2 sections 2 and 3)', () => {
  it('`archiveOnCore: false` of the contract\'s example is read by name', () => {
    expect(answeredArchiveOnCoreOf(EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE)).toBe(false);
    const { archiveOnCore: _unused, ...without } = EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE;
    expect(answeredArchiveOnCoreOf(without)).toBeNull();
  });

  it('the contract\'s default destination pre-selects the case-file option of a real export', () => {
    const facts = readDetailFacts({ exportDestinationDefault: EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE });
    expect(facts.exportDestinationDefault).toBe(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE);
    const recorded = { caseFile: 'Case file transfer', usb: 'Encrypted USB drive', network: 'Export/Transfer network' } as const;
    expect(initialExportDestination(facts.exportDestinationDefault, (key) => recorded[key])).toBe('caseFile');
  });
});

describe('the stepper at Complete (G94b-13) - CONTROL of the state the wizard hands over', () => {
  it('six `done` statuses: every badge draws its check, no badge draws a number', () => {
    const steps = EXPORT_STEPS.map((key) => ({ key, label: key }));
    render(
      <RuntimeTestProviders sim={createTestSim().sim}>
        <Stepper steps={steps} statuses={steps.map(() => 'done' as const)} orientation="horizontal" motion="reduced" testID="s" />
      </RuntimeTestProviders>,
    );
    // The glyph sits inside a badge that is hidden from accessibility (the step's text carries the label).
    for (let index = 0; index < steps.length; index += 1) expect(screen.queryAllByTestId(`s-badge-${index}-check`, { includeHiddenElements: true }).length).toBeGreaterThan(0);
    for (let number = 1; number <= steps.length; number += 1) expect(screen.queryByText(String(number))).toBeNull();
  });
});
});
