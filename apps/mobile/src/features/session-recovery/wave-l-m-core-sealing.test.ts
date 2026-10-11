// Fix wave L, driver L-M - re-check 75 finding G75d-08 (note; known as G75c-10 (b)): after the capture
// worker was killed the tablet stood on "Session recovery / Start recovery / Recovery closes the session
// as incomplete. It never seals it." for 8 s while the Core was already sealing the interrupted prefix.
//
// CAN THE APP KNOW? Yes, from the session payload alone: `state FAULT` + `fault.fromState RECORDING` +
// `startedAt` + `captureDurable: true`. A Core in its own capture hands every interrupted recording
// with durable media to its seal by itself (capture-session: "durable media is always handed over"),
// so with those members the screen says the Core is sealing - and offers no recovery. The screen adds
// "this is a Core server in its own capture" (`realCaptureSources`), so the simulator's fault keeps
// its recovery prompt (held by `failed-start.test.tsx`, CONTROL "a FAULT with a durable recording").
// NOT proven on a device (the brief asks for the rule and its test): re-drive list of note 155.
import { describe, expect, it } from '@jest/globals';
import { coreSealsInterruptedPrefix } from './recovery.model';

const interrupted = { state: 'FAULT', startedAt: 1_791_682_000_000, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' }, captureDurable: true };

describe('G75d-08 - the session payload says the Core seals the interrupted prefix by itself', () => {
  it('FAULT from RECORDING, started, with durable media of the Core\'s own capture', () => {
    expect(coreSealsInterruptedPrefix(interrupted)).toBe(true);
    // The restart fault of a Core in its own capture is the same case (the next start seals it).
    expect(coreSealsInterruptedPrefix({ ...interrupted, fault: { kind: 'POWER_FAIL', fromState: 'RECORDING', coreNotRunning: true } as never })).toBe(true);
  });

  it('CONTROL - every other session keeps the recovery screen', () => {
    // The simulator's session carries no `captureDurable`.
    const { captureDurable: _member, ...simulated } = interrupted;
    expect(coreSealsInterruptedPrefix(simulated)).toBe(false);
    // A failed start: nothing was recorded.
    expect(coreSealsInterruptedPrefix({ ...interrupted, captureDurable: false })).toBe(false);
    expect(coreSealsInterruptedPrefix({ ...interrupted, startedAt: null })).toBe(false);
    // A fault before the recording started, and a state that is not FAULT.
    expect(coreSealsInterruptedPrefix({ ...interrupted, fault: { fromState: 'ARMED' } })).toBe(false);
    expect(coreSealsInterruptedPrefix({ ...interrupted, state: 'RECOVERY' })).toBe(false);
    expect(coreSealsInterruptedPrefix({ ...interrupted, state: 'FINALIZING' })).toBe(false);
    expect(coreSealsInterruptedPrefix({ ...interrupted, fault: null })).toBe(false);
    expect(coreSealsInterruptedPrefix(null)).toBe(false);
    expect(coreSealsInterruptedPrefix(undefined)).toBe(false);
    // Only the boolean `true` counts.
    expect(coreSealsInterruptedPrefix({ ...interrupted, captureDurable: 'true' })).toBe(false);
  });
});
