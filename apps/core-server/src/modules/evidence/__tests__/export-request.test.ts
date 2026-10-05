// The body of `exportEvidence` (plan row W35; spec §7.3 lines 8 and 10, §7.9 operation 42;
// decisions D50, D64). Pure: no app, no database. The shared simulator is called directly here,
// as a function, only to show what the hosted action does with what the module hands it.
import { EvidenceExportRequestSchema, EXPORT_DESTINATION_MAX_LENGTH, EXPORT_REASON_MAX_LENGTH } from '@dems/shared/api';
import {
  AuthStatus,
  DEFAULT_EXPORT_DESTINATION,
  EXPORT_REASON_MIN_LENGTH,
  EvidenceStatus,
  OPERATOR_IDS,
  createIdleState,
  exportEvidenceTransition,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { NO_REASON, readExportBody } from '../export-request';

const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
const FACE = '\u{1F600}';

/** The idle dataset with the SUPERVISOR as the actor of one action: what the engine host sets for a command. */
function stateAs(operatorId: string): SimState {
  return createIdleState({
    now: NOW,
    seed: 20_261_001,
    auth: { status: AuthStatus.SIGNED_IN, operatorId, method: null, issuedAt: NOW, lastActivityAt: NOW },
  });
}

const sealedIn = (state: SimState): string => state.evidence.find((item) => item.status === EvidenceStatus.SEALED)?.id ?? '';
const recordedIn = (state: SimState): string => state.evidence.find((item) => item.status === EvidenceStatus.RECORDED)?.id ?? '';

describe('a body the contract accepts', () => {
  it('is VALID: the reason trimmed by the schema, the destination as sent, an absent destination as the empty text', () => {
    expect(readExportBody({ reason: '  Prosecutor request  ', destination: ' Case file ' })).toEqual({
      kind: 'VALID',
      request: { reason: 'Prosecutor request', destination: ' Case file ' },
    });
    expect(readExportBody({ reason: 'Court order 17' })).toEqual({ kind: 'VALID', request: { reason: 'Court order 17', destination: '' } });
    // API-4: an unknown key is dropped, not refused.
    expect(readExportBody({ reason: 'Court order 17', operatorId: 'OPR-002', at: 1 })).toEqual({ kind: 'VALID', request: { reason: 'Court order 17', destination: '' } });
  });

  it('the bounds themselves pass: 5 and 500 for the reason, 120 for the destination, in UTF-16 code units', () => {
    expect(EXPORT_REASON_MIN_LENGTH).toBe(5);
    expect(EXPORT_REASON_MAX_LENGTH).toBe(500);
    expect(EXPORT_DESTINATION_MAX_LENGTH).toBe(120);
    expect(readExportBody({ reason: 'abcde' }).kind).toBe('VALID');
    expect(readExportBody({ reason: 'r'.repeat(500), destination: 'd'.repeat(120) })).toEqual({
      kind: 'VALID',
      request: { reason: 'r'.repeat(500), destination: 'd'.repeat(120) },
    });
    // 120 code units that end in a two-unit character, and white space around 120.
    expect(readExportBody({ reason: 'abcde', destination: `${'d'.repeat(118)}${FACE}` }).kind).toBe('VALID');
    expect(readExportBody({ reason: 'abcde', destination: `  ${'d'.repeat(120)}  ` }).kind).toBe('VALID');
  });

  it('what the hosted action is handed is what the contract accepted: the same reason and destination reach the audit row', () => {
    const state = stateAs(OPERATOR_IDS.ANDI);
    const body = readExportBody({ reason: '  Prosecutor request  ', destination: `  ${'d'.repeat(120)}  ` });
    if (body.kind !== 'VALID') throw new Error('the body is valid');
    const outcome = exportEvidenceTransition(state, NOW, sealedIn(state), body.request);
    expect(outcome.result).toMatchObject({ ok: true, status: 202 });
    // The action cut nothing: the destination is the trimmed text, all 120 units of it.
    expect(outcome.state.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', details: { reason: 'Prosecutor request', destination: 'd'.repeat(120) } });

    const defaulted = readExportBody({ reason: 'Prosecutor request' });
    if (defaulted.kind !== 'VALID') throw new Error('the body is valid');
    const named = exportEvidenceTransition(state, NOW, sealedIn(state), defaulted.request);
    expect(named.state.audit.rows.at(-1)).toMatchObject({ details: { destination: DEFAULT_EXPORT_DESTINATION } });
  });
});

describe('a reason that is missing or too short: line 10 of the precedence table, decided by the hosted action', () => {
  const tooShort: ReadonlyArray<readonly [label: string, body: unknown]> = [
    ['no body members at all', {}],
    ['only a destination', { destination: 'Case file' }],
    ['an empty reason', { reason: '' }],
    ['a blank reason', { reason: '      ' }],
    ['four characters', { reason: 'abcd' }],
    ['four characters and white space around them', { reason: '   abcd   ' }],
    ['three two-unit characters: 6 code units, 3 characters', { reason: FACE.repeat(3) }],
    ['four characters and an unknown key', { reason: 'abcd', other: true }],
    ['an explicit undefined', { reason: undefined }],
  ];

  it.each(tooShort)('%s is REASON_MISSING', (_label, body) => {
    expect(EvidenceExportRequestSchema.safeParse(body).success).toBe(false);
    expect(readExportBody(body)).toEqual({ kind: 'REASON_MISSING' });
  });

  it('the action is handed NO_REASON, never the text: it answers 404, then 409, then 422 INVALID_REASON, and changes nothing', () => {
    expect(NO_REASON).toEqual({ reason: '', destination: '' });
    expect(Object.isFrozen(NO_REASON)).toBe(true);
    const state = stateAs(OPERATOR_IDS.ANDI);

    const unknown = exportEvidenceTransition(state, NOW, 'EV-20261001-9999', NO_REASON);
    expect(unknown.result).toEqual({ ok: false, status: 404, reason: 'NOT_FOUND' });
    const unsealed = exportEvidenceTransition(state, NOW, recordedIn(state), NO_REASON);
    expect(unsealed.result).toEqual({ ok: false, status: 409, reason: 'NOT_SEALED' });
    const faulted: SimState = { ...state, security: { ...state.security, state: 'FAULT' } };
    expect(exportEvidenceTransition(faulted, NOW, sealedIn(state), NO_REASON).result).toEqual({ ok: false, status: 409, reason: 'SECURITY_FAULT' });
    const refused = exportEvidenceTransition(state, NOW, sealedIn(state), NO_REASON);
    expect(refused.result).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' });
    // ENG-7: a refusal changes nothing. The state is the very object that went in.
    for (const outcome of [unknown, unsealed, refused]) expect(outcome.state).toBe(state);
  });

  it('why the text itself is not handed on: the simulator counts code units and would ACCEPT what the contract refuses', () => {
    const state = stateAs(OPERATOR_IDS.ANDI);
    const threeFaces = FACE.repeat(3);
    expect(threeFaces).toHaveLength(6);
    expect(EvidenceExportRequestSchema.safeParse({ reason: threeFaces }).success).toBe(false);
    // The action, given that text, exports. With NO_REASON it cannot.
    expect(exportEvidenceTransition(state, NOW, sealedIn(state), { reason: threeFaces, destination: '' }).result).toMatchObject({ ok: true });
    expect(exportEvidenceTransition(state, NOW, sealedIn(state), NO_REASON).result).toMatchObject({ ok: false, reason: 'INVALID_REASON' });
  });
});

describe('any other body that does not match its schema: line 8, 422 INVALID_INPUT before the engine', () => {
  const invalid: ReadonlyArray<readonly [label: string, body: unknown]> = [
    ['a reason that is a number', { reason: 12_345 }],
    ['a reason that is null', { reason: null }],
    ['a reason that is a list', { reason: ['abcde'] }],
    ['a reason that is an object', { reason: { text: 'abcde' } }],
    ['a reason that is true', { reason: true }],
    ['a reason of 501 code units', { reason: 'r'.repeat(501) }],
    ['a reason of 251 two-unit characters: 251 characters, 502 code units', { reason: FACE.repeat(251) }],
    ['a reason that holds U+0000', { reason: 'abc\u0000def' }],
    ['a reason that holds an unpaired surrogate', { reason: 'abcde\ud83d' }],
    ['a short reason that holds U+0000', { reason: 'a\u0000' }],
    ['a destination that is a number', { reason: 'abcde', destination: 7 }],
    ['a destination that is null', { reason: 'abcde', destination: null }],
    ['a destination of 121 code units', { reason: 'abcde', destination: 'd'.repeat(121) }],
    ['a destination of 119 units and a two-unit character', { reason: 'abcde', destination: `${'d'.repeat(119)}${FACE}` }],
    ['a destination that holds U+0000', { reason: 'abcde', destination: 'USB\u0000' }],
    ['a short reason AND a destination that is too long', { reason: 'ab', destination: 'd'.repeat(121) }],
    ['a missing reason AND a destination that is not text', { destination: 7 }],
    ['not an object: a list', ['abcde']],
    ['not an object: text', 'abcde'],
    ['not an object: null', null],
    ['not an object: undefined', undefined],
  ];

  it.each(invalid)('%s is INVALID', (_label, body) => {
    expect(readExportBody(body)).toEqual({ kind: 'INVALID' });
  });

  it('nothing of a body comes back in the outcome of a refused one', () => {
    for (const body of [{ reason: `MARK-reason-9f2${'r'.repeat(500)}` }, { reason: 'ab', destination: 'MARK-destination-77c' }, { reason: 12, note: 'MARK-note-11a' }]) {
      const outcome = readExportBody(body);
      expect(outcome.kind).not.toBe('VALID');
      expect(JSON.stringify(outcome)).not.toContain('MARK-');
    }
  });
});
