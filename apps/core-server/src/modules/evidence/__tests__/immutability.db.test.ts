// AC-B-69, SR-59, I11: sealed evidence is immutable. After a verification, an export, an archive
// and an evidence tamper fault, the tracks, the track hashes, the manifest hash and the signature
// of the item are unchanged (plan row W35; spec §7.9 domain rules, §12.3; engine host F-8).
//
// THE PROOF IS BYTE-LEVEL AND ON THE STORED ROWS. Before the first step and after every step
// PostgreSQL itself digests (SHA-256) the item's row without its seven columns the runtime role
// may update, and its four track rows whole, each printed as `to_jsonb(row)::text`. The digest is
// compared; so are the sealed members one by one, the row VERSION of each track row (no statement
// rewrote it, not even with equal values), and the same digest over every OTHER item.
//
// The verification, the export and the archive go through the module's routes. The tamper fault
// is injected through the ENGINE HOST (`app.engine.command(…, 'inject', 'TAMPER', { evidenceId })`),
// not through a route: the demo-control module is another row.
import { EvidenceDetailSchema, EvidenceVerifyResultSchema } from '@dems/shared/api';
import { TrackId } from '@dems/shared/domain';
import { EVIDENCE_STATUS_STAGE, type EvidenceItem } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { sqlStateOf } from '../../../core';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { storedSlices } from '../../../../test/support/engine';
import {
  allSealedDigest,
  archiveUrl,
  evidenceApp,
  exportUrl,
  itemUrl,
  principalOf,
  sealSession,
  sealedDigest,
  sealedMembers,
  storedCustody,
  storedState,
  trackRowVersions,
  trailLength,
  trailSince,
  verifyUrl,
  type EvidenceApp,
  type Headers,
  type SealedMembers,
  type StoredDigest,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let host: EvidenceApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;

const SUPERVISOR = principalOf('SUPERVISOR');

beforeAll(async () => {
  owner = db.ownerPool();
  host = await evidenceApp(db, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
});

beforeEach(() => {
  host.forgetCounters();
});

/** The untampered SEALED items of the seed, in the engine's order: each test takes its own. */
const sealedSeeded = (): EvidenceItem[] => host.engine.slice('evidence').filter((item) => item.status === 'SEALED' && !item.tampered);

interface Sealed {
  readonly digest: StoredDigest;
  readonly members: SealedMembers;
  readonly versions: string[];
}

async function sealedOf(evidenceId: string): Promise<Sealed> {
  return { digest: await sealedDigest(owner, evidenceId), members: await sealedMembers(owner, evidenceId), versions: await trackRowVersions(owner, evidenceId) };
}

/** The digest over every item and track of the database EXCEPT the item under test. */
async function othersDigest(evidenceId: string): Promise<string> {
  const { rows } = await owner.query<{ digest: string }>(
    `WITH sealed AS (
       SELECT 0 AS part, i.id AS item, 0 AS place,
              (to_jsonb(i) - 'status' - 'lifecycle_stage' - 'verification_status' - 'verification_at' - 'tampered' - 'tampered_track_id' - 'updated_at')::text AS line
         FROM public.evidence_items AS i WHERE i.id <> $1
       UNION ALL
       SELECT 1, t.evidence_id, t.position, to_jsonb(t)::text FROM public.evidence_tracks AS t WHERE t.evidence_id <> $1
     )
     SELECT encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' ORDER BY part, item, place), ''), 'UTF8')), 'hex') AS digest FROM sealed`,
    [evidenceId],
  );
  return rows[0]?.digest ?? '';
}

/** The sealed members as an answer of the API gives them, and as the engine holds them. */
async function sealedInAnswer(evidenceId: string): Promise<SealedMembers> {
  const response = await host.get(itemUrl(evidenceId), investigator);
  expect(response.statusCode).toBe(200);
  const { evidence } = EvidenceDetailSchema.parse(response.json());
  return {
    manifestHash: evidence.manifestHash,
    signature: evidence.signature,
    tracks: evidence.tracks.map((track, index) => ({ trackId: track.trackId, position: index + 1, label: track.label, sizeBytes: track.sizeBytes, sha256: track.sha256 })),
  };
}

function sealedInEngine(evidenceId: string): SealedMembers {
  const item = host.engine.slice('evidence').find((entry) => entry.id === evidenceId);
  if (item === undefined) throw new Error('the engine does not hold the item');
  return {
    manifestHash: item.manifestHash,
    signature: item.signature,
    tracks: item.tracks.map((track, index) => ({ trackId: track.trackId, position: index + 1, label: track.label, sizeBytes: track.sizeBytes, sha256: track.sha256 })),
  };
}

interface Step {
  readonly label: string;
  run(): Promise<void>;
  /** What the step must have changed, of what MAY change. */
  readonly after: { status: string; verification: string; tampered: boolean; custodyAction: string | null };
}

/**
 * Runs the steps on one item and proves after each that nothing sealed moved. Returns the lines
 * of the proof, for the row's document.
 */
async function proveImmutable(item: EvidenceItem, steps: readonly Step[]): Promise<string[]> {
  const baseline = await sealedOf(item.id);
  const others = await othersDigest(item.id);
  const custodyAtStart = await storedCustody(owner, item.id);
  // The item row without its mutable columns, and four track rows.
  expect(baseline.digest.rows).toBe(5);
  expect(baseline.members.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
  expect(await sealedInAnswer(item.id)).toEqual(baseline.members);
  expect(sealedInEngine(item.id)).toEqual(baseline.members);

  const lines = [`[w35] AC-B-69 ${item.id} (${item.integritySource ?? 'no source'}): SHA-256 of the stored sealed rows (item row without its 7 mutable columns + 4 track rows)`];
  lines.push(`[w35]   before                                  ${baseline.digest.digest}  rows ${baseline.digest.rows}`);
  let custody = custodyAtStart.length;

  for (const step of steps) {
    await step.run();
    const now = await sealedOf(item.id);
    // 1. Byte-equal: the digest PostgreSQL computes over the stored rows.
    expect(now.digest, step.label).toEqual(baseline.digest);
    // 2. Member by member: tracks (ID, position, label, size, hash), manifest hash, signature.
    expect(now.members, step.label).toEqual(baseline.members);
    // 3. No track row was rewritten at all.
    expect(now.versions, step.label).toEqual(baseline.versions);
    // 4. No other item and no other track was touched.
    expect(await othersDigest(item.id), step.label).toBe(others);
    // 5. The answers and the engine say the same.
    expect(await sealedInAnswer(item.id), step.label).toEqual(baseline.members);
    expect(sealedInEngine(item.id), step.label).toEqual(baseline.members);

    // What the step DID change is of the six columns a command or a fault may change, and custody only grew.
    const state = await storedState(owner, item.id);
    expect({ status: state.status, verification: state.verificationStatus, tampered: state.tampered }, step.label).toEqual({
      status: step.after.status,
      verification: step.after.verification,
      tampered: step.after.tampered,
    });
    const entries = await storedCustody(owner, item.id);
    expect(entries.slice(0, custodyAtStart.length), step.label).toEqual(custodyAtStart);
    if (step.after.custodyAction === null) {
      expect(entries, step.label).toHaveLength(custody);
    } else {
      expect(entries, step.label).toHaveLength(custody + 1);
      expect(entries.at(-1)?.action, step.label).toBe(step.after.custodyAction);
      custody += 1;
    }
    lines.push(`[w35]   after ${step.label.padEnd(33)} ${now.digest.digest}  equal; status ${state.status}, verification ${state.verificationStatus}, tampered ${String(state.tampered)}, custody ${entries.length}`);
  }
  // The tables and the engine still hold the same state, slice by slice.
  expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  return lines;
}

/** The six steps of the criterion, in an order in which each can run: the export needs an item that is not archived. */
function journey(item: EvidenceItem, trackId: TrackId = TrackId.AUDIO_02): Step[] {
  const post = async (url: string, session: Headers, expected: number, payload?: Record<string, unknown>): Promise<unknown> => {
    const response = await host.post(url, session, payload);
    expect(response.statusCode, url).toBe(expected);
    return expected === 204 ? undefined : (response.json() as unknown);
  };
  return [
    {
      label: 'verify (every hash matches)',
      run: async () => {
        expect(EvidenceVerifyResultSchema.parse(await post(verifyUrl(item.id), investigator, 200))).toMatchObject({ ok: true });
      },
      after: { status: 'SEALED', verification: 'PASS', tampered: false, custodyAction: 'VERIFIED' },
    },
    {
      label: `evidence TAMPER fault (${trackId})`,
      run: async () => {
        await host.engine.command(SUPERVISOR, 'inject', 'TAMPER', { evidenceId: item.id, trackId });
        expect((await storedState(owner, item.id)).tamperedTrackId).toBe(trackId);
      },
      // The fault marks the item and sets its verification back to NOT_RUN: the verdict of before no longer stands.
      after: { status: 'SEALED', verification: 'NOT_RUN', tampered: true, custodyAction: null },
    },
    {
      label: 'verify (fails on the track)',
      run: async () => {
        const verdict = EvidenceVerifyResultSchema.parse(await post(verifyUrl(item.id), investigator, 200));
        expect(verdict.ok).toBe(false);
        expect(verdict.tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual([trackId]);
        // "expected" is still the sealed hash of the track.
        expect(verdict.tracks.map((track) => track.expected)).toEqual(item.tracks.map((track) => track.sha256));
      },
      after: { status: 'SEALED', verification: 'FAIL', tampered: true, custodyAction: 'VERIFY_FAILED' },
    },
    {
      label: 'the fault cleared',
      run: async () => {
        await host.engine.command(SUPERVISOR, 'clearFault', 'TAMPER', { evidenceId: item.id, trackId });
        expect((await storedState(owner, item.id)).tamperedTrackId).toBeNull();
      },
      after: { status: 'SEALED', verification: 'NOT_RUN', tampered: false, custodyAction: null },
    },
    {
      label: 'export',
      run: async () => {
        expect(await post(exportUrl(item.id), supervisor, 202, { reason: 'Prosecutor request', destination: 'Case file transfer' })).toMatchObject({ evidenceId: item.id, status: 'EXPORTED' });
        expect((await storedState(owner, item.id)).lifecycleStage).toBe(EVIDENCE_STATUS_STAGE.EXPORTED);
      },
      after: { status: 'EXPORTED', verification: 'NOT_RUN', tampered: false, custodyAction: 'EXPORTED' },
    },
    {
      label: 'archive',
      run: async () => {
        await post(archiveUrl(item.id), supervisor, 204);
        expect((await storedState(owner, item.id)).lifecycleStage).toBe(EVIDENCE_STATUS_STAGE.ARCHIVED);
      },
      after: { status: 'ARCHIVED', verification: 'NOT_RUN', tampered: false, custodyAction: 'ARCHIVED' },
    },
  ];
}

describe('AC-B-69: after verify, export, archive and an evidence tamper fault the sealed rows of the item are byte-equal', () => {
  it('a dataset item (hashes of its demo package): six steps, one digest', async () => {
    const item = sealedSeeded()[0];
    if (item === undefined) throw new Error('the seed has sealed evidence');
    expect(item.integritySource).toBe('DEMO_PACKAGE');
    const whole = await allSealedDigest(owner);
    const trailBefore = await trailLength(owner);

    const lines = await proveImmutable(item, journey(item));
    console.info(lines.join('\n'));

    // The steps were real: each wrote its audit row, in this order, and nothing else was written.
    const rows = await trailSince(owner, trailBefore);
    expect(rows.map((row) => row.type)).toEqual(['EVIDENCE_VERIFIED', 'FAULT_RAISED', 'EVIDENCE_VERIFY_FAILED', 'FAULT_CLEARED', 'EVIDENCE_EXPORTED', 'EVIDENCE_ARCHIVED']);
    // The five that are about the item name it (the clearing of a fault names its kind only).
    expect(rows.filter((row) => row.evidenceId === item.id).map((row) => row.type)).toEqual(['EVIDENCE_VERIFIED', 'FAULT_RAISED', 'EVIDENCE_VERIFY_FAILED', 'EVIDENCE_EXPORTED', 'EVIDENCE_ARCHIVED']);
    // The same digest over ALL 13 items and 52 tracks did not move either.
    expect(await allSealedDigest(owner)).toEqual(whole);
    expect(whole.rows).toBe(13 + 13 * 4);
    console.info(`[w35] AC-B-69 all ${whole.rows} sealed rows of the database (13 items, 52 tracks): ${whole.digest} before and after`);
  });

  it.each([TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.AUDIO_01, TrackId.AUDIO_02])('the tamper fault on %s: the same six steps on another item, the same result', async (trackId) => {
    const index = 1 + [TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.AUDIO_01, TrackId.AUDIO_02].indexOf(trackId);
    const item = sealedSeeded().filter((entry) => entry.verification.status === 'NOT_RUN')[index];
    if (item === undefined) throw new Error('the seed has enough sealed evidence');
    const lines = await proveImmutable(item, journey(item, trackId));
    console.info(`${lines[0]}\n${lines[1]}\n${lines.at(-1)}`);
  });

  it('an item the ENGINE sealed (a session recorded through hosted commands, simulated hashes): six steps, one digest', async () => {
    const item = await sealSession(host);
    expect(item).toMatchObject({ status: 'SEALED', integritySource: 'SIMULATED', tampered: false });
    const lines = await proveImmutable(item, journey(item));
    console.info(lines.join('\n'));
  });

  it('the dataset\'s own tampered item: a failed verification and an archive leave its sealed rows byte-equal, and its sealed AUDIO-02 hash is still the one it was sealed with', async () => {
    const item = host.engine.slice('evidence').find((entry) => entry.tampered);
    if (item === undefined) throw new Error('the seed has a tampered item');
    const before = await sealedOf(item.id);
    const failed = await host.post(verifyUrl(item.id), investigator);
    expect(EvidenceVerifyResultSchema.parse(failed.json())).toMatchObject({ ok: false });
    expect((await host.post(archiveUrl(item.id), supervisor)).statusCode).toBe(204);
    const after = await sealedOf(item.id);
    expect(after).toEqual(before);
    expect(after.members.tracks.find((track) => track.trackId === 'AUDIO-02')?.sha256).toBe(item.tracks.find((track) => track.trackId === 'AUDIO-02')?.sha256);
  });
});

describe('why nothing sealed can move: the runtime role may not write it (database contract §7.3)', () => {
  it('as dems_app, an UPDATE of a sealed column or of a track, and a DELETE of a track or a custody entry, are refused by privilege (42501)', async () => {
    const item = sealedSeeded()[0];
    if (item === undefined) throw new Error('the seed has sealed evidence');
    const runtime = db.appPool();
    const refused = async (statement: string, values: unknown[]): Promise<string | undefined> =>
      runtime.query(statement, values).then(
        () => 'accepted',
        (error: unknown) => sqlStateOf(error),
      );
    const zeros = '0'.repeat(64);
    const before = await sealedOf(item.id);
    expect(await refused('UPDATE public.evidence_tracks SET sha256 = $2 WHERE evidence_id = $1', [item.id, zeros])).toBe('42501');
    expect(await refused('UPDATE public.evidence_items SET manifest_hash = $2 WHERE id = $1', [item.id, zeros])).toBe('42501');
    expect(await refused('UPDATE public.evidence_items SET signature_value = $2 WHERE id = $1', [item.id, zeros])).toBe('42501');
    expect(await refused('DELETE FROM public.evidence_tracks WHERE evidence_id = $1', [item.id])).toBe('42501');
    expect(await refused('DELETE FROM public.evidence_custody WHERE evidence_id = $1', [item.id])).toBe('42501');
    expect(await refused('UPDATE public.evidence_custody SET action = $2 WHERE evidence_id = $1', [item.id, 'ERASED'])).toBe('42501');
    expect(await sealedOf(item.id)).toEqual(before);
  });
});
