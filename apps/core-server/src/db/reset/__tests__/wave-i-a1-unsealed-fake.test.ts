// Fix wave I, driver A1 - re-gate 75 finding G75b-01 (ruling D216), the reset side: after one failed
// seal `lane.sh reset 2` answered RESET_BLOCKED_REAL_EVIDENCE for ever ("1 unreadable package
// directory [SESSION-SES-20261010-0025]"): the lane could not be restored with the project's tools.
//
// Rules (12) to (15) of the guard: an UNSEALED recording folder of a session that recorded from
// four generated (FAKE) sources is cleared - on the caller's explicit word only, never for a
// recording of this computer's devices or of a production device, never for a folder that holds a
// manifest. Evidence integrity: every clearing has its negative control.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readEvidenceStore, type EvidenceStoreScan } from '../../commands/evidence-store';
import { ResetUsageError, parseResetArguments } from '../cli';
import { removeQuarantineFolder } from '../package-removal';
import {
  DISCARD_UNSEALED_FAKE_OPTION,
  REAL_SEALED_EVIDENCE_STATEMENT,
  UNSEALED_FAKE_SOURCE,
  assertNoRealSealedEvidence,
  classifyRealSealedRows,
  evaluateRealEvidence,
  findRealSealedEvidence,
  realEvidenceDetails,
  realEvidenceMessage,
  removeUnsealedFakeRecordings,
  unsealedFakeMessage,
  type RealSealedEvidenceRow,
} from '../real-evidence';

const REPOSITORY = join(import.meta.dirname, '../../../../../..');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const S = 'SES-20261010-0025';
const fakeRow = (sessionId: string, sourceRows = 4, fakeRows = 4): RealSealedEvidenceRow => ({ session_id: sessionId, evidence_id: null, manifest_hash: null, integrity_source: UNSEALED_FAKE_SOURCE, development_flag: false, source_rows: sourceRows, development_rows: fakeRows });
const clientOf = (rows: readonly RealSealedEvidenceRow[]) => ({ query: async () => ({ rows: [...rows] }) }) as never;

/** A store on disk as lane 2 was left: the recording folder of the session whose seal failed, no manifest in it. */
function storeOf(): string {
  const root = mkdtempSync(join(tmpdir(), 'dems-wia1-store-'));
  roots.push(root);
  mkdirSync(join(root, `SESSION-${S}`, 'fragments'), { recursive: true });
  writeFileSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'), 'generated test picture');
  writeFileSync(join(root, `SESSION-${S}`, 'fragments', 'VIDEO-01.mp4.seal.part'), 'part');
  return root;
}

describe('rules (12) + (13): the database side', () => {
  it('the statement asks for sessions of exactly four source rows, all FAKE, without a sealed item - on the snapshot of the other rules; it stays one SELECT', () => {
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain(`'${UNSEALED_FAKE_SOURCE}'`);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("HAVING count(*) = 4 AND count(*) FILTER (WHERE f.adapter_kind = 'FAKE') = 4");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('NOT EXISTS (SELECT 1 FROM public.evidence_items AS j WHERE j.session_id = f.session_id AND j.sealed_at IS NOT NULL)');
    expect(REAL_SEALED_EVIDENCE_STATEMENT.match(/UNION ALL/g)).toHaveLength(2);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toMatch(/^SELECT\b/);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/);
    // The generated kind only: this computer's camera and microphone are never part of rule (12).
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toContain("f.adapter_kind IN ('FAKE', 'LOCAL_DEVICE')");
  });

  it('such a row never blocks and is proven AGAIN on its counts: three rows, or one row of another kind, is no proof (negative controls)', () => {
    expect(classifyRealSealedRows([fakeRow(S)])).toMatchObject({ blocking: [], unsealedFake: [S] });
    expect(classifyRealSealedRows([fakeRow(S, 3, 3)])).toMatchObject({ blocking: [], unsealedFake: [] });
    expect(classifyRealSealedRows([fakeRow(S, 4, 3)])).toMatchObject({ blocking: [], unsealedFake: [] });
    expect(classifyRealSealedRows([fakeRow(S, 5, 5)])).toMatchObject({ blocking: [], unsealedFake: [] });
  });
});

