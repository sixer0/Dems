// Fix pass F-M6, finding R80-01: the seal hands the engine the transcript summary of its item -
// the projection of the manifest block that was signed, with head 0.
import type { CompleteSealInput } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { sealInputWithTranscriptSummary, type FinalizedTranscript, type ManifestTranscriptBlock } from '../index';

const HASH = '7a'.repeat(32);
const input = (transcriptSha256: string | null): CompleteSealInput => ({
  sessionId: 'SES-20261010-0001',
  sealedAt: 9,
  manifestSha256: 'ab'.repeat(32),
  signature: { value: 'cd'.repeat(64), keyId: 'K', algorithm: 'Ed25519' },
  tracks: [],
  interrupted: false,
  durableEndAt: 8,
  transcriptSha256,
  labelsStatus: transcriptSha256 === null ? null : 'UNAVAILABLE',
  developmentSources: true,
});
/** Only the members the projection reads: the block's own rules are the manifest schema's. */
const finalized = (block: Pick<ManifestTranscriptBlock, 'state' | 'sha256' | 'speakerState' | 'failedChunks' | 'backendUnreachable'>): FinalizedTranscript => ({ manifest: block }) as unknown as FinalizedTranscript;

describe('R80-01: the summary the seal commits with its item', () => {
  it.each([
    ['ASSEMBLED', { state: 'ASSEMBLED', sha256: HASH, speakerState: 'UNAVAILABLE', failedChunks: 0, backendUnreachable: false }, { state: 'READY', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 0, backendUnreachable: false }],
    ['PARTIAL with chunks', { state: 'PARTIAL', sha256: HASH, speakerState: 'UNAVAILABLE', failedChunks: 3, backendUnreachable: true }, { state: 'PARTIAL', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 3, backendUnreachable: true }],
    ['PARTIAL without a document, plan not known', { state: 'PARTIAL', sha256: null, speakerState: null, failedChunks: null, backendUnreachable: false }, { state: 'PARTIAL', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }],
    ['DISABLED', { state: 'DISABLED', sha256: null, speakerState: null, failedChunks: null, backendUnreachable: false }, { state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }],
  ] as const)('%s', (_name, block, summary) => {
    const base = input(block.sha256);
    const out = sealInputWithTranscriptSummary(base, finalized(block));
    expect(out.transcript).toEqual(summary);
    // Nothing else of the input is touched, and the input itself is not changed.
    expect({ ...out, transcript: undefined }).toEqual({ ...base, transcript: undefined });
    expect(base).not.toHaveProperty('transcript');
  });
});
