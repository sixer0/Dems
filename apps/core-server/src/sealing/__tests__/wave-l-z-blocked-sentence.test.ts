// Fix wave L, closing pass L-Z - re-check 75 finding G75d-02, decision 3 of implementation/155: the
// Core's own sentences of a BLOCKED seal said "then start recovery for the session or restart the
// Core" and "tried again ... by the recovery action". No screen offers a control of that name: the
// retry (operation 33) is "Retry sealing" on the web console's Session Monitor, for an investigator
// or a supervisor; after its automatic retries the Core WAITS.
//
// | Rule | Test |
// |------|------|
// | Every restore hint ends with the retry by its screen name, who presses it and where, and the restart - from the ONE shared sentence | 1 |
// | No sentence of a blocked seal says "start recovery", "recovery action" or names an operation, a permission or a code | 1, 2 |
// | The failed step's sentence once the retries are used up: the cause, "stopped after n automatic retries", and that the Core waits; n is the bound of the settings in force | 2, 4 |
// | The examples the clients build on are the Core's words, character for character | 3 |
// | Every notice fits the engine door's bound; the door refuses a longer one (negative control) | 5 |
// | A Core that CLOSES before its retries are used up does not say "stopped after n retries" | 6 |
import {
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_RETRY_CONTROL_NAME,
  SEAL_RETRY_HOW_SENTENCE,
  canRetryBlockedSeal,
  OperatorRole,
  sealStoppedSentence,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { SEAL_BLOCKED_MESSAGE_MAX, raiseSealBlockedTransition } from '../../engine/sealing-notice-doors';
import { SEAL_RETRY_DEFAULTS, SealerCause, SealingFailure, sealBlockedNotice, sealBlockedRestoreHint, sealClosingNotice, sealWaitingNotice, sealingFailureReason, type SealingDetail } from '../index';

const DETAILS: SealingDetail[] = [{}, { trackId: 'VIDEO-02' }, ...Object.values(SealerCause).map((cause) => ({ cause }))];
/** Words of the contract and of the code that an operator's sentence must not carry. */
const NOT_FOR_AN_OPERATOR = /start recovery|recovery action|recovery operation|recoverSession|operation 33|SESSION_START|SEAL_RETRY|[A-Z]{3,}_[A-Z_]{3,}/;

describe('G75d-02 (closing pass L-Z): the Core names the retry by the name its screen has', () => {
  it('1. every restore hint ends with "Retry sealing" on the Session Monitor of the web console, an investigator or a supervisor, or a restart', () => {
    expect(SEAL_RETRY_CONTROL_NAME).toBe('Retry sealing');
    expect(SEAL_RETRY_HOW_SENTENCE).toBe('an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted.');
    // The sentence says who; the contract says the same two roles and not the technician.
    expect([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN].map(canRetryBlockedSeal)).toEqual([true, true, false]);
    let hints = 0;
    for (const code of Object.values(SealingFailure)) {
      for (const detail of DETAILS) {
        const hint = sealBlockedRestoreHint(code, detail);
        hints += 1;
        expect(hint.endsWith(`, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`), `${code}: ${hint}`).toBe(true);
        expect(hint, code).not.toMatch(NOT_FOR_AN_OPERATOR);
        const notice = sealBlockedNotice(code, detail);
        expect(notice, code).toContain(hint);
        expect(notice, code).toContain(`"${SEAL_RETRY_CONTROL_NAME}"`);
        expect(notice, code).not.toMatch(/start recovery|recovery action|recoverSession|operation 33/);
        expect(notice.endsWith(' The Core records no new session until this one is sealed.')).toBe(true);
      }
    }
    expect(hints).toBeGreaterThan(100);
  });

  it('2. the failed step once the retries are used up: the cause, then "stopped after 3 automatic retries: the Core now waits ..."', () => {
    const reason = sealingFailureReason(SealingFailure.SEALER_FAILED, { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE });
    expect(sealWaitingNotice(reason)).toBe(
      "The Core's key store cannot be used: the seal stopped and can be tried again. Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.",
    );
    expect(sealWaitingNotice(reason)).toBe(`${reason} ${sealStoppedSentence(SEAL_AUTOMATIC_RETRIES)}`);
    expect(sealWaitingNotice(reason)).not.toMatch(NOT_FOR_AN_OPERATOR);
    // CONTROL: the sentence of before is what this test refuses.
    expect(`${reason} Sealing will be tried again when the Core starts, or by the recovery action.`).toMatch(NOT_FOR_AN_OPERATOR);
    expect("Check the Core's database, then start recovery for the session or restart the Core.").toMatch(NOT_FOR_AN_OPERATOR);
  });

  it('3. the shared examples are the Core\'s own words', () => {
    const cause = { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE };
    expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toBe(sealBlockedNotice(SealingFailure.SEALER_FAILED, cause));
    expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION?.steps[0]?.detail).toBe(sealWaitingNotice(sealingFailureReason(SealingFailure.SEALER_FAILED, cause)));
    expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain('presses "Retry sealing" on the Session Monitor of the web console');
  });

  it('4. the number is the bound of the settings in force, and the default IS the shared constant', () => {
    expect(SEAL_RETRY_DEFAULTS.delaysMs.length).toBe(SEAL_AUTOMATIC_RETRIES);
    expect(sealWaitingNotice('X.', 1)).toBe('X. Sealing stopped after 1 automatic retry: the Core now waits and does not run it again by itself.');
    expect(sealWaitingNotice('X.', 2)).toContain('after 2 automatic retries');
  });

  it('5. every notice fits the door; the door refuses a longer message and takes the longest notice', () => {
    let longest = '';
    for (const code of Object.values(SealingFailure)) {
      for (const detail of DETAILS) {
        const notice = sealBlockedNotice(code, detail);
        if (notice.length > longest.length) longest = notice;
      }
    }
    expect(longest.length).toBeLessThanOrEqual(SEAL_BLOCKED_MESSAGE_MAX);
    // The reason this pass moved the bound: the longest notice does not fit the 400 of before.
    expect(longest.length).toBeGreaterThan(400);
    const state = { session: { id: 'SES-20261011-0047', state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION }, alerts: [], meta: { counters: { ALR: 4 } } } as unknown as SimState;
    const input = { sessionId: 'SES-20261011-0047', cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS' };
    expect(raiseSealBlockedTransition(state, 1, { ...input, message: longest }).alerts.at(-1)?.message).toBe(longest);
    expect(() => raiseSealBlockedTransition(state, 1, { ...input, message: 'x'.repeat(SEAL_BLOCKED_MESSAGE_MAX + 1) })).toThrow();
  });

  it('6. a Core that closes before its retries are used up says only that the next start runs the seal', () => {
    expect(sealClosingNotice('X.')).toBe('X. Sealing will be tried again when the Core starts.');
    expect(sealClosingNotice('X.')).not.toMatch(/automatic retries|Retry sealing/);
  });
});
