// Operations 84, 85 and 86 on PostgreSQL as `dems_app`, against a REAL sealed package on disk
// (integration pass D4; C3 §2.2 to §2.4; transcript spec §A.6; evidence package spec §C.1, §D
// V-10, V-11; OD-15; SEC35-20, SEC35-21).
//
// WHAT IS REAL: the app factory and its boot, every request stage, the engine host and its unit of
// work, the audit chain, the `transcripts` / `transcript_revisions` tables with the runtime role's
// privileges, the Core's signer (row 83's software signer on a development key of row 82's
// provisioning function), the package files, and the product verifier (`verifyPackageV2` on the
// Core's ports) that judges the package before and after a revision.
// WHAT STANDS IN: the package is built by the verify row's test builder (generated camera bytes),
// and the item is sealed through the engine's seal door with that package's facts - no capture
// worker and no transcriber ran. The transcript document is a hand-written `dems.transcript/1`
// document that the Core's own strict reader accepts.
import { CORE_API_EXAMPLES, EvidenceSliceSchema, TRANSCRIPT_REVISION_REASON_EXAMPLE, TranscriptDocumentSchema, TranscriptRevisionPageSchema, TranscriptRevisionSchema } from '@dems/shared/api';
import { PackageFile } from '@dems/shared/evidence-package';
import { TranscriptRevisionsFileSchema, verifyPackageV2, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { FIXED_NOW } from '../../../../test/support/engine';
import { sealDoorsOf } from '../../../engine/seal-doors';
import { corePorts } from '../../../evidence-verify';
import { buildPackage, removeScratch, throwAwaySigner, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { SEALING_STEP_ORDER, SealedTranscriptDocumentSchema, evidenceTranscriptSummary, loadSealingSigner, provisionDevelopmentSigningKey } from '../../../sealing';
import { CORE_EVIDENCE_SIGNING_KEY_ID, loadSoftwareSigner, provisionSigningKey, type LoadedSigner } from '../../../capture';
import { seeded, sessionInput, sessionsApp, type Caller, type SessionsApp } from '../../sessions/__tests__/support';
import { TRANSCRIPT_HEADS_BOOT_STEP, TRANSCRIPT_HEAD_NOT_PUBLISHED, createTranscriptStore, provideRevisionSigner, revisionDigestOf, type RevisionBody } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'd4tr' });
const roots: string[] = [];
afterAll(() => {
  removeScratch();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const EVIDENCE = '/api/v1/evidence';
/**
 * A key ID that BOTH rules take: the signer's (`^[A-Z0-9][A-Z0-9-]{2,62}$`, row 83: hyphens, no underscore) and the
 * table's `CODE` form (`^[A-Z][A-Z0-9_]{0,63}$`, dbc-3 §B.9: underscores, no hyphen). They meet on letters and digits only.
 */
const STORABLE_KEY_ID = 'COREKEYEVSIGN01';

/** A `dems.transcript/1` document as the transcriber writes one: two segments, two speakers. */
const DOCUMENT = {
  header: {
    doc_version: 'dems.transcript/1',
    session_id: 'SES-20261001-0001',
    language: 'id',
    backend: 'cpu-local',
    model: { id: 'whisper-test', name: 'whisper', version: '1', quantisation: 'q5', sha256: 'ab'.repeat(32) },
    audio: { kind: 'session-audio', sample_rate_hz: 16_000 },
    state: 'ASSEMBLED',
    partial_reason: null,
    chunks: 2,
    failed_chunks: 0,
    speaker_reason: null,
    diarization: { num_speakers: 2, confidence: 0.9, engine: null },
  },
  segments: [
    { index: 0, start_ms: 0, end_ms: 1_500, text: 'Selamat pagi, silakan duduk.', speaker: 'A' },
    { index: 1, start_ms: 1_600, end_ms: 3_200, text: 'Terima kasih, Pak.', speaker: 'B' },
  ],
  speaker_state: 'LABELLED',
  intervals: [{ source: 'MIC-01', from_ms: 0, to_ms: null }],
  qa_flags: [],
} as const;
const DOCUMENT_BYTES = Buffer.from(`${JSON.stringify(DOCUMENT)}\n`);
const DOCUMENT_SHA = sha256(DOCUMENT_BYTES);

interface Rig {
  readonly server: SessionsApp;
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly packageDir: string;
  readonly built: BuiltPackage;
  readonly coreSigner: LoadedSigner;
  readonly investigator: Caller;
  /** The product verifier on the package as it lies in the media store, with the Core's anchors. */
  verify(revisionCount: number): Promise<PackageVerifyResult>;
  /** SHA-256 of a file of the package. */
  hashOf(relative: string): string;
  transcript(path?: string): string;
  /** Pass D11: closes the Core and starts it again on the same database, data directory and media store (a process start). */
  restart(): Promise<SessionsApp>;
}

/**
 * A Core whose state and database hold one REAL item with a sealed machine transcript, and whose
 * media store holds that item's package. `sealedBy`: the key that sealed the PACKAGE - the Core's
 * own key (the usual case), or another one (a key that was rotated since the seal).
 */
async function rig(slug: string, sealedBy: 'CORE_KEY' | 'OTHER_KEY' = 'CORE_KEY', coreKey: 'STORABLE_KEY' | 'PRODUCT_KEY' = 'STORABLE_KEY', holder: 'INVESTIGATOR' | 'SUPERVISOR' = 'INVESTIGATOR'): Promise<Rig> {
  expect(SealedTranscriptDocumentSchema.safeParse(DOCUMENT).success).toBe(true);
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-d4-transcripts-'));
  roots.push(dataDir);
  const mediaStoreDir = join(dataDir, 'media', 'sessions');
  mkdirSync(mediaStoreDir, { recursive: true });
  // The Core's signing key, valid before every instant of this file. `STORABLE_KEY`: a key of row
  // 83's signer whose ID has the form the table takes (see the finding at the end of this file);
  // `PRODUCT_KEY`: the key the product loads, made by row 82's own provisioning function.
  let coreSigner: LoadedSigner;
  if (coreKey === 'STORABLE_KEY') {
    const dir = join(dataDir, 'storable-signer');
    provisionSigningKey({ dir, now: FIXED_NOW - 60_000, keyId: STORABLE_KEY_ID });
    coreSigner = loadSoftwareSigner({ dir, now: FIXED_NOW, keyId: STORABLE_KEY_ID });
  } else {
    provisionDevelopmentSigningKey({ dataDir, now: FIXED_NOW - 60_000 });
    coreSigner = loadSealingSigner({ dataDir, now: FIXED_NOW });
  }

  const target = await db.another({ template: 'seed', slug });
  const server = await sessionsApp(target, dataDir, { config: { dataDir, mediaStoreDir } });
  if (coreKey === 'STORABLE_KEY') provideRevisionSigner(server.app, () => coreSigner);
  const investigator = await server.signIn('INVESTIGATOR');
  const principal = server.principal('INVESTIGATOR');
  await server.engine.setTabletLink('CONNECTED');
  // The CASE HOLDER of the sealed item (`evidence_items.investigator_id`; D24 Q-SEC-1 (a)): the investigator of the session.
  await server.engine.command(principal, 'createSession', sessionInput(seeded(holder).id));
  await server.engine.command(principal, 'beginPrecheck');
  await server.drive(5_000);
  if (server.engine.slice('session')?.state === 'PRECHECK') await server.engine.command(principal, 'acknowledgePrecheckWarnings');
  await server.engine.command(principal, 'startRecording');
  await server.drive(3_000);
  await server.engine.command(principal, 'stopRecording', 'Interview complete');
  const sessionId = server.engine.slice('session')?.id ?? '';
  const steps: SealingStepReport[] = SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < 5 ? 'DONE' : 'RUNNING', progress: index < 5 ? 100 : 90, etaMs: index < 5 ? null : 700, attempt: 1 }));
  await sealDoorsOf(server.engine).applySealingProgress({ sessionId, steps });

  const at = server.clock.now();
  // The package of THIS item (its IDs are in the signed manifest), with the document's hash sealed in. Built BEFORE
  // the commit (fix pass F-M6): the item holds the digest of ITS manifest, as every real seal's does - the boot step
  // that reads the transcript summary back accepts no other manifest.
  const sealingEvidenceId = server.engine.slice('session')?.evidenceId ?? '';
  expect(sealingEvidenceId).toMatch(/^EV-/);
  const prebuilt: BuiltPackage = await buildPackage({
    sessionId,
    evidenceId: sealingEvidenceId,
    signer: sealedBy === 'CORE_KEY' ? coreSigner : throwAwaySigner(),
    // The manifest seals the backend and the model THIS file's document states in its header: verify V-10 holds
    // the two against each other since pass D10. (The rig used to seal the builder's example model beside a
    // document of its own - a package no seal writes; pass D11 follow-up, decision D165.)
    transcriptModel: {
      backend: DOCUMENT.header.backend,
      model: { name: DOCUMENT.header.model.name, version: DOCUMENT.header.model.version, quantisation: DOCUMENT.header.model.quantisation, modelSha256: DOCUMENT.header.model.sha256 },
    },
    beforeSeal: (manifest) => void (manifest.transcript.sha256 = DOCUMENT_SHA),
  });
  const input: CompleteSealInput = {
    sessionId,
    sealedAt: at,
    manifestSha256: prebuilt.manifest.manifestSha256,
    signature: { value: 'cd'.repeat(64), keyId: coreSigner.signer.keyId, algorithm: 'Ed25519' },
    tracks: [
      { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: '01'.repeat(32) },
      { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: '02'.repeat(32) },
    ],
    interrupted: false,
    durableEndAt: at - 1_000,
    transcriptSha256: DOCUMENT_SHA,
    labelsStatus: 'LABELLED',
    developmentSources: true,
    // What the sealing composition hands in with every seal (R80-01): the projection of the manifest's transcript block.
    transcript: evidenceTranscriptSummary({ ...prebuilt.manifest.transcript, sha256: DOCUMENT_SHA }, 0),
  };
  let built: BuiltPackage | null = null;
  let packageDir = '';
  const outcome = await sealDoorsOf(server.engine).completeSeal(input, async (unit, evidenceId) => {
    expect(evidenceId).toBe(sealingEvidenceId);
    built = prebuilt;
    packageDir = join(mediaStoreDir, `SESSION-${sessionId}`);
    cpSync(built.dir, packageDir, { recursive: true });
    writeFileSync(join(packageDir, ...PackageFile.TRANSCRIPT_JSON.split('/')), DOCUMENT_BYTES);
    // The seal's own write of the machine transcript, in the unit that inserts the item (row 78).
    await createTranscriptStore(unit).writeSealedTranscript({ evidenceId, jsonSha256: DOCUMENT_SHA, srtSha256: 'c1'.repeat(32), vttSha256: 'c2'.repeat(32), model: { name: 'whisper' }, diarization: { numSpeakers: 2 }, labelsStatus: 'LABELLED', createdAt: at });
  });
  if (built === null) throw new Error('the package was not built');
  const sealed: BuiltPackage = built;
  const evidenceId = outcome.value.evidenceId;
  const file = (relative: string): string => join(packageDir, ...relative.split('/'));
  return {
    server,
    evidenceId,
    sessionId,
    packageDir,
    built: sealed,
    coreSigner,
    investigator,
    verify: (revisionCount) =>
      verifyPackageV2(corePorts(packageDir, sealed.opener, 256), {
        plaintext: 'REQUIRED',
        expected: { evidenceId, sessionId, manifestSha256: sealed.manifest.manifestSha256, transcriptSha256: DOCUMENT_SHA, revisionCount, trustedCertificateSha256: [sealed.signer.certificate.sha256, coreSigner.certificate.sha256] },
      }),
    hashOf: (relative) => sha256(readFileSync(file(relative))),
    transcript: (path = '') => `${EVIDENCE}/${evidenceId}/transcript${path}`,
    async restart() {
      // The next process starts later than the last instant of this one (a manual clock has no floor to raise).
      const startAt = server.clock.now() + 1_000;
      await server.app.close();
      const again = await sessionsApp(target, dataDir, { startAt, config: { dataDir, mediaStoreDir } });
      if (coreKey === 'STORABLE_KEY') provideRevisionSigner(again.app, () => coreSigner);
      return again;
    },
  };
}

