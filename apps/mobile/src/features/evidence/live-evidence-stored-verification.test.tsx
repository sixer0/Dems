// Closing-fix row CF-M2, defect R-T-2 (decision D212): the Live Hash & Integrity card always said
// "Verified by the Core", even for an item the Core had not verified (re-test J28 / P07c: the Core's
// record of EV-20261006-0017 held `verification.status NOT_RUN`). The heading was the fixed key
// `features.evidence.integrity.verifiedByCore` (`live-integrity-tab.tsx:133-135` before the fix) and
// the view model read only an on-screen Verify answer (`evidence-model.ts:349-374`), never the item's
// stored `verification`.
//
// Now the card reads the record like the web after E2E-W1-3: PASS "Verified by the Core" with a
// "Last verification PASS · <time> · <operator>" line, FAIL "Verification failed on the Core",
// NOT_RUN "Not verified yet"; a new Verify updates both (after its paced reveal). Phone and tablet.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { en as sharedEn } from '@dems/shared/i18n';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import type { EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import type { WindowName } from '@/navigation/testing/router-harness';
import { CORE_HEADING_KEYS, coreVerificationState, storedVerification } from './evidence-model';
import { evidenceEn } from './i18n';
import { VERIFY_ASK_MS } from './integrity-tab';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed, type LiveEvidenceBedOptions } from './testing/live-evidence-bed';
import { SCRAMBLE_MS } from './use-scramble';

jest.setTimeout(30_000);

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const engineItem = (engine: LiveEvidenceBed['engine'], suffix: string): EvidenceItem =>
  engine.sim.store.getState().evidence.find((item) => item.id.endsWith(`-${suffix}`))!;

/** The record's verification, written on the Core's engine before the device signs in. */
const verifiedOnCore = (suffix: string, tamper = false): LiveEvidenceBedOptions['setup'] => (engine) => {
  const id = engineItem(engine, suffix).id;
  if (tamper) engine.sim.actions.inject('TAMPER', { evidenceId: id, trackId: 'VIDEO-01' });
  engine.sim.actions.verify(id);
};

