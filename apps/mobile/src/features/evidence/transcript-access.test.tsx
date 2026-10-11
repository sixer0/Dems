// Wave H, driver C2 (mobile) - finding 6 of the common brief: the transcript pane, and what a page
// VIEW may ask of the Core.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G81-01 | Operation 84 refuses with `details.reason: SIMULATED_ITEM`: the pane says the Core keeps no transcript for a simulated item - never "not available yet" | "a simulated item" |
// | G81-05 (ruling D198) | An ASSEMBLED transcript without segments reads "No speech was detected in this recording." in a NEUTRAL tone, is not called "Transcript assembled", and offers no revise control | "no speech" |
// | G81-07 | `access.readTranscript: false` / `access.play: false` of operation 40: the page view calls NEITHER operation 84 / 86 NOR 88 and says "not permitted" | "access" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import type { ReactNode } from 'react';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { readItemV2 } from './item-v2';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { H, bedWith, openItem, realItem } from './testing/real-item-kit';
import { transcriptQueryKey, transcriptRevisionsQueryKey } from './transcript';
import type { TranscriptDocument } from './transcript-model';
import { TranscriptPane } from './transcript-pane';

jest.setTimeout(30_000);

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<Record<string, unknown> | null>(null);
    held.current ??= { play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => undefined), addListener: () => ({ remove: () => undefined }), currentTime: 0 };
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const READY = { state: 'READY', sha256: H('a'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0 };

describe('G81-01 - a simulated item', () => {
  it('operation 84 answers 409 TRANSCRIPT_NOT_READY with `details.reason: SIMULATED_ITEM`: "the Core server keeps no transcript for it" - never "not available yet"', async () => {
    // The engine's own (simulated) item with the transcript hash the simulator's seal binds.
    const { b, id } = await bedWith('0002', (item) => ({ ...item, transcriptSha256: H('b') }) as typeof item);
    bed = b;
    const refusal = b.fake.example('getTranscript', 409) as { status: number; body: { error: Record<string, unknown> } };
    b.fake.answer('getTranscript', () => ({ status: 409, body: { ...refusal.body, error: { ...refusal.body.error, details: { reason: 'SIMULATED_ITEM' } } } }));
    await openItem(b, id);
    await b.flush();
    expect(b.requests('getTranscript')).toHaveLength(1);
    expect(screen.getByTestId('evidence-transcript-simulated-item')).toHaveTextContent('This is a simulated item: the Core server keeps no transcript for it.');
    expect(screen.queryByText('The transcript is not available yet.')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-not-ready')).toBeNull();
  });

  it('CONTROL: a 409 without that reason still reads "not available yet"', async () => {
    const { b, id } = await bedWith('0002', (item) => ({ ...item, transcriptSha256: H('b') }) as typeof item);
    bed = b;
    b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
    await openItem(b, id);
    await b.flush();
    expect(screen.getByTestId('evidence-transcript-not-ready')).toHaveTextContent('The transcript is not available yet.');
    expect(screen.queryByTestId('evidence-transcript-simulated-item')).toBeNull();
  });
});

describe('G81-05 - no speech (ruling D198)', () => {
  const EV = 'EV-20261001-0014';
  const document = (segments: TranscriptDocument['segments']): TranscriptDocument => ({ speakerState: 'UNAVAILABLE', segments, machineTranscriptHash: H('b'), assembledAt: null, revision: 0 });
  function Seeded({ doc, children }: { doc: TranscriptDocument; children: ReactNode }) {
    const client = useQueryClient();
    if (client.getQueryData(transcriptQueryKey(EV, null)) === undefined) {
      client.setQueryData(transcriptQueryKey(EV, null), doc);
      client.setQueryData(transcriptRevisionsQueryKey(EV, null), []);
    }
    return <>{children}</>;
  }
  function pane(doc: TranscriptDocument) {
    const test = createTestSim();
    render(
      <RuntimeTestProviders sim={test.sim}>
        <Seeded doc={doc}>
          <TranscriptPane evidenceId={EV} item={readItemV2({ id: EV, transcriptSha256: H('b'), transcript: READY })} operatorNames={{}} />
        </Seeded>
      </RuntimeTestProviders>,
    );
  }

  it('an assembled transcript with ZERO segments: "No speech was detected in this recording." in the neutral tone; not "Transcript assembled"; no revise control', () => {
    pane(document([]));
    expect(screen.getByTestId('evidence-transcript-NO_SPEECH')).toBeTruthy();
    expect(screen.getByTestId('evidence-transcript-no-speech')).toHaveTextContent('No speech was detected in this recording.');
    expect(screen.queryByText('Transcript assembled')).toBeNull();
    expect(screen.queryByTestId('evidence-transcript-ASSEMBLED')).toBeNull();
    expect(screen.queryByTestId(/^evidence-transcript-revise-/)).toBeNull();
    expect(screen.queryByText('This transcript has no segments.')).toBeNull();
  });

  it('CONTROL: with a segment it is "Transcript assembled"', () => {
    pane(document([{ index: 0, startMs: 0, endMs: 900, text: 'first words', speaker: null }]));
    expect(screen.getByTestId('evidence-transcript-ASSEMBLED')).toBeTruthy();
    expect(screen.getByText('Transcript assembled')).toBeTruthy();
    expect(screen.queryByTestId('evidence-transcript-no-speech')).toBeNull();
  });
});

describe('G81-07 - what a page view may ask (operation 40 `access`)', () => {
  const streamable = (b: LiveEvidenceBed) => {
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
  };

  it('`access.readTranscript: false`: operations 84 and 86 are NOT called; the pane says "You are not permitted to read this transcript."', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    b.detailExtras = () => ({ access: { play: true, readTranscript: false, export: false } });
    await openItem(b, id);
    await b.flush();
    expect(screen.getByTestId('evidence-transcript-may-not-read')).toHaveTextContent('You are not permitted to read this transcript.');
    expect(b.requests('getTranscript')).toHaveLength(0);
    expect(b.requests('listTranscriptRevisions')).toHaveLength(0);
  });

  it('`access.play: false`: no player and no "Open playback"; "You are not permitted to play this recording."; Play asks nothing (operation 88 is not called)', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    streamable(b);
    b.detailExtras = () => ({ access: { play: false, readTranscript: false, export: false } });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-may-not-play')).toHaveTextContent('You are not permitted to play this recording.');
    expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
    expect(b.requests('getTranscript')).toHaveLength(0);
    expect(screen.queryByTestId('evidence-player-none')).toBeNull();
  });

  it('CONTROL: `access` absent - the pane asks as before (operation 84 once)', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
    await openItem(b, id);
    await b.flush();
    expect(b.requests('getTranscript')).toHaveLength(1);
    expect(screen.queryByTestId('evidence-transcript-may-not-read')).toBeNull();
    expect(screen.getByTestId('evidence-playback-open-ALLOWED')).toBeTruthy();
  });
});