const REQUEST = { baseRevision: 0, changes: [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'Terima kasih, Bu.' }], note: 'The witness addressed a woman officer.' } as const;
/** A correction of segment 1 AFTER `REQUEST` was appended: its `from` is the text that revision gave the segment (fix wave K, G81b-01). */
const AFTER_FIRST = { segmentIndex: 1, from: 'Terima kasih, Bu.', to: 'Terima kasih, Ibu.' } as const;
const noticed = (result: PackageVerifyResult): string[] => result.notices.map((notice) => notice.code);
const failing = (result: PackageVerifyResult): string[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => `${check.id} ${check.findings.map((finding) => finding.code).join(',')}`);
const codeOf = (response: { json(): unknown }): string => (response.json() as { error: { code: string } }).error.code;
const detailsOf = (response: { json(): unknown }): Record<string, unknown> => (response.json() as { error: { details?: Record<string, unknown> } }).error.details ?? {};

describe('the schema this pass was written against', () => {
  it('schema version 6, contract dbc-7: no migration', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

describe('operation 84 getTranscript', () => {
  it('answers the sealed machine transcript of the package, with the hash the item is bound to and revision 0; the case holder reads; nobody without a session', async () => {
    const { server, investigator, transcript, verify } = await rig('d4tr_read');
    expect(failing(await verify(0))).toEqual([]);
    const response = await server.get(investigator, transcript());
    expect(response.statusCode).toBe(200);
    expect(TranscriptDocumentSchema.parse(response.json())).toEqual({
      documentVersion: 'dems.transcript/1',
      language: 'id',
      speakerState: 'LABELLED',
      segments: [
        { index: 0, startMs: 0, endMs: 1_500, text: 'Selamat pagi, silakan duduk.', speaker: 'A' },
        { index: 1, startMs: 1_600, endMs: 3_200, text: 'Terima kasih, Pak.', speaker: 'B' },
      ],
      sha256: DOCUMENT_SHA,
      machineTranscriptHash: DOCUMENT_SHA,
      assembledAt: expect.any(Number),
      revision: 0,
    });
    expect((await server.get(null, transcript())).statusCode).toBe(401);
  });

  it('404 for an unknown item; 409 TRANSCRIPT_NOT_READY for an item without a sealed transcript (every seeded v1 item) on all three operations', async () => {
    const { server, investigator } = await rig('d4tr_refusals');
    const unknown = await server.get(investigator, `${EVIDENCE}/EV-19700101-9999/transcript`);
    expect([unknown.statusCode, codeOf(unknown)]).toEqual([404, 'NOT_FOUND']);
    const v1 = server.engine.slice('evidence').find((item) => item.transcriptSha256 == null);
    expect(v1).toBeDefined();
    for (const path of ['', '/revisions']) {
      const refused = await server.get(investigator, `${EVIDENCE}/${v1?.id}/transcript${path}`);
      // Pass D6 (item 11): the refusal says WHY - an item of the demonstration data has no transcript on a Core.
      expect([refused.statusCode, codeOf(refused), detailsOf(refused)['reason']], path).toEqual([409, 'TRANSCRIPT_NOT_READY', 'SIMULATED_ITEM']);
    }
    const revise = await server.post(investigator, `${EVIDENCE}/${v1?.id}/transcript/revisions`, REQUEST);
    expect([revise.statusCode, codeOf(revise), detailsOf(revise)['reason']]).toEqual([409, 'TRANSCRIPT_NOT_READY', 'SIMULATED_ITEM']);
    expect((await server.get(investigator, `${EVIDENCE}/not-an-id/transcript`)).statusCode).toBe(422);
  });

  it('a document that is not the sealed one is never answered: other bytes in the package answer 503 with a reason, and the failure is in the persistent error log', async () => {
    const { server, investigator, transcript, packageDir } = await rig('d4tr_other_bytes');
    writeFileSync(join(packageDir, 'transcript', 'transcript.json'), Buffer.from(`${JSON.stringify({ ...DOCUMENT, segments: [{ ...DOCUMENT.segments[0], text: 'Kalimat lain.' }] })}\n`));
    const response = await server.get(investigator, transcript());
    expect([response.statusCode, codeOf(response), detailsOf(response)['reason']]).toEqual([503, 'NOT_READY', 'TRANSCRIPT_DOCUMENT_UNAVAILABLE']);
    expect(JSON.stringify(response.json())).not.toContain('Kalimat lain');
    expect(server.log.lines().some((line) => line['code'] === 'TRANSCRIPT_DOCUMENT_UNAVAILABLE' && line['evidenceId'] !== undefined)).toBe(true);
  });
});

describe('R93-02 (D178; D24 Q-SEC-1 (a)): operations 84, 85 and 86 hold the case scope of a REAL item', () => {
  const deniedRows = async (server: SessionsApp): Promise<{ actor_id: string; evidence_id: string | null; details: Record<string, unknown> }[]> =>
    (await server.owner.query("SELECT actor_id, evidence_id, details FROM public.audit_log WHERE type = 'ACCESS_DENIED' ORDER BY seq")).rows;

  it('an operator with EVIDENCE_VIEW who does not hold the case is refused 403 on 84 and 86, each with ONE audited ACCESS_DENIED row; the case holder and a SUPERVISOR read', async () => {
    const { server, investigator, transcript, evidenceId } = await rig('r93_scope_read');
    const technician = await server.signIn('TECHNICIAN');
    const before = (await deniedRows(server)).length;
    for (const [path, operationId] of [['', 'getTranscript'], ['/revisions', 'listTranscriptRevisions']] as const) {
      const refused = await server.get(technician, transcript(path));
      expect([refused.statusCode, codeOf(refused), detailsOf(refused)], operationId).toEqual([403, 'NOT_PERMITTED', { operationId, permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN', reason: 'EVIDENCE_CASE_SCOPE' }]);
      // No word of the transcript in a refusal.
      expect(JSON.stringify(refused.json())).not.toContain('Selamat');
    }
    const rows = (await deniedRows(server)).slice(before);
    expect(rows.map((row) => [row.actor_id, row.evidence_id, row.details['operationId'], row.details['reason']])).toEqual([
      [seeded('TECHNICIAN').id, evidenceId, 'getTranscript', 'EVIDENCE_CASE_SCOPE'],
      [seeded('TECHNICIAN').id, evidenceId, 'listTranscriptRevisions', 'EVIDENCE_CASE_SCOPE'],
    ]);
    // INSIDE the scope: the holder of the case, and a SUPERVISOR. No row for them.
    const supervisor = await server.signIn('SUPERVISOR');
    for (const cookie of [investigator, supervisor]) for (const path of ['', '/revisions']) expect((await server.get(cookie, transcript(path))).statusCode).toBe(200);
    expect((await deniedRows(server)).length).toBe(before + 2);
  });

  it('operation 85: an operator with TRANSCRIPT_REVISE who does not hold the case appends NOTHING - 403, one audited row, no revision row, the package list untouched; a SUPERVISOR and the holder may', async () => {
    // The case is held by the SUPERVISOR: the INVESTIGATOR has the permission of stage 6 and is outside the scope.
    const { server, investigator, transcript, evidenceId, hashOf } = await rig('r93_scope_revise', 'CORE_KEY', 'STORABLE_KEY', 'SUPERVISOR');
    const before = (await deniedRows(server)).length;
    const list = hashOf(PackageFile.MANIFEST);
    const revisionsFile = join(server.app.config.mediaStoreDir, `SESSION-${server.engine.slice('session')?.id ?? ''}`, ...PackageFile.TRANSCRIPT_REVISIONS.split('/'));
    const revisionsBefore = existsSync(revisionsFile) ? readFileSync(revisionsFile, 'utf8') : null;
    const refused = await server.post(investigator, transcript('/revisions'), REQUEST);
    expect([refused.statusCode, codeOf(refused), detailsOf(refused)]).toEqual([403, 'NOT_PERMITTED', { operationId: 'createTranscriptRevision', permission: 'TRANSCRIPT_REVISE', role: 'INVESTIGATOR', reason: 'EVIDENCE_CASE_SCOPE' }]);
    expect((await server.get(investigator, transcript())).statusCode).toBe(403);
    expect((await deniedRows(server)).slice(before).map((row) => [row.actor_id, row.evidence_id, row.details['operationId']])).toEqual([
      [seeded('INVESTIGATOR').id, evidenceId, 'createTranscriptRevision'],
      [seeded('INVESTIGATOR').id, evidenceId, 'getTranscript'],
    ]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(0);
    expect(hashOf(PackageFile.MANIFEST)).toBe(list);
    expect(existsSync(revisionsFile) ? readFileSync(revisionsFile, 'utf8') : null).toBe(revisionsBefore);
    // The holder of this case IS the supervisor: the revision is made.
    expect((await server.post(await server.signIn('SUPERVISOR'), transcript('/revisions'), REQUEST)).statusCode).toBe(201);
  });

  it('CONTROL: an item that is not REAL (the seeded demonstration items) keeps its answers for every role - the scope is a rule of REAL evidence only', async () => {
    const { server } = await rig('r93_scope_control');
    const technician = await server.signIn('TECHNICIAN');
    const before = (await deniedRows(server)).length;
    const v1 = server.engine.slice('evidence').find((item) => item.integritySource !== 'REAL' && item.investigatorId !== seeded('TECHNICIAN').id);
    expect(v1).toBeDefined();
    for (const path of ['', '/revisions']) {
      const answer = await server.get(technician, `${EVIDENCE}/${v1?.id}/transcript${path}`);
      expect([answer.statusCode, codeOf(answer)], path).toEqual([409, 'TRANSCRIPT_NOT_READY']);
    }
    expect((await deniedRows(server)).length).toBe(before);
  });
});

describe('operation 85 createTranscriptRevision: a derived, signed record; the sealed transcript is untouched', () => {
  it('201: the row, the audit row and the package record are written together; manifest, signature and transcript.json have the same hash before and after; the package verifies before and after', async () => {
    const { server, investigator, transcript, verify, hashOf, evidenceId, sessionId, coreSigner, packageDir } = await rig('d4tr_revise');
    const sealedFiles = [PackageFile.MANIFEST, PackageFile.SIGNATURE, PackageFile.CERTIFICATE, PackageFile.TRANSCRIPT_JSON, PackageFile.TRANSCRIPT_SRT, PackageFile.TRANSCRIPT_VTT, PackageFile.FRAGMENTS_JSON];
    const before = Object.fromEntries(sealedFiles.map((name) => [name, hashOf(name)]));
    const columns = 'SELECT e.transcript_sha256, e.manifest_hash, e.signature_value, t.json_sha256, t.srt_sha256, t.vtt_sha256, t.created_at::text AS created_at FROM public.evidence_items e JOIN public.transcripts t ON t.evidence_id = e.id WHERE e.id = $1';
    const rowsBefore = (await server.owner.query(columns, [evidenceId])).rows;
    expect(before[PackageFile.TRANSCRIPT_JSON]).toBe(DOCUMENT_SHA);
    expect(failing(await verify(0))).toEqual([]);

    let response = await server.post(investigator, transcript('/revisions'), REQUEST);
    const written = await server.written(async () => {
      response = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 1, changes: [{ segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }], note: 'Punctuation as spoken.' });
    });
    expect(response.statusCode).toBe(201);
    const second = TranscriptRevisionSchema.parse(response.json());
    const operatorId = investigator.operator.id;
    expect(second).toMatchObject({ revisionId: 'TRV-000002', number: 2, authorId: operatorId, baseRevision: 1, machineTranscriptHash: DOCUMENT_SHA, signedBy: coreSigner.signer.keyId, signature: { algorithm: 'Ed25519', simulated: false, keyId: coreSigner.signer.keyId }, changes: [{ segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }] });
    expect(second.signature.value).toMatch(/^[0-9a-f]{128}$/);

    // THE SEALED TRANSCRIPT IS UNTOUCHED: the same bytes in the package, the same hashes in the database.
    expect(Object.fromEntries(sealedFiles.map((name) => [name, hashOf(name)]))).toEqual(before);
    expect((await server.owner.query(columns, [evidenceId])).rows).toEqual(rowsBefore);
    expect(rowsBefore[0]).toMatchObject({ transcript_sha256: DOCUMENT_SHA, json_sha256: DOCUMENT_SHA });

    // The derived records: two rows, chained to the machine transcript, with author, reason, time and the Core key's signature.
    const rows = (await server.owner.query('SELECT revision_no, parent_sha256, sha256, author_id, reason, signature_key_id, signature_algorithm, signature_simulated, signature_certificate_sha256 FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no', [evidenceId])).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ revision_no: 1, parent_sha256: DOCUMENT_SHA, author_id: operatorId, reason: REQUEST.note, signature_algorithm: 'Ed25519', signature_simulated: false, signature_certificate_sha256: coreSigner.certificate.sha256 });
    expect(rows[1]).toMatchObject({ revision_no: 2, parent_sha256: rows[0]?.sha256, reason: 'Punctuation as spoken.' });

    // The audit row of the second revision, in its unit: the keys of C3 §5.2 and NEVER a segment text.
    expect(written.map((row) => row.type)).toEqual(['TRANSCRIPT_REVISED']);
    expect(written[0]).toMatchObject({ actorId: operatorId, evidenceId, sessionId, details: { revisionId: 'TRV-000002', authorId: operatorId, number: 2, baseRevision: 1, changeCount: 1, machineTranscriptHash: DOCUMENT_SHA, reason: 'Punctuation as spoken.' } });
    expect(JSON.stringify(written)).not.toMatch(/Selamat pagi|Silakan duduk/);

    // The package record carries the signed body; author, reason and time are INSIDE it.
    const list = TranscriptRevisionsFileSchema.parse(JSON.parse(readFileSync(join(packageDir, 'transcript', 'transcript-revisions.json'), 'utf8')));
    expect(list).toMatchObject({ evidenceId, machineTranscriptSha256: DOCUMENT_SHA });
    expect(list.revisions.map((record) => [record.revisionNo, record.sha256])).toEqual(rows.map((row) => [row.revision_no, row.sha256]));
    const body = list.revisions[1]?.body as unknown as RevisionBody;
    expect(body).toMatchObject({ schema: 'dems.transcript-revision/1', evidenceId, revisionNo: 2, baseRevision: 1, parentSha256: rows[0]?.sha256, machineTranscriptSha256: DOCUMENT_SHA, authorId: operatorId, reason: 'Punctuation as spoken.', createdAt: second.createdAt });
    expect(Buffer.from(revisionDigestOf(body)).toString('hex')).toBe(rows[1]?.sha256);
    // No staging file is left beside the list, and the Core's own certificate needed no second copy.
    expect(readdirSync(join(packageDir, 'transcript')).sort()).toEqual(['transcript-revisions.json', 'transcript.json', 'transcript.srt', 'transcript.vtt']);
    expect(existsSync(join(packageDir, 'certificates'))).toBe(false);

    // The product verifier: V-10 (the sealed transcript) and V-11 (the revision chain and signatures) pass, with the count the database holds.
    const after = await verify(2);
    expect(failing(after)).toEqual([]);
    expect(after.transcript).toEqual({ state: 'VERIFIED', revisions: 2 });
    // NEGATIVE CONTROL of that verdict: the verifier does notice a body that was altered.
    const altered = { ...list, revisions: [list.revisions[0], { ...list.revisions[1], body: { ...list.revisions[1]?.body, reason: 'Another reason, written by somebody else.' } }] };
    writeFileSync(join(packageDir, 'transcript', 'transcript-revisions.json'), JSON.stringify(altered));
    // Pass D6: the body's reason is also no longer the record's.
    expect(failing(await verify(2))).toEqual(['V-11 REVISION_BODY_HASH_MISMATCH,REVISION_MEMBER_MISMATCH']);

    // Operation 84 still answers the machine transcript, now with revision 2 (the head of the table).
    writeFileSync(join(packageDir, 'transcript', 'transcript-revisions.json'), JSON.stringify(list));
    const document = TranscriptDocumentSchema.parse((await server.get(investigator, transcript())).json());
    expect(document).toMatchObject({ sha256: DOCUMENT_SHA, machineTranscriptHash: DOCUMENT_SHA, revision: 2 });
    expect(document.segments.map((segment) => segment.text)).toEqual(['Selamat pagi, silakan duduk.', 'Terima kasih, Pak.']);
  });

  it('the refusals write nothing: a role without TRANSCRIPT_REVISE (403), a stale base (409), no reason (422), a segment the transcript does not have (422), a body outside the schema (422)', async () => {
    const { server, investigator, transcript, evidenceId, hashOf } = await rig('d4tr_refused');
    const listBefore = hashOf(PackageFile.TRANSCRIPT_REVISIONS);
    const technician = await server.signIn('TECHNICIAN');
    const denied = await server.written(async () => {
      const response = await server.post(technician, transcript('/revisions'), REQUEST);
      expect([response.statusCode, codeOf(response), detailsOf(response)['permission']]).toEqual([403, 'NOT_PERMITTED', 'TRANSCRIPT_REVISE']);
    });
    expect(denied.map((row) => row.type)).toEqual(['ACCESS_DENIED']);

    const nothing = await server.written(async () => {
      const stale = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 3 });
      expect([stale.statusCode, codeOf(stale), detailsOf(stale)['currentRevision']]).toEqual([409, 'TRANSCRIPT_REVISION_CONFLICT', 0]);
      for (const note of [undefined, 'abc', 'a  b']) {
        const { note: _note, ...withoutNote } = REQUEST;
        const response = await server.post(investigator, transcript('/revisions'), note === undefined ? withoutNote : { ...withoutNote, note });
        // Pass D6: the contract's body schema itself requires the note (5 to 500 after trimming), so the refusal is the schema's.
        expect([response.statusCode, codeOf(response)], String(note)).toEqual([422, 'INVALID_INPUT']);
      }
      const segment = await server.post(investigator, transcript('/revisions'), { ...REQUEST, changes: [{ segmentIndex: 2, from: 'a', to: 'b' }] });
      expect([segment.statusCode, codeOf(segment), detailsOf(segment)['reason']]).toEqual([422, 'INVALID_INPUT', 'REVISION_SEGMENT_UNKNOWN']);
      for (const bad of [{ baseRevision: 0 }, { ...REQUEST, changes: [] }, { ...REQUEST, extra: true }, { ...REQUEST, baseRevision: -1 }]) {
        expect((await server.post(investigator, transcript('/revisions'), bad)).statusCode, JSON.stringify(bad)).toBe(422);
      }
    });
    expect(nothing).toEqual([]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(0);
    expect(hashOf(PackageFile.TRANSCRIPT_REVISIONS)).toBe(listBefore);
  });

  it('a list that does not continue the stored chain stops the append (503, logged), and the rows are not written; a SUPERVISOR may revise', async () => {
    const { server, investigator, transcript, evidenceId, packageDir, verify } = await rig('d4tr_inconsistent');
    const supervisor = await server.signIn('SUPERVISOR');
    expect((await server.post(supervisor, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    const target = join(packageDir, 'transcript', 'transcript-revisions.json');
    const list = JSON.parse(readFileSync(target, 'utf8')) as { revisions: unknown[] };
    // Somebody removed the record of the stored revision from the package.
    writeFileSync(target, JSON.stringify({ ...list, revisions: [] }));
    const written = await server.written(async () => {
      const response = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 1 });
      expect([response.statusCode, codeOf(response), detailsOf(response)['reason']]).toEqual([503, 'NOT_READY', 'TRANSCRIPT_REVISIONS_FILE_INCONSISTENT']);
      const read = await server.get(investigator, transcript('/revisions'));
      expect([read.statusCode, detailsOf(read)['reason']]).toEqual([503, 'TRANSCRIPT_REVISIONS_FILE_INCONSISTENT']);
    });
    expect(written).toEqual([]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(1);
    expect(server.log.lines().filter((line) => line['code'] === 'TRANSCRIPT_REVISIONS_FILE_INCONSISTENT').length).toBeGreaterThanOrEqual(2);
    // The verifier says the same of that package: the count the database holds is not in the file.
    expect(failing(await verify(1))).toEqual(['V-11 REVISION_COUNT_MISMATCH']);

    // The remains of an append whose unit did not commit (one record MORE than rows) are dropped at the next append.
    writeFileSync(target, JSON.stringify({ ...list, revisions: [list.revisions[0], { ...(list.revisions[0] as object), revisionNo: 2 }] }));
    // Fix wave K (G81b-01): the second correction of the segment starts from the text revision 1 gave it.
    expect((await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 1, changes: [AFTER_FIRST] })).statusCode).toBe(201);
    expect(failing(await verify(2))).toEqual([]);
  });

  it('a package sealed by ANOTHER key (rotated since): the revision is signed by the Core\'s key of today and its certificate is retained in the package, so V-11 verifies it (SEC35-20)', async () => {
    const { server, investigator, transcript, packageDir, coreSigner, built, verify } = await rig('d4tr_rotated', 'OTHER_KEY');
    expect(built.signer.certificate.sha256).not.toBe(coreSigner.certificate.sha256);
    expect(failing(await verify(0))).toEqual([]);
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    expect(readdirSync(join(packageDir, 'certificates'))).toEqual([`${coreSigner.certificate.sha256}.pem`]);
    expect(failing(await verify(1))).toEqual([]);
    // NEGATIVE CONTROL: without the retained certificate the same revision does not verify.
    rmSync(join(packageDir, 'certificates'), { recursive: true });
    expect(failing(await verify(1))).toEqual(['V-11 REVISION_CERTIFICATE_MISSING']);
  });
});

describe('FIX WAVE K, G81b-01 (ruling D221 (2)): operation 85 signs a change only of the CURRENT text of its segment', () => {
  it('a `from` that is not the sealed text is refused 422 REVISION_FROM_NOT_CURRENT_TEXT: no row, no audit row, the package list byte-identical; CONTROL: the true `from` is appended', async () => {
    const { server, investigator, transcript, evidenceId, hashOf } = await rig('wk_from_a');
    const listBefore = hashOf(PackageFile.TRANSCRIPT_REVISIONS);
    const nothing = await server.written(async () => {
      const response = await server.post(investigator, transcript('/revisions'), { ...REQUEST, changes: [{ segmentIndex: 1, from: 'not the sealed text', to: 'Berapa lama?' }] });
      expect([response.statusCode, codeOf(response), detailsOf(response)]).toEqual([422, 'INVALID_INPUT', { in: 'body', member: 'changes', reason: 'REVISION_FROM_NOT_CURRENT_TEXT', segmentIndex: 1, currentRevision: 0 }]);
      // One false change beside a true one refuses the whole request.
      const mixed = await server.post(investigator, transcript('/revisions'), { ...REQUEST, changes: [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'Terima kasih, Bu.' }, { segmentIndex: 0, from: 'Selamat pagi', to: 'Selamat siang' }] });
      expect([mixed.statusCode, detailsOf(mixed)['reason'], detailsOf(mixed)['segmentIndex']]).toEqual([422, 'REVISION_FROM_NOT_CURRENT_TEXT', 0]);
    });
    expect(nothing).toEqual([]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(0);
    expect(hashOf(PackageFile.TRANSCRIPT_REVISIONS)).toBe(listBefore);
    const accepted = await server.written(async () => {
      expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    });
    expect(accepted.map((row) => row.type)).toEqual(['TRANSCRIPT_REVISED']);
  });

  it('after a revision the current text is the head\'s: the sealed text is refused, the revised text is accepted; a moved head stays 409 whatever the `from`', async () => {
    const { server, investigator, transcript, evidenceId } = await rig('wk_from_b');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    const nothing = await server.written(async () => {
      // The head moved (base 0, head 1): 409 for a false AND for a true `from` - the conflict is judged first.
      for (const from of ['not the sealed text', 'Terima kasih, Bu.']) {
        const stale = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 0, changes: [{ segmentIndex: 1, from, to: 'Terima kasih, Ibu.' }] });
        expect([stale.statusCode, codeOf(stale), detailsOf(stale)['currentRevision']], from).toEqual([409, 'TRANSCRIPT_REVISION_CONFLICT', 1]);
      }
      // On the right base, the SEALED text of a segment revision 1 changed is no longer its text.
      const sealedText = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 1, changes: [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'Terima kasih, Ibu.' }] });
      expect([sealedText.statusCode, detailsOf(sealedText)['reason'], detailsOf(sealedText)['currentRevision']]).toEqual([422, 'REVISION_FROM_NOT_CURRENT_TEXT', 1]);
    });
    expect(nothing).toEqual([]);
    // The head's text, and a segment no revision touched (its sealed text), in one request.
    const next = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 1, changes: [{ segmentIndex: 1, from: 'Terima kasih, Bu.', to: 'Terima kasih, Ibu.' }, { segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }] });
    expect(next.statusCode).toBe(201);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(2);
  });
});

