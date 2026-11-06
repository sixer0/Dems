// Backend task, plan row W80: the Operator Audit view in LIVE mode — settle site S1-7 (Verify, operation
// 60 `verifyAuditChain`) and S4-3 (its time stamp on the Live clock), on the app's real Live source over
// the contract-checked fake transport (`testing/live-audit-bed`). Per client gate CLG (b): the success, the
// refusal (the contract's own 403 of operation 60, and the denied toast of AC-C-48), an outage; and the
// limit (LB-10), the pending behaviour (LB-1: busy at once, the runtime's spinner late; D166), the Core's stored
// chain and lineage lines (§8.2 A9, mobile form), the link notice (rows M0, M1) and StrictMode (D158).
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/audit-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import type { AuditChainLineageEntry, AuditChainStatus } from '@dems/shared/api';
import { OUTAGE, rateLimited, refusal, type FakeAnswer } from '@dems/shared/live/testing';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { FaultKind, selectAuditChainBreak } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderLiveAudit, resetLiveAuditBed, type LiveAuditBed, type LiveAuditBedOptions } from './testing/live-audit-bed';

let bed: LiveAuditBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveAuditBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  // MA-21: every string the screen renders comes from an i18n key, in LIVE mode as well.
  expect(getMissingKeys()).toEqual([]);
});

const VERIFY_FAILED = 'The chain could not be checked. Try again.';
const OFFLINE = 'Core server unreachable';
const isBusy = () => screen.getByTestId('audit-verify').props.accessibilityState?.busy === true;
const toastShown = (text: string | RegExp) => screen.queryAllByText(text).length > 0;
const verdictText = () => screen.getByTestId('audit-verify-text').props.children as string;
const bodyOf = (answer: FakeAnswer) => answer.body as AuditChainStatus;

async function openAudit(options: LiveAuditBedOptions = {}): Promise<LiveAuditBed> {
  const b = await renderLiveAudit(options);
  bed = b;
  expect(b.app.getPathname()).toBe('/audit');
  expect(screen.getByTestId('screen-audit')).toBeTruthy();
  return b;
}

/** Presses Verify (Live mode sends at the press; one frame is let pass as for the Simulated path). */
async function pressVerify(b: LiveAuditBed): Promise<void> {
  fireEvent.press(screen.getByTestId('audit-verify'));
  await b.nextFrame();
}

