// Task 4 row 30 (WP-13a; re-owned by decision C18; C21 (6), C25; research/027 section 4): the
// Core-side statement of the pre-check on a selector with an unassigned slot, on PostgreSQL as
// `dems_app`.
//
// WHO DECIDES THE ITEM. The shared session machine (row 163: `evaluatePrecheck`), which the Core's
// engine runs. THIS unit's gate (`precheck.ts`) asks the configured sources before the hosted
// action and needs NO change: a slot without a source has no line, so the gate has no device to
// ask, raises nothing and still lets the run through - and the run then says BLOCK for the slot.
// The cases below hold both halves at a booted Core: the gate's outcome and the pre-check answer.
//
// WHAT IS REAL: the app factory and its boot in REAL_DEVELOPMENT on the GENERATED sources (the
// development test sources the fence registers: CAM-01..04 and MIC-01..04 of kind FAKE), the
// engine host with its pipeline and audit chain, this unit as the app builds it, the probe it was
// provided with at the boot. WHAT STANDS IN: the worker program and the helper program are the
// stand-ins of the real-boot fixture and are never asked to capture (no session is started).
// A stored unassigned slot is NULL written into a clone of the seed by the owner, before the boot
// (operation 78 `unassign` is row 29's subject and is held there).
import { CAPTURE_START_REQUIRED_SLOTS, CaptureStartRule, PRECHECK_ORDER, SOURCE_NOT_ASSIGNED_PRECHECK_VALUE, unassignedSlotOfPrecheckItem, type PrecheckItem } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { FIXED_NOW, engineApp } from '../../../test/support/engine';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { CaptureOperation } from '../../capture/adapters';
import { captureFenceControl } from '../../capture/fence';
import { captureNotices } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('row30');
fixture.provisionKey();
afterAll(() => fixture.remove());

// D61 (2026-11-04): the selector is EIGHT slots and the seed assigns every one of them (four
// video tracks, four numbered channels). Audit fix rows 83/90 (DF-03; D15(c), D22(5)): the
// pre-check covers all eight - `PRECHECK_ORDER` holds twelve checks, LENS_3/LENS_4 speak for
// VIDEO-03/04 and MIC_3/MIC_4 for MIC-03/04 - so EVERY slot has an item of its own, and an
// unassigned slot is a BLOCK item at the pre-check (before row 83 four of them were only refused
// at the START by `startRecordingTransition`). This unit walks all eight slots for the BLOCK item.
const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
type Slot = (typeof SLOTS)[number];
const ALL_SLOTS = [...CAPTURE_START_REQUIRED_SLOTS] as const;
/** The four slots of the first item set (row 30). */
const FIRST_FOUR_SLOTS = ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02'] as const;
/** The four slots WITHOUT an item of their own until audit fix row 83 (C25, D61); since row 83 each carries one (DF-03). */
const LATER_FOUR_SLOTS = ['VIDEO-03', 'VIDEO-04', 'MIC-03', 'MIC-04'] as const;
const COLUMNS_OF: Readonly<Record<string, readonly string[]>> = {
  'VIDEO-01': ['video_01_device_id', 'video_01_profile'],
  'VIDEO-02': ['video_02_device_id', 'video_02_profile'],
  'VIDEO-03': ['video_03_device_id', 'video_03_profile'],
  'VIDEO-04': ['video_04_device_id', 'video_04_profile'],
  'MIC-01': ['mic_01_id'], // D61: 0040 renamed the role columns to the channel columns
  'MIC-02': ['mic_02_id'], // D61
  'MIC-03': ['mic_03_id'], // D61
  'MIC-04': ['mic_04_id'], // D61
};
/** The pre-check item that speaks for a slot (the stored check IDs keep the role names), and the device the seed assigns to it. */
const ITEM_OF: Readonly<Record<Slot, PrecheckItem['id']>> = {
  'VIDEO-01': 'LENS_1',
  'VIDEO-02': 'LENS_2',
  'VIDEO-03': 'LENS_3', // audit fix rows 83/90 (DF-03)
  'VIDEO-04': 'LENS_4', // audit fix rows 83/90
  'MIC-01': 'MIC_PRIMARY',
  'MIC-02': 'MIC_STANDBY',
  'MIC-03': 'MIC_3', // audit fix rows 83/90
  'MIC-04': 'MIC_4', // audit fix rows 83/90
};
const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0030', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

