// Fix wave L, driver L-S - re-check 70 notes G70c-04 and G70c-05: ONE RULE for "a session is open".
//
// | Rule | Test |
// |------|------|
// | G70c-05: a SEALED session is not the session of a camera search - no session, no `sessionId` on the row; every other state names it | 1, 2 |
// | The rule is the session machine's (`isSessionActive`), state for state | 1 |
// | The module hands the engine's session through that rule and no other | 3 |
// | G70c-04: the boot statement of the capture configuration reads "a session that is not SEALED", not "a session row exists" | 4 |
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { captureDiscoverySearchedDetails } from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { isSessionActive, type ActiveSession } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { READ_CAPTURE_STATE } from '../../capture-config/store';
import { openSessionOf } from '../search';

const SESSION = 'SES-20261011-0037';

describe('G70c-05: the session a camera search ran in', () => {
  it('1. null for no session and for a SEALED one; the session for every other state - exactly `isSessionActive`', () => {
    expect(openSessionOf(null)).toBeNull();
    for (const state of Object.values(SessionState)) {
      const open = openSessionOf({ id: SESSION, state });
      expect(open === null).toBe(!isSessionActive({ id: SESSION, state } as unknown as ActiveSession));
      if (state === SessionState.SEALED) expect(open).toBeNull();
      else expect(open).toEqual({ id: SESSION, state });
    }
    // CONTROL (the finding): the session of before - "there is a session in the state" - named the sealed one.
    const before = (session: { id: string; state: string } | null) => (session === null ? null : { id: session.id, state: session.state });
    expect(before({ id: SESSION, state: SessionState.SEALED })?.id).toBe(SESSION);
  });

  it('2. the row of a search while the last session is SEALED carries no `sessionId`; while one RECORDS it carries it', () => {
    const details = (open: { id: string } | null) =>
      captureDiscoverySearchedDetails({ searchId: 'DSC-000007', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 1, newCount: 0, registeredCount: 1, interfaceCount: 1, failureReason: null, sessionId: open?.id ?? null, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' });
    expect('sessionId' in details(openSessionOf({ id: SESSION, state: SessionState.SEALED }))).toBe(false);
    expect(details(openSessionOf({ id: SESSION, state: SessionState.RECORDING }))).toMatchObject({ sessionId: SESSION });
  });

  it('3. the module reads the engine\'s session through `openSessionOf`, at one place', () => {
    const source = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8');
    expect(source.match(/openSessionOf\(app\.engine\.state\(\)\.session\)/g)).toHaveLength(1);
    expect(source).not.toMatch(/session === null \? null : \{ id: session\.id/);
  });
});

describe('G70c-04: the boot line `CAPTURE_CONFIG_LOADED ... locked`', () => {
  it('4. the load statement calls a session open while it is NOT SEALED - the rule of operation 76 - and no longer "a row exists"', () => {
    expect(READ_CAPTURE_STATE).toContain("EXISTS (SELECT 1 FROM public.active_session s WHERE s.state <> 'SEALED') AS session_open");
    expect(READ_CAPTURE_STATE).not.toContain('EXISTS (SELECT 1 FROM public.active_session) AS session_open');
    expect(SessionState.SEALED).toBe('SEALED');
  });
});