describe('rules (14) + (15): the disk side, on the store as lane 2 was left', () => {
  it('REPRODUCTION (and the default for ever): without the explicit word the folder BLOCKS - and the refusal now names the way out', async () => {
    const root = storeOf();
    const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root });
    expect(facts.blocked).toBe(true);
    expect(facts.unprovablePackages).toEqual([`SESSION-${S}`]);
    expect(facts.unsealedFakeOffered).toBe(1);
    const message = realEvidenceMessage(facts);
    expect(message).toContain(`1 unreadable package director(y/ies) [SESSION-${S}]`);
    expect(message).toContain(`1 of the folders named above are unsealed recordings of generated (FAKE) sources only`);
    expect(message).toContain(DISCARD_UNSEALED_FAKE_OPTION);
    expect(message).toMatch(/Nothing was changed\.$/);
    expect(realEvidenceDetails(facts)).toMatchObject({ unreadablePackages: 1, unsealedFakeOffered: 1 });
    await expect(assertNoRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root })).rejects.toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect(existsSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'))).toBe(true);
  });

  it('THE FIX: with the explicit word the folder is cleared, stated by count and name, and removed after the swap - fragments and part files with it', async () => {
    const root = storeOf();
    const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
    expect(facts).toMatchObject({ blocked: false, unprovablePackages: [], unsealedFakeFolders: [`SESSION-${S}`], unsealedFakeQuarantined: [], unsealedFakeOffered: 0 });
    expect(unsealedFakeMessage(facts)).toBe(
      `this reset erases 1 unsealed recording folder(s) of dems_lane_2 that were recorded from generated (FAKE) sources only and were never sealed [SESSION-${S}]: asked for by name (${DISCARD_UNSEALED_FAKE_OPTION}); the folders are removed once the database has been replaced.`,
    );
    expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [`SESSION-${S}`], kept: [] });
    expect(existsSync(join(root, `SESSION-${S}`))).toBe(false);
  });

  it('NEVER, even with the word (negative controls): a session the database does not prove; a folder that holds a manifest; a session a blocking row names; a folder of another name', async () => {
    const withWord = async (rows: readonly RealSealedEvidenceRow[], root: string) => findRealSealedEvidence(clientOf(rows), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
    // No row at all (a production recording that never reached the database, a folder of another database).
    expect(await withWord([], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
    // One of the four sources is this computer's camera: LOCAL_DEVICE is a recording of a person.
    expect(await withWord([fakeRow(S, 4, 3)], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
    // A v2 manifest in the folder: it is a package, judged by its SIGNED manifest (rule (5)), never by this rule.
    const v2 = storeOf();
    writeFileSync(join(v2, `SESSION-${S}`, 'session-manifest.json'), '{}');
    expect(await withWord([fakeRow(S)], v2)).toMatchObject({ blocked: true, unsealedFakeFolders: [], unprovablePackages: [`SESSION-${S}`] });
    // A v1 manifest that says REAL.
    const v1 = storeOf();
    writeFileSync(join(v1, `SESSION-${S}`, 'manifest.json'), JSON.stringify({ integrity: 'REAL' }));
    expect(await withWord([fakeRow(S)], v1)).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
    // The same session is ALSO named by a blocking row (a REAL sealed item without the development proof).
    const real: RealSealedEvidenceRow = { session_id: S, evidence_id: 'EV-20261010-0014', manifest_hash: 'a'.repeat(64), integrity_source: 'REAL', development_flag: false, source_rows: 4, development_rows: 4 };
    expect(await withWord([real, fakeRow(S)], storeOf())).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
    // A folder whose name is not exactly SESSION-<that session>.
    const other = storeOf();
    mkdirSync(join(other, 'SESSION-SES-20261010-0099'));
    expect(await withWord([fakeRow(S)], other)).toMatchObject({ blocked: true, unsealedFakeFolders: [`SESSION-${S}`], unprovablePackages: ['SESSION-SES-20261010-0099'] });
  });

  it('the terminal UNSEALABLE path leaves `.quarantine/<id>`: the same rule - it blocks without the word, is cleared and removed with it; the quarantine of another session stays and blocks', async () => {
    const root = storeOf();
    rmSync(join(root, `SESSION-${S}`), { recursive: true });
    mkdirSync(join(root, '.quarantine', S, 'sealing'), { recursive: true });
    writeFileSync(join(root, '.quarantine', S, 'VIDEO-01.mp4'), 'generated test picture');
    mkdirSync(join(root, '.quarantine', 'SES-20261010-0007'), { recursive: true });
    const without = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root });
    expect(without).toMatchObject({ blocked: true, quarantinedSessions: ['SES-20261010-0007', S], unsealedFakeOffered: 1 });
    const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
    // Still blocked: the quarantine of the session the database does not prove.
    expect(facts).toMatchObject({ blocked: true, quarantinedSessions: ['SES-20261010-0007'], unsealedFakeQuarantined: [S] });
    // A blocked run removes nothing.
    expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [], kept: [] });
    rmSync(join(root, '.quarantine', 'SES-20261010-0007'), { recursive: true });
    const clear = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
    expect(clear.blocked).toBe(false);
    expect(removeUnsealedFakeRecordings(clear)).toEqual({ removed: [`.quarantine/${S}`], kept: [] });
    expect(existsSync(join(root, '.quarantine', S))).toBe(false);
    expect(existsSync(join(root, '.quarantine'))).toBe(true);
  });

  it('judged AGAIN at the removal: a folder that got a manifest in between is left and said; the containment rule refuses a link and a name that is no session', async () => {
    const root = storeOf();
    const facts = await findRealSealedEvidence(clientOf([fakeRow(S)]), { database: 'dems_lane_2', storeRoot: root, discardUnsealedFake: true });
    writeFileSync(join(root, `SESSION-${S}`, 'session-manifest.json'), '{}');
    expect(removeUnsealedFakeRecordings(facts)).toEqual({ removed: [], kept: [{ directory: `SESSION-${S}`, reason: 'NOT_CLEARED_AT_REMOVAL' }] });
    expect(existsSync(join(root, `SESSION-${S}`, 'VIDEO-01.mp4'))).toBe(true);

    const outside = mkdtempSync(join(tmpdir(), 'dems-wia1-outside-'));
    roots.push(outside);
    writeFileSync(join(outside, 'keep.txt'), 'x');
    mkdirSync(join(root, '.quarantine'));
    symlinkSync(outside, join(root, '.quarantine', 'SES-20261010-0031'));
    expect(removeQuarantineFolder(root, '.quarantine', 'SES-20261010-0031')).toEqual({ removed: false, refusal: 'NOT_A_DIRECTORY' });
    expect(removeQuarantineFolder(root, '.quarantine', '../x')).toEqual({ removed: false, refusal: 'NAME_NOT_A_PACKAGE' });
    expect(removeQuarantineFolder(root, '.quarantine', 'SES-20261010-0032')).toEqual({ removed: false, refusal: 'ENTRY_UNRESOLVED' });
    expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
  });

  it('the scan says which manifest file a folder holds, by name only', () => {
    const root = storeOf();
    expect(readEvidenceStore(root).packages).toEqual([{ sessionId: S, directory: `SESSION-${S}`, integrity: 'UNKNOWN', manifest: 'NONE' }]);
    // A scan a test built by hand (no `manifest` member) clears nothing: absent is not NONE.
    const scan: EvidenceStoreScan = { root, present: true, packages: [{ sessionId: S, directory: `SESSION-${S}`, integrity: 'UNKNOWN' }], unreadable: null, quarantined: [] };
    expect(evaluateRealEvidence('dems_lane_2', root, [], scan, { unsealedFake: [S], discardUnsealedFake: true })).toMatchObject({ blocked: true, unsealedFakeFolders: [] });
  });
});