const DEVELOPMENT = (slug: string) =>
  ({ captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', mediaStoreDir: fixture.mediaStoreDir, captureWorkerPath: fixture.worker(`worker-${slug}`, 'capture-worker/0.4.0') }) as const;
const SIMULATED = { demoControls: true } as const;

interface Ran {
  readonly operation: string;
  /** What the gate of this unit did before the hosted action. */
  readonly gate: { readonly asked: boolean; readonly unreachable: readonly string[]; readonly search: string };
  readonly items: readonly PrecheckItem[];
  readonly outcome: string | null;
  readonly state: string | undefined;
  /** The items that say "source not assigned", as both clients recognise them. */
  readonly unassigned: readonly PrecheckItem[];
  readonly blocked: readonly PrecheckItem[];
  rows<Row>(text: string): Promise<Row[]>;
  acknowledge(): Promise<unknown>;
  start(): Promise<unknown>;
}

/** A Core on a clone of the seed with the named slots unassigned in the stored selector, and ONE run of the pre-check as the route makes it: the gate, then the hosted action. */
async function precheckOn(slug: string, unassigned: readonly string[], mode: 'REAL_DEVELOPMENT' | 'SIMULATED' = 'REAL_DEVELOPMENT'): Promise<Ran> {
  const target = await db.another({ template: 'seed', slug });
  const owner: Pool = target.ownerPool();
  // No speech runtime on a test host: a real-capture boot resolves the stored selection first.
  await owner.query('UPDATE public.stt_config SET enabled = false');
  if (unassigned.length > 0) await owner.query(`UPDATE public.capture_config SET ${unassigned.flatMap((slot) => COLUMNS_OF[slot]).map((column) => `${column} = NULL`).join(', ')}`);
  const core = await engineApp(target, mode === 'SIMULATED' ? db.run.dataDir : fixture.dataDir, { startAt: FIXED_NOW + 60_000, logLevel: 'info', config: mode === 'SIMULATED' ? SIMULATED : DEVELOPMENT(slug) });
  await core.app.readiness.boot();
  await core.engine.idle();
  const operation = captureFenceControl(core.app).operation;
  expect(operation).toBe(mode === 'SIMULATED' ? CaptureOperation.SIMULATED : CaptureOperation.REAL_DEVELOPMENT);
  // The selector the Core holds is the stored one: the lines of the assigned slots and no other
  // (D61: of the EIGHT the seed assigns, minus the ones this case emptied).
  const held = core.engine.slice('captureConfig');
  expect([...held.cameras.map((camera) => camera.trackId as string), ...held.mics.map((mic) => mic.channel as string)].sort()).toEqual(ALL_SLOTS.filter((slot) => !unassigned.includes(slot)).sort());

  const investigator = core.principal('INVESTIGATOR');
  const created = await core.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  if (!created.value.ok) throw new Error(`the session was not created: ${created.value.reason}`);
  const sessionId = created.value.sessionId;
  // The pre-check item CORE needs the tablet link (the engine's own door, as the session tests use it).
  await core.engine.setTabletLink('CONNECTED');
  // As `modules/sessions/routes.ts` does for operation `beginPrecheck`: the gate first, then the hosted action.
  const gate = await captureNotices(core.app).beforePrecheckOf({ principal: investigator }, sessionId, 'BEGIN');
  await gate.settled;
  await core.engine.command(investigator, 'beginPrecheck');
  await core.drive(6_000);
  await captureNotices(core.app).idle();
  await core.engine.idle();
  const session = core.engine.slice('session');
  const items = session?.precheck?.items ?? [];
  return {
    operation,
    gate: { asked: gate.asked, unreachable: gate.unreachable, search: gate.search },
    items,
    outcome: session?.precheck?.outcome ?? null,
    state: session?.state,
    unassigned: items.filter((item) => unassignedSlotOfPrecheckItem(item) !== null),
    blocked: items.filter((item) => item.status === 'BLOCK'),
    async rows<Row>(text: string) {
      await core.app.pipeline.drain();
      return (await owner.query(text, [sessionId])).rows as Row[];
    },
    acknowledge: () => core.engine.command(investigator, 'acknowledgePrecheckWarnings').then((result) => result.value, (error: unknown) => error),
    start: () => core.engine.command(investigator, 'startRecording').then((result) => result.value, (error: unknown) => error),
  };
}

const slug = (slot: string): string => `r30-${slot.toLowerCase().replace('-', '')}`;
/** The audit rows this unit writes for a source that does not answer, of THIS session (the seed holds rows of earlier sessions): an unassigned slot must cause none. */
const UNREACHABLE_ROWS = "SELECT details FROM public.audit_log WHERE type = 'CAPTURE_DEVICE_UNREACHABLE' AND session_id = $1";
/** How the pre-check of THIS session ended, as the trail holds it. */
const ENDINGS = "SELECT type FROM public.audit_log WHERE type IN ('PRECHECK_PASSED', 'PRECHECK_BLOCKED') AND session_id = $1 ORDER BY seq";

describe('task 4 row 30 (C18, C25): in real capture an unassigned selector slot is ONE BLOCK item of the pre-check, decided by the shared session machine; the gate of this unit asks nothing for it', () => {
  // D61 (2026-11-04): a start needs EIGHT slots - four video tracks and four numbered microphone
  // channels - and the seed assigns all eight; the closed item list speaks for the first four.
  it('the slots a start needs are the eight of the selector, every channel included (C25, D61)', () => {
    expect([...CAPTURE_START_REQUIRED_SLOTS].sort()).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'].sort());
  });

  it.each(SLOTS)('REAL_DEVELOPMENT on generated sources, %s unassigned: the answer holds ONE BLOCK item, for that slot, worded "source not assigned"; the pre-check does not end passed and cannot be acknowledged into a start', async (slot) => {
    const ran = await precheckOn(slug(slot), [slot]);
    // ONE item says it, it is the item of that slot, and it is a BLOCK - never the WARN an operator may acknowledge.
    expect(ran.unassigned.map((item) => [item.id, item.status, item.value, item.reason, item.reasonCode, item.params])).toEqual([
      [ITEM_OF[slot], 'BLOCK', SOURCE_NOT_ASSIGNED_PRECHECK_VALUE, `${slot}: source not assigned`, null, { rule: CaptureStartRule.SOURCE_NOT_ASSIGNED, slot }],
    ]);
    expect(unassignedSlotOfPrecheckItem(ran.unassigned[0] as PrecheckItem)).toBe(slot);
    // No device stands in for the slot: the item names none.
    expect(Object.keys(ran.unassigned[0]?.params ?? {}).sort()).toEqual(['rule', 'slot']);
    // Nothing else blocks on generated sources: the one BLOCK item of the answer is this one.
    expect(ran.blocked.map((item) => item.id)).toEqual([ITEM_OF[slot]]);
    // The items of the seven assigned slots are decided as before (audit fix row 90: all eight slots carry an item).
    for (const other of SLOTS.filter((candidate) => candidate !== slot)) expect(ran.items.find((item) => item.id === ITEM_OF[other])?.value, other).not.toBe(SOURCE_NOT_ASSIGNED_PRECHECK_VALUE);
    // DOES NOT END PASSED: the outcome is BLOCK, the session stays in PRECHECK, one PRECHECK_BLOCKED row and no PRECHECK_PASSED row.
    expect([ran.outcome, ran.state]).toEqual(['BLOCK', 'PRECHECK']);
    const trail = await ran.rows<{ type: string }>(ENDINGS);
    expect(trail.map((row) => row.type)).toEqual(['PRECHECK_BLOCKED']);
    // An operator cannot acknowledge it away, and cannot start.
    expect(await ran.acknowledge()).toBeInstanceOf(Error);
    expect(await ran.start()).toBeInstanceOf(Error);
    // THE GATE (`precheck.ts`, unchanged): it ran, it asked the sources that ARE configured, and for the empty slot it
    // found nothing unreachable, started no search and wrote no "device unreachable" row.
    expect(ran.gate).toEqual({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    expect(await ran.rows(UNREACHABLE_ROWS)).toEqual([]);
  });

  it('the first four unassigned: FOUR BLOCK items, one per slot, in the order of the checks; the gate has no source to ask and still does not let the run pass', async () => {
    const ran = await precheckOn('r30-all-four', FIRST_FOUR_SLOTS);
    expect(ran.unassigned.map((item) => [item.id, item.status, item.params?.['slot']])).toEqual(FIRST_FOUR_SLOTS.map((slot) => [ITEM_OF[slot], 'BLOCK', slot]));
    expect(ran.blocked.map((item) => item.id)).toEqual(FIRST_FOUR_SLOTS.map((slot) => ITEM_OF[slot]));
    expect([ran.outcome, ran.state]).toEqual(['BLOCK', 'PRECHECK']);
    expect(ran.gate).toEqual({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    expect(await ran.rows(UNREACHABLE_ROWS)).toEqual([]);
    expect(await ran.start()).toBeInstanceOf(Error);
  });

  // Audit fix rows 83/90 (DF-03; D15(c)): until row 83 the four slots VIDEO-03 .. MIC-04 had no
  // item of their own - emptying them showed nothing at the pre-check and only the start rule
  // (`CAPTURE_SOURCE_NOT_ASSIGNED`, `startRecordingTransition`, row 163) refused. Now LENS_3, LENS_4,
  // MIC_3 and MIC_4 speak for them: the pre-check itself ends BLOCK, before any start is asked.
  it('the four LATER slots unassigned (VIDEO-03 .. MIC-04): FOUR BLOCK items LENS_3, LENS_4, MIC_3, MIC_4 in the order of the checks; the pre-check ends BLOCK and no start passes (DF-03, C25)', async () => {
    const ran = await precheckOn('r30-later-four', [...LATER_FOUR_SLOTS]);
    expect(ran.unassigned.map((item) => [item.id, item.status, item.value, item.reason, item.params])).toEqual(
      LATER_FOUR_SLOTS.map((slot) => [ITEM_OF[slot], 'BLOCK', SOURCE_NOT_ASSIGNED_PRECHECK_VALUE, `${slot}: source not assigned`, { rule: CaptureStartRule.SOURCE_NOT_ASSIGNED, slot }]),
    );
    expect(ran.unassigned.map((item) => unassignedSlotOfPrecheckItem(item))).toEqual([...LATER_FOUR_SLOTS]);
    expect(ran.blocked.map((item) => item.id)).toEqual(['LENS_3', 'LENS_4', 'MIC_3', 'MIC_4']);
    // The items of the four first slots stay as before: none says "source not assigned".
    for (const other of FIRST_FOUR_SLOTS) expect(ran.items.find((item) => item.id === ITEM_OF[other])?.value, other).not.toBe(SOURCE_NOT_ASSIGNED_PRECHECK_VALUE);
    expect([ran.outcome, ran.state]).toEqual(['BLOCK', 'PRECHECK']);
    expect((await ran.rows<{ type: string }>(ENDINGS)).map((row) => row.type)).toEqual(['PRECHECK_BLOCKED']);
    expect(ran.gate).toEqual({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    expect(await ran.rows(UNREACHABLE_ROWS)).toEqual([]);
    expect(await ran.acknowledge()).toBeInstanceOf(Error);
    expect(await ran.start()).toBeInstanceOf(Error);
  });

  it('CONTROL - the assigned selector of the seed: 0 such items, 0 BLOCK items, and the pre-check ends passed', async () => {
    const ran = await precheckOn('r30-assigned', []);
    // Audit fix rows 83/90 (DF-03): the answer holds the TWELVE checks, in their order (four lenses, four channels).
    expect(ran.items.map((item) => item.id)).toEqual([...PRECHECK_ORDER]);
    expect(ran.items).toHaveLength(12);
    expect(ran.unassigned).toEqual([]);
    expect(ran.items.filter((item) => item.value === SOURCE_NOT_ASSIGNED_PRECHECK_VALUE)).toEqual([]);
    expect(ran.blocked).toEqual([]);
    expect(ran.gate).toEqual({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    expect(['PASS', 'WARN']).toContain(ran.outcome);
    if (ran.outcome === 'WARN') expect(await ran.acknowledge()).not.toBeInstanceOf(Error);
    const trail = await ran.rows<{ type: string }>(ENDINGS);
    expect(trail.map((row) => row.type)).toEqual(['PRECHECK_PASSED']);
  });

  it('Simulated mode is unchanged (C21 (6)): with all four slots unassigned the gate asks nothing at all and no item says "source not assigned"', async () => {
    const ran = await precheckOn('r30-simulated', FIRST_FOUR_SLOTS, 'SIMULATED');
    expect(ran.gate).toEqual({ asked: false, unreachable: [], search: 'NOT_NEEDED' });
    expect(ran.unassigned).toEqual([]);
    expect(ran.items.filter((item) => item.value === SOURCE_NOT_ASSIGNED_PRECHECK_VALUE || item.params?.['rule'] === CaptureStartRule.SOURCE_NOT_ASSIGNED)).toEqual([]);
    // What it said before WP-13a (research/027 section 4): two lens items PASS, two microphone items WARN.
    expect(FIRST_FOUR_SLOTS.map((slot) => ran.items.find((item) => item.id === ITEM_OF[slot])?.status)).toEqual(['PASS', 'PASS', 'WARN', 'WARN']);
    // Audit fix rows 83/90 (DF-03): Simulated mode answers the twelve checks too, none of them "source not assigned".
    expect(ran.items.map((item) => item.id)).toEqual([...PRECHECK_ORDER]);
    expect(ran.blocked).toEqual([]);
    expect(await ran.rows(UNREACHABLE_ROWS)).toEqual([]);
  });
});