describe('S1-7 and S4-3: Verify sends operation 60 and shows the Core\'s verdict', () => {
  it('success: busy at the press, the look unchanged until the reveal delay, then the PendingSpinner until the Core answers; one request; the Core\'s view, stamped with the Live clock; the stored line', async () => {
    const b = await openAudit();
    const held = b.fake.hold('verifyAuditChain');

    fireEvent.press(screen.getByTestId('audit-verify'));
    await b.flush();
    // Live mode sends at the press (D166: one control, one command): one GET, marked busy at once (LB-1) …
    expect(b.requests('verifyAuditChain').map((call) => call.method)).toEqual(['GET']);
    expect(isBusy()).toBe(true);
    // … and for the first LIVE_PENDING_REVEAL_MS the button looks as it did: no spinner, no "Verifying…".
    expect(screen.queryByTestId('audit-verify-spinner')).toBeNull();
    expect(screen.getByTestId('audit-verify')).toHaveTextContent('Verify');
    expect(screen.getByTestId('audit-verify')).not.toHaveTextContent('Verifying…');
    await b.elapse(300, 100);
    expect(screen.queryByTestId('audit-verify-spinner')).toBeNull();
    // A second press while the request is out sends nothing.
    await pressVerify(b);
    expect(b.requests('verifyAuditChain')).toHaveLength(1);
    // Past the reveal delay: the runtime's PendingSpinner in the button, and still no verdict.
    await b.elapse(300, 100);
    expect(screen.getByTestId('audit-verify-spinner')).toBeTruthy();
    expect(screen.getByTestId('audit-verify')).toHaveTextContent('Verifying…');
    await b.elapse(2_000, 250);
    expect(screen.getByTestId('audit-verify-spinner')).toBeTruthy();
    expect(screen.queryByTestId('audit-verify-PASS')).toBeNull();

    const answer = b.chainAnswer();
    const { view, stored } = bodyOf(answer);
    expect(view.ok).toBe(true);
    held.release(answer);
    await b.flush();

    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
    // S4-3: the time stamp is the store's clock, which in LIVE is the Core's (the Live source's clock slice).
    expect(verdictText()).toBe(`Checked ${view.checked} entries at ${formatDate(b.state().clock.now, DATE_PATTERNS.time)}`);
    expect(view.checked).toBe(b.state().audit.rows.length);
    expect(screen.getByTestId('audit-live-stored-ok')).toHaveTextContent(`Stored audit log, checked separately: verified through entry #${stored.checked}`);
    expect(screen.queryByTestId('audit-live-lineage')).toBeNull();
    expect(isBusy()).toBe(false);
    expect(screen.queryByTestId('audit-verify-spinner')).toBeNull();
    expect(screen.getByTestId('audit-verify')).not.toHaveTextContent('Verifying…');
    expect(toastShown(VERIFY_FAILED)).toBe(false);
  });

  it('a later verification keeps the last verdict on screen while it is out, and a refused one leaves it there', async () => {
    const b = await openAudit();
    await pressVerify(b);
    await b.flush();
    const first = verdictText();
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();

    await b.elapse(2_000, 250);
    const held = b.fake.hold('verifyAuditChain');
    await pressVerify(b);
    // The look does not change while the request is out: the last verdict stays.
    expect(verdictText()).toBe(first);
    held.release(b.chainAnswer());
    await b.flush();
    expect(verdictText()).not.toBe(first);
    const second = verdictText();

    b.fake.answerOnce('verifyAuditChain', OUTAGE);
    await pressVerify(b);
    await b.flush();
    expect(toastShown(OFFLINE)).toBe(true);
    expect(verdictText()).toBe(second);
    expect(isBusy()).toBe(false);
    expect(b.requests('verifyAuditChain')).toHaveLength(3);
  });

  it('AUDIT_TAMPER on the Core: the chip and the Alert follow the replicated fault; the Core\'s view FAILS at the altered row while its stored chain stays verified', async () => {
    const b = await openAudit({ setup: (engine) => engine.sim.actions.inject(FaultKind.AUDIT_TAMPER) });
    const breakSeq = selectAuditChainBreak(b.state())!.seq;
    expect(breakSeq).toBe(selectAuditChainBreak(b.engine.sim.store.getState())!.seq);
    expect(screen.getByTestId('audit-chain-chip-broken')).toBeTruthy();
    expect(screen.getByTestId('audit-tamper-alert')).toHaveTextContent(new RegExp(`entry #${breakSeq}\\.`));

    await pressVerify(b);
    await b.flush();
    expect(screen.getByTestId('audit-verify-FAIL')).toBeTruthy();
    expect(verdictText()).toMatch(new RegExp(`^Breaks at entry #${breakSeq}: Hash mismatch \\(checked at \\d\\d:\\d\\d:\\d\\d\\)$`));
    // The demo fault cannot reach the table (implementation/39 §6.1): the stored line stays verified.
    // Fix wave J (JA2-31): under a FAIL that line says WHICH chain broke, so "verified" is no contradiction.
    expect(screen.getByTestId('audit-live-stored-ok')).toHaveTextContent(
      `The break is in the chain the Core is holding. Its stored audit log, checked separately, verifies through entry #${b.engine.sim.store.getState().audit.total}`,
    );
    expect(b.requests('verifyAuditChain')).toHaveLength(1);

    // JA2-31: the fault is cleared on the Core. The FAIL and the lines of that answer do not stand beside "Chain OK".
    await b.onEngine((engine) => engine.sim.actions.clearFault(FaultKind.AUDIT_TAMPER));
    await b.flush();
    expect(screen.getByTestId('audit-chain-chip-ok')).toBeTruthy();
    expect(screen.queryByTestId('audit-verify-FAIL')).toBeNull();
    expect(screen.queryByTestId('audit-live-chain')).toBeNull();
    expect(verdictText()).toMatch(new RegExp(`the check found a break at entry #${breakSeq}\\. The chain has changed since then\\. Verify again\\.$`));
    expect(b.requests('verifyAuditChain')).toHaveLength(1);
  });

  it('a stored row that does not verify, and chains discarded by resets: the two lines say so, from the Core\'s numbers', async () => {
    const b = await openAudit();
    const head = b.state().audit.head;
    b.stored = () => ({ ok: false, checked: 41, head, firstBadSeq: 42 });
    const entry = (epoch: number, reason: AuditChainLineageEntry['reason']): AuditChainLineageEntry => ({
      epoch,
      rows: 100 + epoch,
      head,
      resetAt: b.fake.clock.now() - epoch * 60_000,
      actorId: reason === 'RESET' ? 'OPR-002' : null,
      scenario: reason === 'RESET' ? 'idle' : 'recording',
      reason,
    });
    b.lineage = [entry(2, 'SCENARIO_LOAD'), entry(1, 'RESET')];

    await pressVerify(b);
    await b.flush();
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
    expect(screen.getByTestId('audit-live-stored-broken')).toHaveTextContent('Stored audit log, checked separately: breaks at entry #42');
    expect(screen.getByTestId('audit-live-lineage')).toHaveTextContent('The audit chain was restarted 2 times by demo resets or scenario loads');

    // One discarded chain: the singular sentence.
    b.lineage = [entry(1, 'RESET')];
    await pressVerify(b);
    await b.flush();
    expect(screen.getByTestId('audit-live-lineage')).toHaveTextContent('The audit chain was restarted 1 time by a demo reset or a scenario load');
    expect(b.requests('verifyAuditChain')).toHaveLength(2);
  });

  it('a refusal, by the contract\'s own 403 of operation 60 (`originNotAllowed`): the presenter\'s toast, no verdict, the button idle; the next press asks again', async () => {
    const b = await openAudit();
    b.fake.answerOnce('verifyAuditChain', b.fake.example('verifyAuditChain', 403, 'originNotAllowed'));
    await pressVerify(b);
    await b.flush();
    expect(toastShown('The Core refused this action')).toBe(true);
    expect(toastShown(VERIFY_FAILED)).toBe(false);
    expect(screen.queryByTestId('audit-verify-PASS')).toBeNull();
    expect(screen.queryByTestId('audit-verify-FAIL')).toBeNull();
    expect(screen.queryByTestId('audit-live-chain')).toBeNull();
    expect(isBusy()).toBe(false);
    expect(screen.getByTestId('audit-verify')).toHaveTextContent('Verify');

    await pressVerify(b);
    await b.flush();
    expect(b.requests('verifyAuditChain')).toHaveLength(2);
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
  });

  it('a denial (403 NOT_PERMITTED, RESIDUAL-W80-1 (W83 ledger #58): the envelope written here): the denied toast, the button idle', async () => {
    const b = await openAudit();
    // Operation 60 needs no permission (every signed-in role may call it), so the contract has no
    // `notPermitted` example and a role cannot be named (W66 F-3); the envelope proves the presenter path.
    b.fake.answerOnce('verifyAuditChain', refusal(403, 'NOT_PERMITTED', 'Not permitted.'));
    await pressVerify(b);
    await b.flush();
    expect(toastShown('Not permitted')).toBe(true);
    expect(toastShown(/^Requires the /)).toBe(false);
    expect(toastShown(VERIFY_FAILED)).toBe(false);
    expect(screen.queryByTestId('audit-verify-PASS')).toBeNull();
    expect(isBusy()).toBe(false);
    expect(screen.getByTestId('audit-verify')).toHaveTextContent('Verify');
  });

  it('an outage on the request: "Core server unreachable / Nothing was changed.", no verdict, the button idle, no link notice (the socket is up)', async () => {
    const b = await openAudit();
    b.fake.answerOnce('verifyAuditChain', OUTAGE);
    await pressVerify(b);
    await b.flush();
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown('Nothing was changed.')).toBe(true);
    expect(toastShown(VERIFY_FAILED)).toBe(false);
    expect(screen.queryByTestId('audit-link-offline')).toBeNull();
    expect(screen.queryByTestId('audit-verify-PASS')).toBeNull();
    expect(isBusy()).toBe(false);

    await pressVerify(b);
    await b.flush();
    expect(b.requests('verifyAuditChain')).toHaveLength(2);
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
  });

  it('a limit (429, LB-10): the limit toast with the seconds of retry-after; never the offline wording or the link notice', async () => {
    const b = await openAudit();
    b.fake.answerOnce('verifyAuditChain', rateLimited(30));
    await pressVerify(b);
    await b.flush();
    expect(toastShown('The Core server is limiting requests from this device')).toBe(true);
    expect(toastShown('Try again in 30 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('audit-link-offline')).toBeNull();
    expect(isBusy()).toBe(false);
  });
});

describe('the Core link (rows M0 and M1: one rule, one call)', () => {
  it('while the link is down the notice says the rows are the last the Core sent; a press is refused locally; the notice leaves when the Core is back', async () => {
    const b = await openAudit();
    const count = screen.getByTestId('audit-count').props.children as string;
    expect(screen.queryByTestId('audit-link-offline')).toBeNull();

    b.setReachable(false);
    await b.elapse(6_000, 250);
    expect(screen.getByTestId('audit-link-offline')).toHaveTextContent(/Core server unreachable/);
    expect(screen.getByTestId('audit-link-offline')).toHaveTextContent(/The entries shown are the last the Core sent\./);
    // The screen keeps what the Core sent last.
    expect(screen.getByTestId('audit-count').props.children).toBe(count);

    await pressVerify(b);
    await b.flush();
    expect(b.requests('verifyAuditChain')).toHaveLength(0);
    expect(toastShown('Nothing was changed.')).toBe(true);
    expect(isBusy()).toBe(false);

    b.setReachable(true);
    await b.elapse(15_000, 250);
    expect(screen.queryByTestId('audit-link-offline')).toBeNull();
    await pressVerify(b);
    await b.flush();
    expect(b.requests('verifyAuditChain')).toHaveLength(1);
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
  });
});

describe('StrictMode (decision D158, finding F69-1)', () => {
  it('mounted twice by StrictMode, the screen starts no request; one press sends ONE request', async () => {
    const b = await openAudit({ strict: true });
    await b.elapse(3_000, 500);
    expect(b.requests('verifyAuditChain')).toHaveLength(0);
    const sent = [...new Set(b.fake.log.operationIds())].sort();
    expect(sent.filter((operationId) => !['getAuthSession', 'getDeviceRegistration', 'getSignInStatus', 'signIn', 'touchSession'].includes(operationId))).toEqual([]);

    await pressVerify(b);
    await b.flush();
    expect(b.requests('verifyAuditChain')).toHaveLength(1);
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
  });
});
