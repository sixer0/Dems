// Fix pass F-M6, finding R80-01: the transcript summary of a sealed item survives a start of the
// Core. No column holds it: the boot step reads the transcript block of the item's SIGNED manifest
// and publishes its projection, with the head of the revision table. No database: the step is
// handed rows, a state and a package folder.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLE_SOURCE_ROWS, PackageFile, attachSignature, buildUnsignedManifest, exampleManifestInput, serializeManifest, type ManifestV2Input } from '@dems/shared/evidence-package';
import type { TranscriptRevisionNote } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { TRANSCRIPT_HEAD_NOT_PUBLISHED, publishRevisionHeads } from '../heads';

const store = mkdtempSync(join(tmpdir(), 'dems-fm6-summary-'));
afterAll(() => rmSync(store, { recursive: true, force: true }));

const SIGNED = { algorithm: 'Ed25519', simulated: false };
type Block = ManifestV2Input['transcript'];
const DOCUMENT: Block = exampleManifestInput().transcript;
const ABSENT = { file: null, docVersion: null, sha256: null, srtSha256: null, vttSha256: null, speakerState: null, revisionHead: null, model: { name: null, version: null, quantisation: null, modelSha256: null }, diarization: { ...DOCUMENT.diarization, numSpeakers: null, status: null, confidence: null } };

/** Writes a sealed manifest whose transcript block is `block` into the package folder of `sessionId`; answers its digest. */
function packageOf(sessionId: string, block: Block, alter: (text: string) => string = (text) => text): string {
  const manifest = attachSignature(buildUnsignedManifest({ ...exampleManifestInput(), sessionId, transcript: block }, EXAMPLE_SOURCE_ROWS), new Uint8Array(64).fill(7));
  const folder = join(store, `SESSION-${sessionId}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, PackageFile.MANIFEST), alter(Buffer.from(serializeManifest(manifest)).toString('utf8')));
  return manifest.manifestSha256;
}

function rig(evidence: readonly Record<string, unknown>[], heads: Readonly<Record<string, number>> = {}) {
  const lines: Record<string, unknown>[] = [];
  const notes: TranscriptRevisionNote[] = [];
  const level = (name: string) => (fields: Record<string, unknown>, msg: string) => void lines.push({ level: name, msg, ...fields });
  const app = {
    log: { error: level('error'), warn: level('warn'), info: level('info') },
    errorLog: { append: () => {} },
    db: { read: async () => ({ rows: Object.entries(heads).map(([evidenceId, revision]) => ({ evidence_id: evidenceId, revision: String(revision), json_sha256: DOCUMENT.sha256, labels_status: 'UNAVAILABLE' })) }) },
    engine: { slice: () => evidence, noteTranscriptRevision: async (note: TranscriptRevisionNote) => (notes.push(note), { value: true }), applyStorageVolume: async () => ({ value: false }), applyCaptureSourceFacts: async () => ({ value: false }) },
    config: { mediaStoreDir: store },
  } as unknown as FastifyInstance;
  return { app, lines, notes };
}

let sequence = 0;
function sealedItem(block: Block, more: Record<string, unknown> = {}, alter?: (text: string) => string) {
  sequence += 1;
  const sessionId = `SES-20261010-${String(sequence).padStart(4, '0')}`;
  const manifestHash = packageOf(sessionId, block, alter);
  return { id: `EV-20261010-${String(sequence).padStart(4, '0')}`, sessionId, integritySource: 'REAL', manifestVersion: 2, signature: SIGNED, manifestHash, transcriptSha256: block.sha256, ...more };
}

describe('R80-01: after a start, every item with a sealed package here is told its transcript summary from the signed manifest', () => {
  it('one note per state: ASSEMBLED, PARTIAL with chunks, PARTIAL without a document, DISABLED - with NO revision row at all', async () => {
    const assembled = sealedItem({ ...DOCUMENT, state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false });
    const partial = sealedItem({ ...DOCUMENT, state: 'PARTIAL', failedChunks: 3, backendUnreachable: true });
    const noDocument = sealedItem({ ...DOCUMENT, ...ABSENT, state: 'PARTIAL', failedChunks: 5, backendUnreachable: false, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' });
    const disabled = sealedItem({ ...DOCUMENT, ...ABSENT, state: 'DISABLED', failedChunks: null, backendUnreachable: false, disabledReason: 'DISABLED_BY_CONFIGURATION', configSnapshot: { ...DOCUMENT.configSnapshot, enabled: false } });
    const { app, notes, lines } = rig([assembled, partial, noDocument, disabled]);
    expect(await publishRevisionHeads(app)).toBe(4);
    expect(lines.filter((line) => line['level'] !== 'info')).toEqual([]);
    expect(notes).toEqual([
      { evidenceId: assembled.id, revision: 0, state: 'READY', machineTranscriptHash: DOCUMENT.sha256, labelsStatus: DOCUMENT.speakerState, failedChunks: 0, backendUnreachable: false },
      { evidenceId: partial.id, revision: 0, state: 'PARTIAL', machineTranscriptHash: DOCUMENT.sha256, labelsStatus: DOCUMENT.speakerState, failedChunks: 3, backendUnreachable: true },
      { evidenceId: noDocument.id, revision: 0, state: 'PARTIAL', machineTranscriptHash: null, labelsStatus: null, failedChunks: 5, backendUnreachable: false },
      { evidenceId: disabled.id, revision: 0, state: 'DISABLED', machineTranscriptHash: null, labelsStatus: null, backendUnreachable: false },
    ]);
  });

  it('the head of the revision table rides on the summary; an item that already says that head is not told again', async () => {
    const revised = sealedItem({ ...DOCUMENT, state: 'PARTIAL', failedChunks: 2, backendUnreachable: false });
    const current = sealedItem({ ...DOCUMENT, state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false }, { transcript: { state: 'READY', revision: 0 } });
    const { app, notes } = rig([revised, current], { [revised.id]: 4 });
    expect(await publishRevisionHeads(app)).toBe(1);
    expect(notes).toEqual([{ evidenceId: revised.id, revision: 4, state: 'PARTIAL', machineTranscriptHash: DOCUMENT.sha256, labelsStatus: DOCUMENT.speakerState, failedChunks: 2, backendUnreachable: false }]);
  });

  it('CONTROL: a manifest that is not the one the item was sealed with (another digest, or altered bytes) tells NOTHING - no state is guessed - and is one error line', async () => {
    const other = sealedItem({ ...DOCUMENT, state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false }, { manifestHash: 'ee'.repeat(32) });
    const altered = sealedItem({ ...DOCUMENT, state: 'PARTIAL', failedChunks: 3, backendUnreachable: false }, {}, (text) => text.replace('"failedChunks":3', '"failedChunks":0'));
    const { app, notes, lines } = rig([other, altered]);
    expect(await publishRevisionHeads(app)).toBe(0);
    expect(notes).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'error', code: TRANSCRIPT_HEAD_NOT_PUBLISHED, items: 2, evidenceIds: [other.id, altered.id] });
  });
});
