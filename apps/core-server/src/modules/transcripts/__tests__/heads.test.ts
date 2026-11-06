// Integration pass E3 item 3: the boot step `transcripts.heads` is SILENT for every normal state and
// says ONE line for the real failures of a start. No database: the step is handed rows and a state.
// (On the bulk fixture itself: `test/acceptance/restart.test.ts`, the long-history case, which
// expects no error line from three starts over 30 revision rows of SIMULATED items.)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { HEADS_NAMED_IN_A_FAILURE, TRANSCRIPT_HEAD_NOT_PUBLISHED, publishRevisionHeads } from '../heads';

const store = mkdtempSync(join(tmpdir(), 'dems-e3-heads-'));
afterAll(() => rmSync(store, { recursive: true, force: true }));

const SHA = 'ab'.repeat(32);
const STAND_IN = { algorithm: 'SIMULATED-SHA256', simulated: true };
const SIGNED = { algorithm: 'Ed25519', simulated: false };
const item = (sequence: number, more: Record<string, unknown>) => ({ id: `EV-20261010-${String(sequence).padStart(4, '0')}`, sessionId: `SES-20261010-${String(sequence).padStart(4, '0')}`, ...more });

function rig(evidence: readonly Record<string, unknown>[], revised: readonly string[]) {
  const lines: Record<string, unknown>[] = [];
  const persisted: Record<string, unknown>[] = [];
  const level = (name: string) => (fields: Record<string, unknown>, msg: string) => void lines.push({ level: name, msg, ...fields });
  const app = {
    log: { error: level('error'), warn: level('warn'), info: level('info') },
    errorLog: { append: (entry: Record<string, unknown>) => void persisted.push(entry) },
    db: { read: async () => ({ rows: revised.map((evidenceId) => ({ evidence_id: evidenceId, revision: '2', json_sha256: SHA, labels_status: 'LABELLED' })) }) },
    engine: { slice: () => evidence },
    config: { mediaStoreDir: store },
  } as unknown as FastifyInstance;
  return { app, lines, persisted };
}

describe('transcripts.heads: normal states are silent, real failures are one line', () => {
  it('SILENT: revised items that have no sealed package in this store by design (SIMULATED, a frozen v1 demo item, a demo item the mapping reads as version 2), and a revision of an item the state does not hold', async () => {
    const evidence = [
      item(1, { integritySource: 'SIMULATED', signature: STAND_IN }),
      item(2, { integritySource: 'DEMO_PACKAGE', signature: STAND_IN }),
      item(3, { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, transcriptSha256: SHA, signature: STAND_IN }),
    ];
    const { app, lines, persisted } = rig(evidence, [...evidence.map((entry) => entry.id), 'EV-20261010-0099']);
    expect(await publishRevisionHeads(app)).toBe(0);
    expect(lines).toEqual([]);
    expect(persisted).toEqual([]);
  });

  it('ONE LINE: items that DO have a package here by their own facts (REAL, seed-sealed demo) and whose sealed document cannot be read - one log line and one persisted entry for all of them, with the true count', async () => {
    const real = Array.from({ length: HEADS_NAMED_IN_A_FAILURE + 2 }, (_, index) => item(10 + index, { integritySource: 'REAL', manifestVersion: 2, signature: SIGNED }));
    const seedSealed = item(5, { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, signature: SIGNED });
    const silent = item(1, { integritySource: 'SIMULATED', signature: STAND_IN });
    const { app, lines, persisted } = rig([silent, seedSealed, ...real], [silent.id, seedSealed.id, ...real.map((entry) => entry.id)]);
    expect(await publishRevisionHeads(app)).toBe(0);
    const failures = HEADS_NAMED_IN_A_FAILURE + 3;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'error', code: TRANSCRIPT_HEAD_NOT_PUBLISHED, items: failures });
    expect(lines[0]?.['evidenceIds']).toEqual([seedSealed.id, ...real.map((entry) => entry.id)].slice(0, HEADS_NAMED_IN_A_FAILURE));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ level: 'error', code: TRANSCRIPT_HEAD_NOT_PUBLISHED, context: { items: failures } });
  });
});