async function openIntegrity(suffix: string, options: LiveEvidenceBedOptions = {}): Promise<{ b: LiveEvidenceBed; id: string; scope: typeof screen | ReturnType<typeof within> }> {
  const b = await renderLiveEvidence(options);
  bed = b;
  const id = b.idOf(suffix);
  await b.navigate(`/evidence/${id}`);
  const scope = options.window?.startsWith('tablet') ? within(screen.getByTestId('pane-detail')) : screen;
  expect(scope.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  fireEvent.press(scope.getByTestId('evidence-tab-integrity'));
  await b.flush();
  return { b, id, scope };
}

/** The web's line, from the shared keys: result, the Core's time with its zone, the operator. */
function lastLine(b: LiveEvidenceBed, id: string): string {
  const item = b.state().evidence.find((entry) => entry.id === id)!;
  const stored = storedVerification(item)!;
  const at = `${formatDate(stored.at!, DATE_PATTERNS.dateTime)} ${formatDate(stored.at!, DATE_PATTERNS.zone)}`;
  const actor = b.state().operators.find((operator) => operator.id === stored.actorId)!.displayName;
  return sharedEn.evidence.verify.last.full.replace('{{result}}', stored.status).replace('{{at}}', at).replace('{{actor}}', actor);
}

const WINDOWS: readonly WindowName[] = ['phonePortrait', 'tabletLandscape'];

describe('storedVerification / coreVerificationState (web parity)', () => {
  it('NOT_RUN holds nothing; a PASS or FAIL carries its time and the actor of the custody entry of that instant', () => {
    const base = { verification: { status: 'NOT_RUN' as const, at: null }, custody: [] };
    expect(storedVerification(base)).toBeNull();
    const pass = {
      verification: { status: 'PASS' as const, at: 1_000 },
      custody: [
        { at: 1_000, action: 'VERIFIED' as const, actorId: 'OPR-002', detail: null },
        // A later VERIFIED by someone else is not the record's verification of `at`.
        { at: 6_000, action: 'VERIFIED' as const, actorId: 'OPR-003', detail: null },
      ],
    };
    expect(storedVerification(pass)).toEqual({ status: 'PASS', at: 1_000, actorId: 'OPR-002', actorKnown: true });
    expect(storedVerification({ verification: { status: 'FAIL', at: 2_000 }, custody: [] })).toEqual({ status: 'FAIL', at: 2_000, actorId: null, actorKnown: false });
    // W93-25 (FXR-M): an entry of the verdict exists, but not at the verification's instant (an older
    // verification): the actor is NOT known — it used to name that older entry's operator.
    expect(
      storedVerification({
        verification: { status: 'PASS', at: 5_000 },
        custody: [{ ...pass.custody[0]!, at: 1_000 }],
      } as Parameters<typeof storedVerification>[0]),
    ).toEqual({ status: 'PASS', at: 5_000, actorId: null, actorKnown: false });
    expect(coreVerificationState(null, null)).toBe('NOT_RUN');
    expect(coreVerificationState({ status: 'PASS' }, null)).toBe('PASS');
    expect(coreVerificationState({ status: 'PASS' }, 'FAIL')).toBe('FAIL');
    expect(CORE_HEADING_KEYS).toEqual({
      PASS: 'features.evidence.integrity.verifiedByCore',
      FAIL: 'features.evidence.integrity.failedOnCore',
      NOT_RUN: 'features.evidence.integrity.notVerifiedYet',
    });
  });
});

describe.each(WINDOWS)('R-T-2 on %s', (window) => {
  it('NOT_RUN: "Not verified yet", no last line; a new Verify turns it into "Verified by the Core" with the run\'s time and operator, only once revealed', async () => {
    const { b, id, scope } = await openIntegrity('0002', { window });
    expect(b.state().evidence.find((item) => item.id === id)?.verification.status).toBe('NOT_RUN');
    expect(scope.getByTestId('evidence-integrity-heading-NOT_RUN')).toHaveTextContent(evidenceEn.integrity.notVerifiedYet);
    expect(scope.queryByText(evidenceEn.integrity.verifiedByCore)).toBeNull();
    expect(scope.queryByTestId('evidence-verify-last-PASS')).toBeNull();
    expect(scope.getByTestId('evidence-verdict-pending')).toHaveTextContent(evidenceEn.integrity.coreNotRun);
    expect(within(scope.getByTestId('evidence-verify')).getByText(evidenceEn.integrity.verify)).toBeTruthy();

    fireEvent.press(scope.getByTestId('evidence-verify'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS - 150);
    // The replica already holds the Core's PASS (its delta precedes the answer, CL-16) ...
    expect(b.state().evidence.find((item) => item.id === id)?.verification.status).toBe('PASS');
    // ... but the paced reveal (LB-2) keeps the card as it was when the run started.
    expect(scope.getByTestId('evidence-integrity-heading-NOT_RUN')).toBeTruthy();
    expect(scope.queryByTestId('evidence-verify-last-PASS')).toBeNull();

    await b.elapse(SCRAMBLE_MS + 450);
    expect(scope.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(scope.getByTestId('evidence-integrity-heading-PASS')).toHaveTextContent(evidenceEn.integrity.verifiedByCore);
    expect(scope.getByTestId('evidence-verify-last-PASS')).toHaveTextContent(lastLine(b, id));
  });

  it('a PASS the Core holds: "Verified by the Core" before any run, the last verification\'s result, time and operator, "Verify again"', async () => {
    const { b, id, scope } = await openIntegrity('0001', { window, setup: verifiedOnCore('0001') });
    expect(b.state().evidence.find((item) => item.id === id)?.verification.status).toBe('PASS');
    expect(scope.getByTestId('evidence-integrity-heading-PASS')).toHaveTextContent(evidenceEn.integrity.verifiedByCore);
    const line = lastLine(b, id);
    expect(line).toMatch(/^Last verification PASS · \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} UTC[+-]\d{2}:\d{2} · \S/);
    expect(scope.getByTestId('evidence-verify-last-PASS')).toHaveTextContent(line);
    expect(scope.getByTestId('evidence-verify-stored-hint')).toHaveTextContent(sharedEn.evidence.verify.storedHint);
    expect(scope.queryByTestId('evidence-verdict-pending')).toBeNull();
    expect(within(scope.getByTestId('evidence-verify')).getByText(evidenceEn.integrity.verifyAgain)).toBeTruthy();
    // No verdict of this screen is claimed: the per-track rows stay unrevealed until a run.
    expect(scope.queryByTestId('evidence-verdict-PASS')).toBeNull();
  });

  it('a FAIL the Core holds: "Verification failed on the Core" and its line; a new Verify keeps FAIL and moves the line to the new run', async () => {
    const { b, id, scope } = await openIntegrity('0001', { window, setup: verifiedOnCore('0001', true) });
    expect(scope.getByTestId('evidence-integrity-heading-FAIL')).toHaveTextContent(evidenceEn.integrity.failedOnCore);
    expect(scope.queryByText(evidenceEn.integrity.verifiedByCore)).toBeNull();
    const before = lastLine(b, id);
    expect(before).toMatch(/^Last verification FAIL · /);
    expect(scope.getByTestId('evidence-verify-last-FAIL')).toHaveTextContent(before);

    // A minute later on the Core's clock, a new Verify from this device.
    b.engine.clock.advance(60_000);
    fireEvent.press(scope.getByTestId('evidence-verify'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    expect(scope.getByTestId('evidence-verdict-FAIL')).toHaveTextContent(/VIDEO-01/);
    expect(scope.getByTestId('evidence-integrity-heading-FAIL')).toBeTruthy();
    const after = lastLine(b, id);
    expect(after).not.toBe(before);
    expect(scope.getByTestId('evidence-verify-last-FAIL')).toHaveTextContent(after);
  });
});
