// sessionCreateSchema (01_specs §14.5.11 step 1; 04_mobile_specs §4.4; blueprint step 33): the
// shared form and API schema accepts the canonical input, normalises it like the simulator,
// reports i18n keys, and never accepts what the simulator's createSession would refuse.
import { describe, expect, it } from 'vitest';
import {
  CASE_NUMBER_PATTERN,
  DEFAULT_SESSION_ROOM,
  SESSION_CREATE_FORM_MESSAGE_KEYS,
  SESSION_CREATE_MESSAGES,
  SESSION_INPUT_LIMITS,
  sessionCreateSchema,
  type SessionCreateRequest,
} from '../src/api';
import { en } from '../src/i18n';
import {
  DEMO_OPERATOR_PASSWORD,
  DEVICE_NAME,
  createManualClock,
  createSim,
  type SessionCreateInput,
} from '../src/sim';

const VALID = {
  caseNumber: 'LP/2026/1001-0007',
  subjectType: 'TERSANGKA',
  subjectName: 'Ahmad Fauzi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

// Compile-time proof: the schema output is exactly the simulator's createSession input.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameAsSimInput: Exact<SessionCreateRequest, SessionCreateInput> = true;
void sameAsSimInput;

function messagesFor(input: unknown): string[] {
  const result = sessionCreateSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe('sessionCreateSchema', () => {
  it('accepts the recording-scenario input unchanged', () => {
    expect(sessionCreateSchema.parse(VALID)).toEqual(VALID);
    expect(sessionCreateSchema.parse({ ...VALID, notes: 'Initial examination.' }).notes).toBe('Initial examination.');
  });

  it('normalises text like the simulator: trim, collapse inner whitespace (notes only trimmed)', () => {
    const parsed = sessionCreateSchema.parse({
      ...VALID,
      caseNumber: '  LP/2026/1001-0007 ',
      subjectName: '  Ahmad    Fauzi ',
      room: ' Interview   Room 1 ',
      notes: '  line one\n\nline two  ',
    });
    expect(parsed).toMatchObject({
      caseNumber: 'LP/2026/1001-0007',
      subjectName: 'Ahmad Fauzi',
      room: 'Interview Room 1',
      notes: 'line one\n\nline two',
    });
  });

  it('checks the case format LP/YYYY/MMDD-NNNN', () => {
    for (const good of ['LP/2026/0101-0001', 'LP/2025/1231-9999', 'LP/2026/0229-0008']) {
      expect(CASE_NUMBER_PATTERN.test(good), good).toBe(true);
      expect(messagesFor({ ...VALID, caseNumber: good })).toEqual([]);
    }
    for (const bad of ['LP/2026/1301-0001', 'LP/2026/1032-0001', 'LP/26/1001-0007', 'lp/2026/1001-0007', 'LP/2026/1001-007', 'LP/123/2025']) {
      expect(messagesFor({ ...VALID, caseNumber: bad }), bad).toEqual([SESSION_CREATE_MESSAGES.caseNumberInvalid]);
    }
    expect(messagesFor({ ...VALID, caseNumber: '   ' })).toContain(SESSION_CREATE_MESSAGES.caseNumberRequired);
    expect(messagesFor({ ...VALID, caseNumber: undefined })).toEqual([SESSION_CREATE_MESSAGES.caseNumberRequired]);
  });

  it('reports one i18n key per invalid field', () => {
    expect(messagesFor({ ...VALID, subjectType: undefined })).toEqual([SESSION_CREATE_MESSAGES.subjectTypeRequired]);
    expect(messagesFor({ ...VALID, subjectType: 'SUSPECT' })).toEqual([SESSION_CREATE_MESSAGES.subjectTypeRequired]);
    expect(messagesFor({ ...VALID, subjectName: ' ' })).toEqual([SESSION_CREATE_MESSAGES.subjectNameRequired]);
    expect(messagesFor({ ...VALID, subjectName: 'x'.repeat(SESSION_INPUT_LIMITS.subjectNameMax + 1) })).toEqual([
      SESSION_CREATE_MESSAGES.subjectNameTooLong,
    ]);
    expect(messagesFor({ ...VALID, investigatorId: 'budi.santoso' })).toEqual([SESSION_CREATE_MESSAGES.investigatorRequired]);
    expect(messagesFor({ ...VALID, investigatorId: '' })).toEqual([SESSION_CREATE_MESSAGES.investigatorRequired]);
    expect(messagesFor({ ...VALID, room: '' })).toEqual([SESSION_CREATE_MESSAGES.roomRequired]);
    expect(messagesFor({ ...VALID, room: 'r'.repeat(SESSION_INPUT_LIMITS.roomMax + 1) })).toEqual([SESSION_CREATE_MESSAGES.roomTooLong]);
    expect(messagesFor({ ...VALID, profileId: 'HD' })).toEqual([SESSION_CREATE_MESSAGES.profileRequired]);
    expect(messagesFor({ ...VALID, notes: 'n'.repeat(SESSION_INPUT_LIMITS.notesMax + 1) })).toEqual([SESSION_CREATE_MESSAGES.notesTooLong]);
    const all = messagesFor({});
    expect(all.length).toBe(6);
    expect(all.every((message) => (Object.values(SESSION_CREATE_MESSAGES) as string[]).includes(message))).toBe(true);
  });

  it('the keys the form can show exist in the shared en resources', () => {
    for (const key of SESSION_CREATE_FORM_MESSAGE_KEYS) {
      expect(typeof lookup(en, key), key).toBe('string');
    }
  });

  it('the default room is the device room', () => {
    expect(DEFAULT_SESSION_ROOM).toBe(DEVICE_NAME);
  });

  it('whatever it accepts at the limits, the simulator creates (schema-valid implies sim-valid)', async () => {
    const edge = sessionCreateSchema.parse({
      ...VALID,
      subjectName: 'S'.repeat(SESSION_INPUT_LIMITS.subjectNameMax),
      room: 'R'.repeat(SESSION_INPUT_LIMITS.roomMax),
      notes: 'N'.repeat(SESSION_INPUT_LIMITS.notesMax),
    });
    const sim = createSim({
      storage: null,
      authStorage: null,
      clock: createManualClock(Date.parse('2026-10-01T03:00:00.000Z')),
      scheduler: () => () => {},
    });
    await sim.ready;
    expect(sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const input: SessionCreateInput = edge;
    expect(sim.actions.createSession(input)).toMatchObject({ ok: true, created: true });
    sim.stop();
  });
});