describe('the word itself: the command line and the lane tool', () => {
  it('db:reset takes the option once, without a value; without it the option is absent (the default: such a folder blocks)', () => {
    expect(parseResetArguments(['--database', 'dems_lane_2'])).toEqual({ database: 'dems_lane_2', scenario: undefined });
    expect(parseResetArguments(['--database', 'dems_lane_2', DISCARD_UNSEALED_FAKE_OPTION])).toEqual({ database: 'dems_lane_2', scenario: undefined, discardUnsealedFakeRecordings: true });
    expect(parseResetArguments([DISCARD_UNSEALED_FAKE_OPTION, '--database=dems_lane_2'])).toMatchObject({ discardUnsealedFakeRecordings: true });
    expect(() => parseResetArguments(['--database', 'dems_lane_2', DISCARD_UNSEALED_FAKE_OPTION, DISCARD_UNSEALED_FAKE_OPTION])).toThrow(ResetUsageError);
    expect(() => parseResetArguments(['--database', 'dems_lane_2', '--discard-everything'])).toThrow(ResetUsageError);
    expect(DISCARD_UNSEALED_FAKE_OPTION).toBe('--discard-unsealed-fake-recordings');
  });

  it('lane.sh: the option is passed to db:reset for the development capture lane only; a SIMULATED lane is refused (exit 64) before anything is opened; any other third word is a usage error', () => {
    const script = join(REPOSITORY, 'scripts/lane/lane.sh');
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('npm run -s db:reset -w @dems/core-server -- --database "$DATABASE" $DISCARD )');
    expect(text).toContain('[ "$3" = "--discard-unsealed-fake-recordings" ]');
    expect(text).toContain('if [ -n "$DISCARD" ] && [ "$MODE" != "REAL_DEVELOPMENT" ]; then');
    const simulated = spawnSync('/bin/sh', [script, 'reset', '1', DISCARD_UNSEALED_FAKE_OPTION], { encoding: 'utf8' });
    expect(simulated.status).toBe(64);
    expect(simulated.stderr).toContain('is for the development capture lane only; lane 1 runs SIMULATED. Nothing was reset.');
    const wrong = spawnSync('/bin/sh', [script, 'reset', '2', '--discard-everything'], { encoding: 'utf8' });
    expect(wrong.status).toBe(64);
    expect(wrong.stderr).toMatch(/^usage: /);
  });
});