describe('operation 86 listTranscriptRevisions', () => {
  it('newest first, with the changes of each signed body; paged by the revision number; an empty page before any revision', async () => {
    const { server, investigator, transcript } = await rig('d4tr_list');
    expect(TranscriptRevisionPageSchema.parse((await server.get(investigator, transcript('/revisions'))).json())).toEqual({ items: [], nextCursor: null });
    // Fix wave K (G81b-01): each correction starts from the CURRENT text - the one before it, not the sealed text again.
    const texts = ['Terima kasih, Pak.', 'Terima kasih, Bu.', 'Terima kasih, Ibu.', 'Terima kasih banyak, Ibu.'];
    for (const [index, to] of texts.slice(1).entries()) {
      const response = await server.post(investigator, transcript('/revisions'), { baseRevision: index, changes: [{ segmentIndex: 1, from: texts[index], to }], note: `Correction number ${index + 1}.` });
      expect(response.statusCode).toBe(201);
    }
    // A SUPERVISOR is inside the case scope of every REAL item (R93-02).
    const all = TranscriptRevisionPageSchema.parse((await server.get(await server.signIn('SUPERVISOR'), transcript('/revisions'))).json());
    expect(all.nextCursor).toBeNull();
    expect(all.items.map((item) => [item.number, item.baseRevision, item.revisionId, item.changes[0]?.to])).toEqual([
      [3, 2, 'TRV-000003', 'Terima kasih banyak, Ibu.'],
      [2, 1, 'TRV-000002', 'Terima kasih, Ibu.'],
      [1, 0, 'TRV-000001', 'Terima kasih, Bu.'],
    ]);
    const first = TranscriptRevisionPageSchema.parse((await server.get(investigator, transcript('/revisions?limit=2'))).json());
    expect([first.items.map((item) => item.number), first.nextCursor]).toEqual([[3, 2], '2']);
    const rest = TranscriptRevisionPageSchema.parse((await server.get(investigator, transcript(`/revisions?limit=2&cursor=${first.nextCursor}`))).json());
    expect([rest.items.map((item) => item.number), rest.nextCursor]).toEqual([[1], null]);
    for (const query of ['cursor=TRV-000001', 'cursor=-1', 'limit=0']) expect((await server.get(investigator, transcript(`/revisions?${query}`))).statusCode, query).toBe(422);
  });

  it('fix wave K (G81b-09): every entry carries `reason` - the note its author gave, as stored - on operation 85\'s answer and on operation 86\'s list; a caller outside the case scope gets no entry at all', async () => {
    const { server, investigator, transcript } = await rig('krtr_reason');
    const notes = ['Corrected the form of address.', TRANSCRIPT_REVISION_REASON_EXAMPLE];
    const texts = ['Terima kasih, Pak.', 'Terima kasih, Bu.', 'Terima kasih, Ibu.'];
    const answered: unknown[] = [];
    for (const [index, note] of notes.entries()) {
      const response = await server.post(investigator, transcript('/revisions'), { baseRevision: index, changes: [{ segmentIndex: 1, from: texts[index], to: texts[index + 1] }], note });
      expect(response.statusCode).toBe(201);
      answered.push(TranscriptRevisionSchema.parse(response.json()).reason);
    }
    expect(answered).toEqual(notes);
    const page = TranscriptRevisionPageSchema.parse((await server.get(investigator, transcript('/revisions'))).json());
    expect(page.items.map((item) => [item.number, item.reason])).toEqual([[2, notes[1]], [1, notes[0]]]);
    // The same access rule as the revision itself: the refusal carries no revision, so no reason.
    const outside = await server.get(await server.signIn('TECHNICIAN'), transcript('/revisions'));
    expect(outside.statusCode).toBe(403);
    expect(JSON.stringify(outside.json())).not.toContain(notes[0]);
    // The contract: optional text; the registry's example of operation 86 carries the member.
    const example = (CORE_API_EXAMPLES.listTranscriptRevisions?.responses?.[200]?.['newest']?.value as { items: { reason?: unknown }[] } | undefined)?.items[0];
    expect(example?.reason).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE);
    expect(TranscriptRevisionSchema.safeParse({ ...page.items[0], reason: 7 }).success).toBe(false);
    const { reason: _reason, ...without } = page.items[0] as Record<string, unknown>;
    expect(TranscriptRevisionSchema.safeParse(without).success).toBe(true);
  });

  it('PASS D6 (F-D4-1 closed) - verify V-11 holds each record the Core WROTE to its signed body: two revisions pass; a removed body is MISSING; an altered reason, author, time or body is TAMPERED, each naming the revision. The Core answers from the table, never from those members', async () => {
    const { server, investigator, transcript, packageDir, verify, evidenceId } = await rig('d6tr_v11');
    // Pass D6 item 6 / R80-01: the replicated item carries the summary of its seal with head 0 before a revision, and the new head after each.
    const summaryOf = () => server.engine.slice('evidence').find((item) => item.id === evidenceId)?.transcript ?? null;
    expect(summaryOf()).toMatchObject({ state: 'READY', revision: 0, failedChunks: 0, backendUnreachable: false });
    const revisionBefore = server.engine.revision;
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    // R80-11: a revision moves the head and keeps what the seal stated.
    expect(summaryOf()).toMatchObject({ state: 'READY', sha256: DOCUMENT_SHA, machineTranscriptHash: DOCUMENT_SHA, revision: 1, failedChunks: 0, backendUnreachable: false });
    expect(server.engine.revision).toBeGreaterThan(revisionBefore);
    expect(EvidenceSliceSchema.safeParse(server.engine.slice('evidence')).success).toBe(true);
    // A refused revision (stale base) moves nothing.
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(409);
    expect(summaryOf()?.revision).toBe(1);
    expect((await server.post(investigator, transcript('/revisions'), { baseRevision: 1, changes: [{ segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }], note: 'Punctuation as it was spoken.' })).statusCode).toBe(201);
    expect(summaryOf()?.revision).toBe(2);
    const target = join(packageDir, 'transcript', 'transcript-revisions.json');
    const written = readFileSync(target, 'utf8');
    const list = JSON.parse(written) as { revisions: Array<Record<string, unknown> & { body: Record<string, unknown> }> };
    const [first, second] = list.revisions as [(typeof list.revisions)[number], (typeof list.revisions)[number]];
    const findingsOf = async (revisions: unknown[]): Promise<unknown[]> => {
      writeFileSync(target, JSON.stringify({ ...list, revisions }));
      const result = await verify(2);
      expect(result.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-11']);
      return [result.overall, ...(result.checks.find((check) => check.id === 'V-11')?.findings ?? [])];
    };

    // CONTROL: what the product writer wrote verifies, every check.
    expect(failing(await verify(2))).toEqual([]);

    // (1) the body of revision 2 REMOVED.
    const { body: _body, ...bodiless } = second;
    expect(await findingsOf([first, bodiless])).toEqual(['MISSING', { code: 'REVISION_BODY_MISSING', failureClass: 'MISSING', revisionNo: 2 }]);
    // (2) to (4) the record's reason / author / time changed beside an untouched signed body.
    for (const [member, value] of [['reason', 'A reason nobody gave.'], ['authorId', 'OPR-999'], ['createdAt', 1]] as const) {
      expect(await findingsOf([{ ...first, [member]: value }, second]), member).toEqual(['TAMPERED', { code: 'REVISION_MEMBER_MISMATCH', failureClass: 'TAMPERED', revisionNo: 1, member }]);
    }
    // (5) the BODY changed (its text, and its reason together with the record's): the signed hash is no longer its hash.
    const changes = [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'Words nobody said.' }];
    expect(await findingsOf([first, { ...second, body: { ...second.body, changes } }])).toEqual(['TAMPERED', { code: 'REVISION_BODY_HASH_MISMATCH', failureClass: 'TAMPERED', revisionNo: 2 }]);
    expect(await findingsOf([{ ...first, reason: 'A reason nobody gave.', body: { ...first.body, reason: 'A reason nobody gave.' } }, second])).toEqual(['TAMPERED', { code: 'REVISION_BODY_HASH_MISMATCH', failureClass: 'TAMPERED', revisionNo: 1 }]);

    // The Core's own read is not fooled by a changed record: the author is the table's, the changes the signed body's.
    writeFileSync(target, JSON.stringify({ ...list, revisions: [{ ...first, authorId: 'OPR-999', reason: 'A reason nobody gave.', createdAt: 1 }, second] }));
    const page = TranscriptRevisionPageSchema.parse((await server.get(investigator, transcript('/revisions'))).json());
    expect(page.items.map((item) => [item.number, item.authorId])).toEqual([[2, investigator.operator.id], [1, investigator.operator.id]]);
    expect(page.items[1]?.changes[0]?.to).toBe('Terima kasih, Bu.');
    expect((await server.owner.query('SELECT reason FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no', [evidenceId])).rows[0]).toEqual({ reason: REQUEST.note });
    // And it refuses to answer changes it cannot tie to the signed hash.
    writeFileSync(target, JSON.stringify({ ...list, revisions: [first, bodiless] }));
    expect((await server.get(investigator, transcript('/revisions'))).statusCode).toBe(503);

    // Restored byte for byte: it verifies again (the failures above came from the alterations only).
    writeFileSync(target, written);
    expect(failing(await verify(2))).toEqual([]);
  });
});

