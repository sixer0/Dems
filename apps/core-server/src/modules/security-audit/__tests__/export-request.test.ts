// The body of `exportAudit` and `exportLogs` (plan row W39; spec §7.3 lines 8 and 10, §7.13
// operations 61 and 62; decisions D50, D64, D92 DN-2). Pure: no app, no database. The shared
// simulator is called directly here, as a function, only to show what the hosted action does
// with what the module hands it.
import { AUDIT_EXPORT_LIMITS, AuditExportRequestSchema } from '@dems/shared/api';
import { AuthStatus, DEFAULT_AUDIT_EXPORT_DESTINATION, OPERATOR_IDS, createIdleState, exportAuditTransition, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { NO_REASON, readAuditExportBody } from '../export-request';

const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
const FACE = '\u{1F600}';

/** The idle dataset with one operator as the actor of one action: what the engine host sets for a command. */
function stateAs(operatorId: string): SimState {
  return createIdleState({
    now: NOW,
    seed: 20_261_001,
    auth: { status: AuthStatus.SIGNED_IN, operatorId, method: null, issuedAt: NOW, lastActivityAt: NOW },
  });
}

describe('a body the contract accepts', () => {
  it('is VALID: reason and destination trimmed by the schema, an absent destination as the empty text', () => {
    expect(readAuditExportBody({ reason: '  Quarterly audit review  ', destination: ' Audit vault ' })).toEqual({
      kind: 'VALID',
      request: { reason: 'Quarterly audit review', destination: 'Audit vault' },
    });
    expect(readAuditExportBody({ reason: 'Court order 17' })).toEqual({ kind: 'VALID', request: { reason: 'Court order 17', destination: '' } });
    expect(readAuditExportBody({ reason: 'Court order 17', destination: '   ' })).toEqual({ kind: 'VALID', request: { reason: 'Court order 17', destination: '' } });
    // API-4: an unknown key is dropped, not refused, and never handed on.
    expect(readAuditExportBody({ reason: 'Court order 17', operatorId: 'OPR-002', at: 1, scope: 'LOGS' })).toEqual({
      kind: 'VALID',
      request: { reason: 'Court order 17', destination: '' },
    });
  });

  it('the bounds themselves pass: 5 and 500 for the reason, 120 for the destination, in UTF-16 code units', () => {
    expect(AUDIT_EXPORT_LIMITS).toEqual({ reasonMin: 5, reasonMax: 500, destinationMax: 120 });
    expect(readAuditExportBody({ reason: 'abcde' }).kind).toBe('VALID');
    expect(readAuditExportBody({ reason: 'r'.repeat(500), destination: 'd'.repeat(120) })).toEqual({
      kind: 'VALID',
      request: { reason: 'r'.repeat(500), destination: 'd'.repeat(120) },
    });
    expect(readAuditExportBody({ reason: 'abcde', destination: `${'d'.repeat(118)}${FACE}` }).kind).toBe('VALID');
    expect(readAuditExportBody({ reason: 'abcde', destination: `  ${'d'.repeat(120)}  ` }).kind).toBe('VALID');
  });

  it('what the hosted action is handed is what the contract accepted: the same reason and destination reach the audit row, for both scopes', () => {
    const body = readAuditExportBody({ reason: '  Quarterly audit review  ', destination: `  ${'d'.repeat(120)}  ` });
    if (body.kind !== 'VALID') throw new Error('expected a valid body');
    for (const scope of ['AUDIT', 'LOGS'] as const) {
      const state = stateAs(OPERATOR_IDS.ANDI);
      const { result, state: next } = exportAuditTransition(state, NOW, body.request, scope);
      expect(result).toMatchObject({ ok: true, status: 202 });
      const row = next.audit.rows.at(-1);
      expect(row?.type).toBe('AUDIT_EXPORTED');
      expect(row?.details).toMatchObject({ reason: 'Quarterly audit review', destination: 'd'.repeat(120) });
      expect(row?.details['scope']).toBe(scope === 'LOGS' ? 'LOGS' : undefined);
    }
  });

  it('an absent destination becomes the action\'s default, never an empty text in the record', () => {
    const body = readAuditExportBody({ reason: 'Court order 17' });
    if (body.kind !== 'VALID') throw new Error('expected a valid body');
    const { state: next } = exportAuditTransition(stateAs(OPERATOR_IDS.ANDI), NOW, body.request);
    expect(next.audit.rows.at(-1)?.details['destination']).toBe(DEFAULT_AUDIT_EXPORT_DESTINATION);
  });
});

describe('a missing or too-short reason and nothing else wrong: line 10, the hosted action refuses it', () => {
  const missing: ReadonlyArray<readonly [label: string, body: unknown]> = [
    ['no reason', {}],
    ['a destination and no reason', { destination: 'Audit vault' }],
    ['an empty reason', { reason: '' }],
    ['a blank reason', { reason: '      ' }],
    ['four characters', { reason: 'abcd' }],
    ['four characters between white space', { reason: '   abcd   ' }],
    ['three two-unit characters: six code units, three characters', { reason: FACE.repeat(3) }],
    ['an unknown key and no reason', { purpose: 'Quarterly audit review' }],
  ];

  it.each(missing)('%s is REASON_MISSING', (_label, body) => {
    expect(readAuditExportBody(body)).toEqual({ kind: 'REASON_MISSING' });
  });

  it('what the action gets instead is NO_REASON, which it refuses with INVALID_REASON and no row, for both scopes', () => {
    expect(NO_REASON).toEqual({ reason: '', destination: '' });
    expect(Object.isFrozen(NO_REASON)).toBe(true);
    for (const scope of ['AUDIT', 'LOGS'] as const) {
      const state = stateAs(OPERATOR_IDS.ANDI);
      const { result, state: next } = exportAuditTransition(state, NOW, NO_REASON, scope);
      expect(result).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' });
      expect(next).toBe(state);
    }
  });

  it('WHY the refused text is never handed on: the simulator counts code units and would ACCEPT three two-unit characters', () => {
    const state = stateAs(OPERATOR_IDS.ANDI);
    expect(AuditExportRequestSchema.safeParse({ reason: FACE.repeat(3) }).success).toBe(false);
    expect(exportAuditTransition(state, NOW, { reason: FACE.repeat(3) }).result).toMatchObject({ ok: true, status: 202 });
  });

  it('WHY a request is always handed on: the simulator\'s form without one records an export with no reason', () => {
    const { result, state: next } = exportAuditTransition(stateAs(OPERATOR_IDS.ANDI), NOW);
    expect(result).toMatchObject({ ok: true });
    expect(next.audit.rows.at(-1)?.details).not.toHaveProperty('reason');
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
    expect(readAuditExportBody(body)).toEqual({ kind: 'INVALID' });
  });

  it('nothing of a body comes back in the outcome of a refused one', () => {
    for (const body of [{ reason: `MARK-reason-9f2${'r'.repeat(500)}` }, { reason: 'ab', destination: 'MARK-destination-77c' }, { reason: 12, note: 'MARK-note-11a' }]) {
      const outcome = readAuditExportBody(body);
      expect(outcome.kind).not.toBe('VALID');
      expect(JSON.stringify(outcome)).not.toContain('MARK-');
    }
  });
});
