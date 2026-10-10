// Blueprint row 92 (MB-05): the sealed members of a schema-v2 item on the Session Summary — per
// camera file the stored-bytes and decrypted-bytes hashes, the transcript hash, the label status and
// the note of a real signature; a v1 item draws nothing; a member the seal does not state is not guessed.
import { TEST_INSETS, WINDOWS } from '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { AppProviders } from '@/providers';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { SealedMembersCard } from './sealed-members';

const H = (char: string): string => char.repeat(64);
let engine: TestSim;

beforeEach(() => {
  resetMissingKeys();
  engine = createTestSim();
});
afterEach(() => {
  engine.sim.stop();
  expect(getMissingKeys()).toEqual([]);
});

function draw(change: (item: EvidenceItem) => EvidenceItem, onOpen = jest.fn()) {
  const state = engine.sim.store.getState();
  const target = state.evidence[0]!;
  engine.sim.store.setState({ evidence: state.evidence.map((item) => (item.id === target.id ? change(item) : item)) });
  const { width, height } = WINDOWS.phonePortrait;
  render(
    <AppProviders sim={engine.sim} safeAreaMetrics={{ frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS }}>
      <SealedMembersCard sessionId={target.sessionId} onOpen={onOpen} />
    </AppProviders>,
  );
  return onOpen;
}

const v2 = (item: EvidenceItem): EvidenceItem =>
  ({
    ...item,
    files: [
      { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5 },
      { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 4_100, sha256: H('d'), fragmentCount: 5 },
    ],
    transcriptSha256: H('e'),
    labelsStatus: 'UNAVAILABLE',
    signature: { ...item.signature, value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
  }) as unknown as EvidenceItem;

describe('SealedMembersCard (MB-05)', () => {
  it('a v1 item draws nothing', () => {
    draw((item) => item);
    expect(screen.queryByTestId('summary-sealed-members')).toBeNull();
  });

  it('a v2 item: both hashes of a file when the seal states them, the transcript hash, the label status, the real-signature note; a hash opens in full', () => {
    const onOpen = draw(v2);
    expect(screen.getByTestId('summary-sealed-members')).toBeTruthy();
    expect(screen.getByTestId('summary-sealed-VIDEO-01-stored')).toHaveTextContent(/VIDEO-01 · stored bytes/);
    expect(screen.getByTestId('summary-sealed-VIDEO-01-plain')).toHaveTextContent(/VIDEO-01 · decrypted bytes/);
    expect(screen.getByTestId('summary-sealed-VIDEO-02-stored')).toBeTruthy();
    // The seal states no plaintext hash for VIDEO-02: no row is invented.
    expect(screen.queryByTestId('summary-sealed-VIDEO-02-plain')).toBeNull();
    expect(screen.getByTestId('summary-sealed-transcript')).toHaveTextContent(/Transcript hash/);
    expect(screen.getByTestId('summary-sealed-labels')).toHaveTextContent(/speaker labels unavailable/);
    expect(screen.getByTestId('summary-sealed-signature-real')).toHaveTextContent(/Ed25519, Core key KEY-EVSIGN-01/);
    fireEvent.press(screen.getByTestId('summary-sealed-VIDEO-01-plain'));
    expect(onOpen).toHaveBeenCalledWith({ label: 'VIDEO-01 · decrypted bytes', value: H('b') });
  });

  it('what the seal does not state is said, not guessed: no transcript hash, labels not stated, a simulated signature is not called real', () => {
    draw((item) => ({ ...v2(item), transcriptSha256: null, labelsStatus: null, signature: item.signature }) as unknown as EvidenceItem);
    expect(screen.queryByTestId('summary-sealed-transcript')).toBeNull();
    expect(screen.getByTestId('summary-sealed-no-transcript')).toHaveTextContent('This seal carries no transcript hash.');
    expect(screen.getByTestId('summary-sealed-labels')).toHaveTextContent(/not stated by the seal/);
    // A simulated signature gets no note here (the card above marks it SIMULATED), and is never called real.
    expect(screen.queryByTestId('summary-sealed-signature-real')).toBeNull();
    expect(screen.getByTestId('summary-sealed-members')).not.toHaveTextContent(/Ed25519|simulat/i);
  });
});