// Integration pass D11 (pass D10 item 5, Core half): `transcript.revision` of the replicated item is
// a summary no row of the engine's state holds. Operation 85 puts it on the item; a state the
// engine reads back at a start carried none until the next revision. The boot step
// `transcripts.heads` reads the newest number per item from the revisions table and hands it to
// the same engine door.
describe('PASS D11: the revision head of a replicated item after a restart of the Core', () => {
  const summaryOf = (server: SessionsApp, evidenceId: string) => server.engine.slice('evidence').find((item) => item.id === evidenceId)?.transcript ?? null;
  const stepsOf = (server: SessionsApp): string[] => server.log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));

  it('revise -> restart -> the item carries the revision number without a new revision; the stored rows and the package are what they were', async () => {
    const { server, investigator, transcript, evidenceId, hashOf, restart, built } = await rig('d11tr_restart');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    // Operation 85 put the head on the item of the running Core (pass D6).
    expect(summaryOf(server, evidenceId)).toMatchObject({ revision: 1, machineTranscriptHash: DOCUMENT_SHA });
    const rowsBefore = (await server.owner.query('SELECT revision_no, sha256 FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no', [evidenceId])).rows;
    expect(rowsBefore).toHaveLength(1);
    const listBefore = hashOf(PackageFile.TRANSCRIPT_REVISIONS);

    const again = await restart();
    // The boot step ran after the engine's (it reads the engine's state) and published the head: the same summary a live revision leaves.
    expect(stepsOf(again)).toContain(TRANSCRIPT_HEADS_BOOT_STEP);
    // R80-01: the WHOLE summary is read back from the signed manifest of the package - state, failed chunks, the unreachable backend - with the head of the table.
    expect(summaryOf(again, evidenceId)).toEqual(evidenceTranscriptSummary(built.manifest.transcript, 1));
    expect(summaryOf(again, evidenceId)).toMatchObject({ state: 'READY', sha256: DOCUMENT_SHA, machineTranscriptHash: DOCUMENT_SHA, revision: 1, failedChunks: 0, backendUnreachable: false });
    expect(EvidenceSliceSchema.safeParse(again.engine.slice('evidence')).success).toBe(true);
    // No new revision was made: the rows and the package list are the same.
    expect((await again.owner.query('SELECT revision_no, sha256 FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no', [evidenceId])).rows).toEqual(rowsBefore);
    expect(hashOf(PackageFile.TRANSCRIPT_REVISIONS)).toBe(listBefore);
    // Operation 84 answers the same head from the table.
    const reader = await again.signIn('INVESTIGATOR');
    expect(TranscriptDocumentSchema.parse((await again.get(reader, transcript())).json()).revision).toBe(1);
  });

  it('R80-01 - an item WITHOUT a revision has its summary too, before and after a restart: the state the seal signed, head 0 (the number comes from the revisions table, never from the item)', async () => {
    const { server, evidenceId, restart, built } = await rig('d11tr_unrevised');
    // The seal wrote it with the item.
    expect(summaryOf(server, evidenceId)).toEqual(evidenceTranscriptSummary(built.manifest.transcript, 0));
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n).toBe(0);
    const again = await restart();
    expect(stepsOf(again)).toContain(TRANSCRIPT_HEADS_BOOT_STEP);
    // No column holds the summary: the boot step read it back from the signed manifest.
    expect(summaryOf(again, evidenceId)).toEqual(evidenceTranscriptSummary(built.manifest.transcript, 0));
    expect(summaryOf(again, evidenceId)).toMatchObject({ state: 'READY', revision: 0 });
    expect(again.log.lines().filter((line) => line['code'] === TRANSCRIPT_HEAD_NOT_PUBLISHED)).toEqual([]);
  });

  it('a summary that cannot be read back is never guessed and never refuses the start: the manifest is gone from the package -> the item has NO summary (no state, no revision), the failure is in the log by its code, the Core serves', async () => {
    const { server, investigator, transcript, evidenceId, packageDir, restart } = await rig('d11tr_no_document');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    rmSync(join(packageDir, PackageFile.MANIFEST));
    const again = await restart();
    expect(stepsOf(again)).toContain(TRANSCRIPT_HEADS_BOOT_STEP);
    expect(summaryOf(again, evidenceId)).toBeNull();
    // ONE line for the failures of a start (pass E3 item 3), naming the item and the true count.
    expect(again.log.lines().filter((line) => line['code'] === TRANSCRIPT_HEAD_NOT_PUBLISHED).map((line) => [line['level'], line['items'], line['evidenceIds']])).toEqual([[50, 1, [evidenceId]]]);
    expect(again.app.readiness.isReady()).toBe(true);
  });
});

