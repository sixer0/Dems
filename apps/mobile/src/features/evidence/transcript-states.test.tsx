// Fix pass F-M6 (code review row 80, finding R80-01): the transcript pane names the state the
// item's summary REPORTS - what the seal signed - and never assumes one. One case per state.
import { describe, expect, it } from '@jest/globals';
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { readItemV2 } from './item-v2';
import { transcriptQueryKey, transcriptRevisionsQueryKey } from './transcript';
import { paneStateOf, sealedWithoutDocument, type TranscriptDocument } from './transcript-model';
import { TranscriptPane } from './transcript-pane';

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