describe('MIGRATION 0013 (dbc-7; ruling D162): a revision signed with the PRODUCT key is stored under the key ID of the specification', () => {
  it('the Core\'s key is named CORE-KEY-EVSIGN-01 (not the CODE form the table took until 0013): operation 85 answers 201, the row holds that ID, the package record holds the same ID, and V-11 passes', async () => {
    // No `provideRevisionSigner` here: the signer is the one the product loads (the seam stays for the other cases).
    const { server, investigator, transcript, evidenceId, hashOf, coreSigner, verify, packageDir } = await rig('d4tr_product_key', 'CORE_KEY', 'PRODUCT_KEY');
    expect(coreSigner.signer.keyId).toBe(CORE_EVIDENCE_SIGNING_KEY_ID);
    expect(CORE_EVIDENCE_SIGNING_KEY_ID).toBe('CORE-KEY-EVSIGN-01');
    // The rule the table had (the CODE form) refuses the ID; the key-id form of 0013 takes it.
    expect(/^[A-Z][A-Z0-9_]{0,63}$/.test(CORE_EVIDENCE_SIGNING_KEY_ID)).toBe(false);
    expect(/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(CORE_EVIDENCE_SIGNING_KEY_ID)).toBe(true);
    const check = (await server.owner.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'transcript_revisions_key_id_check'")).rows[0] as { definition: string };
    expect(check.definition).toContain("'^[A-Z0-9][A-Z0-9_-]{0,63}$'");

    expect(failing(await verify(0))).toEqual([]);
    const sealedFiles = [PackageFile.MANIFEST, PackageFile.SIGNATURE, PackageFile.TRANSCRIPT_JSON].map((name) => [name, hashOf(name)]);
    const response = await server.post(investigator, transcript('/revisions'), REQUEST);
    expect(response.statusCode).toBe(201);
    expect(server.log.lines().some((line) => line['code'] === 'SIGNING_KEY_ID_NOT_STORABLE')).toBe(false);

    // STORED: one row, signed by the product key, a real Ed25519 signature bound to the key's certificate.
    const rows = (await server.owner.query('SELECT revision_no, signature_key_id, signature_algorithm, signature_simulated, signature_certificate_sha256, char_length(signature_value) AS signature_chars FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows;
    expect(rows).toEqual([{ revision_no: 1, signature_key_id: 'CORE-KEY-EVSIGN-01', signature_algorithm: 'Ed25519', signature_simulated: false, signature_certificate_sha256: coreSigner.certificate.sha256, signature_chars: 128 }]);
    // The stored ID equals the ID of the package record and of the item's own signature (one ID, three places; no rewriting).
    const list = JSON.parse(readFileSync(join(packageDir, ...PackageFile.TRANSCRIPT_REVISIONS.split('/')), 'utf8')) as { revisions: { revisionNo: number; signature: { keyId: string } }[] };
    expect(list.revisions.map((record) => [record.revisionNo, record.signature.keyId])).toEqual([[1, 'CORE-KEY-EVSIGN-01']]);
    expect((await server.owner.query('SELECT signature_key_id FROM public.evidence_items WHERE id = $1', [evidenceId])).rows).toEqual([{ signature_key_id: 'CORE-KEY-EVSIGN-01' }]);

    // VERIFY: the package with its one revision passes every check, V-11 among them; the sealed files are what they were.
    const verified = await verify(1);
    expect(failing(verified)).toEqual([]);
    expect(verified.checks.find((entry) => entry.id === 'V-11')?.status).toBe('PASS');
    expect([PackageFile.MANIFEST, PackageFile.SIGNATURE, PackageFile.TRANSCRIPT_JSON].map((name) => [name, hashOf(name)])).toEqual(sealedFiles);
    // CONTROL: the check can fail - the verifier expecting NO revision refuses the same package.
    expect(failing(await verify(0))).not.toEqual([]);

    // A second revision by the same key continues the chain, and the reads answer both.
    const second = await server.post(investigator, transcript('/revisions'), { baseRevision: 1, changes: [{ segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }], note: 'Punctuation of the greeting.' });
    expect(second.statusCode).toBe(201);
    expect(failing(await verify(2))).toEqual([]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1 AND signature_key_id = $2', [evidenceId, 'CORE-KEY-EVSIGN-01'])).rows[0]?.n).toBe(2);
    expect((await server.get(investigator, transcript())).json()).toMatchObject({ revision: 2 });
  });
});

// Closing pass F-X, finding R80-08 (code review row 80): THE TABLE IS THE JOURNAL. A revision is a
// row first; the new list is STAGED under a fixed name inside the unit, and renamed over the real
// list only after the commit. The commit is made to fail by a DEFERRED constraint trigger on the
// throw-away clone (it fires at COMMIT, after every act of the unit - the file step among them);
// it refuses only a revision whose reason is `REFUSED_NOTE`, so nothing has to be dropped or replaced.
describe('R80-08: the revision list of the package is replaced only AFTER the commit; the staged list is judged by the table', () => {
  const realOf = (packageDir: string): string => join(packageDir, 'transcript', 'transcript-revisions.json');
  const stagedOf = (packageDir: string): string => `${realOf(packageDir)}.next`;
  const SEALED_TRANSCRIPT_FOLDER = ['transcript-revisions.json', 'transcript.json', 'transcript.srt', 'transcript.vtt'];
  const rowsOf = async (server: SessionsApp, evidenceId: string): Promise<number> => (await server.owner.query('SELECT count(*)::int AS n FROM public.transcript_revisions WHERE evidence_id = $1', [evidenceId])).rows[0]?.n as number;
  async function refuseCommits(server: SessionsApp): Promise<void> {
    await server.owner.query(`CREATE FUNCTION public.r8008_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = '${REFUSED_NOTE}' THEN RAISE EXCEPTION 'the commit is refused (R80-08 test)'; END IF; RETURN NULL; END $$`);
    await server.owner.query('CREATE CONSTRAINT TRIGGER r8008_refuse AFTER INSERT ON public.transcript_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.r8008_refuse()');
  }
  const REFUSED_NOTE = 'This revision is refused at the commit.';
  const second = { ...REQUEST, baseRevision: 1, changes: [{ segmentIndex: 0, from: 'Selamat pagi, silakan duduk.', to: 'Selamat pagi. Silakan duduk.' }], note: 'Punctuation as spoken.' };

  it('(a) CRASH POINT 1 - the commit fails after the file step: no row, no audit row, and NO signed record in the package list (byte-identical), no staged file left; the next append works', async () => {
    const { server, investigator, transcript, evidenceId, packageDir, verify } = await rig('r8008_commit_fails');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    const before = readFileSync(realOf(packageDir));
    await refuseCommits(server);
    const written = await server.written(async () => {
      const failed = await server.post(investigator, transcript('/revisions'), { ...second, note: REFUSED_NOTE });
      expect(failed.statusCode).toBeGreaterThanOrEqual(500);
    });
    expect(written).toEqual([]);
    expect(await rowsOf(server, evidenceId)).toBe(1);
    // THE FINDING: a signed record of a revision the Core never recorded must not be in the package.
    expect(readFileSync(realOf(packageDir)).equals(before)).toBe(true);
    expect(readdirSync(join(packageDir, 'transcript')).sort()).toEqual(SEALED_TRANSCRIPT_FOLDER);
    expect(failing(await verify(1))).toEqual([]);
    // The staged list of the refused append was settled at once: the table judged it (a warn entry, by its code).
    expect(server.log.lines().filter((line) => line['code'] === 'TRANSCRIPT_REVISION_STAGED_LIST_DISCARDED').map((line) => line['staged'])).toEqual(['DISCARDED_UNCOMMITTED']);
    expect((await server.post(investigator, transcript('/revisions'), second)).statusCode).toBe(201);
    expect(await rowsOf(server, evidenceId)).toBe(2);
    expect(readdirSync(join(packageDir, 'transcript')).sort()).toEqual(SEALED_TRANSCRIPT_FOLDER);
    const verified = await verify(2);
    expect(failing(verified)).toEqual([]);
    expect(verified.checks.find((entry) => entry.id === 'V-11')?.status).toBe('PASS');
  });

  it('commit done, rename missing, in the SAME process: operation 86 answers from the staged list without touching a file; the next append finishes the rename first and never builds on the stale list', async () => {
    const { server, investigator, transcript, evidenceId, packageDir, verify } = await rig('r8008_rename_pending');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    const one = readFileSync(realOf(packageDir));
    expect((await server.post(investigator, transcript('/revisions'), second)).statusCode).toBe(201);
    const two = readFileSync(realOf(packageDir));
    // The state a rename that failed leaves: two rows, the real list of ONE record, the staged list of two.
    writeFileSync(stagedOf(packageDir), two);
    writeFileSync(realOf(packageDir), one);
    const page = await server.get(investigator, transcript('/revisions'));
    expect(page.statusCode).toBe(200);
    expect(TranscriptRevisionPageSchema.parse(page.json()).items.map((entry) => [entry.number, entry.changes[0]?.to])).toEqual([[2, 'Selamat pagi. Silakan duduk.'], [1, 'Terima kasih, Bu.']]);
    expect(readFileSync(realOf(packageDir)).equals(one)).toBe(true);
    expect(existsSync(stagedOf(packageDir))).toBe(true);
    // Fix wave K (G81b-01): the third correction starts from the text revision 1 gave the segment (read from the list the append settles).
    const third = await server.post(investigator, transcript('/revisions'), { ...REQUEST, baseRevision: 2, changes: [AFTER_FIRST], note: 'A third correction of the same segment.' });
    expect(third.statusCode).toBe(201);
    expect(await rowsOf(server, evidenceId)).toBe(3);
    const list = TranscriptRevisionsFileSchema.parse(JSON.parse(readFileSync(realOf(packageDir), 'utf8')));
    expect(list.revisions.map((record) => record.revisionNo)).toEqual([1, 2, 3]);
    expect(Buffer.from(JSON.stringify(list.revisions.slice(0, 2)))).toEqual(Buffer.from(JSON.stringify(TranscriptRevisionsFileSchema.parse(JSON.parse(two.toString('utf8'))).revisions)));
    expect(readdirSync(join(packageDir, 'transcript')).sort()).toEqual(SEALED_TRANSCRIPT_FOLDER);
    expect(failing(await verify(3))).toEqual([]);
  });

  it('(b) CRASH POINT 2 through a real start: two rows, the real list of one record, the staged list of two -> the boot step finishes the rename; the head is 2, V-11 passes, the list is the staged bytes', async () => {
    const { server, investigator, transcript, evidenceId, packageDir, verify, restart } = await rig('r8008_boot_heal');
    expect((await server.post(investigator, transcript('/revisions'), REQUEST)).statusCode).toBe(201);
    const one = readFileSync(realOf(packageDir));
    expect((await server.post(investigator, transcript('/revisions'), second)).statusCode).toBe(201);
    const two = readFileSync(realOf(packageDir));
    writeFileSync(stagedOf(packageDir), two);
    writeFileSync(realOf(packageDir), one);
    // CONTROL: the package as the crash left it does NOT verify against the table's count (V-11), and the verifier names the
    // staged file - as the notice REVISION_APPEND_PENDING, not as a V-14 failure (fix pass F-M7c, ruling D187; pass F-Z).
    const crashed = await verify(2);
    expect(failing(crashed)).toEqual(['V-11 REVISION_COUNT_MISMATCH']);
    expect(noticed(crashed)).toContain('REVISION_APPEND_PENDING');
    const again = await restart();
    expect(readFileSync(realOf(packageDir)).equals(two)).toBe(true);
    expect(readdirSync(join(packageDir, 'transcript')).sort()).toEqual(SEALED_TRANSCRIPT_FOLDER);
    const verified = await verify(2);
    expect(failing(verified)).toEqual([]);
    expect(noticed(verified)).not.toContain('REVISION_APPEND_PENDING');
    expect(verified.checks.find((entry) => entry.id === 'V-11')?.status).toBe('PASS');
    expect(again.engine.slice('evidence').find((item) => item.id === evidenceId)?.transcript?.revision).toBe(2);
    const reader = await again.signIn('INVESTIGATOR');
    expect(TranscriptRevisionPageSchema.parse((await again.get(reader, transcript('/revisions'))).json()).items.map((entry) => entry.number)).toEqual([2, 1]);
  });
});
