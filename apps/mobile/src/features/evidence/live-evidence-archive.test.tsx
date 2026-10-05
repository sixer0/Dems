// Backend task, plan row W74: site S3-1 — the archive dialog in LIVE mode, from the list's row kebab
// and from the detail's More menu, on the app's real Live source over the contract-checked fake
// transport (04_client_integration_spec §8.7 S3-1, §8.1 LB-1, LB-3, LB-6; AC-C-48, AC-C-63).
//
// AC-C-63: the success toast shows only after the Core's 2xx, and the danger toast on a refusal.
// AC-C-48: a 403 named by its example `notPermitted` shows the presenter's denied toast that names
// the required role, and the control returns to idle. An outage shows the presenter's toast.
// The last block pins Simulated mode: the dialog toasts and closes in one handler, as before.
//
// Import order: the test setup, then the router harness, then the beds (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { EvidenceStatus } from '@dems/shared/sim';
import { resetCoreErrorPresenterForTests, runtimeLog } from '@/runtime';
import { evidenceEn } from './i18n';
import { renderEvidenceApp, settle as settleSim } from './testing/evidence-harness';
import { pressMenuItem } from './testing/kit-helpers';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed, type LiveEvidenceBedOptions } from './testing/live-evidence-bed';

jest.setTimeout(30_000);

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  await resetLiveEvidenceBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const archived = (id: string) => evidenceEn.actions.archived.replace('{{id}}', id);
const FAILED = evidenceEn.actions.actionFailed;
const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Supervisor role';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const confirmButton = () => screen.getByTestId('evidence-archive-confirm');
const isBusy = () => confirmButton().props.accessibilityState?.busy === true;
const dialogOpen = () => screen.queryByTestId('evidence-archive-dialog') !== null;

async function open(options: LiveEvidenceBedOptions = {}): Promise<LiveEvidenceBed> {
  const b = await renderLiveEvidence(options);
  bed = b;
  return b;
}

/** The list's row kebab → Archive: the dialog opens over the list. */
async function openFromList(b: LiveEvidenceBed, suffix: string): Promise<string> {
  const id = b.idOf(suffix);
  pressMenuItem(`evidence-row-menu-${id}`, `evidence-row-archive-${id}`);
  await b.flush();
  expect(dialogOpen()).toBe(true);
  return id;
}

describe('S3-1 from the list: success only after the Core\'s 2xx (AC-C-63)', () => {
  it('the dialog stays busy while the request is out, shows the spinner late (LB-1), then toasts and closes after the answer', async () => {
    const b = await open({ role: 'supervisor' });
    b.answerDelayMs = 1_000;
    const id = await openFromList(b, '0001');

    fireEvent.press(confirmButton());
    await b.flush();
    // The request is out: one call, no toast yet, the dialog open and busy, no spinner before 420 ms.
    expect(b.requests('archiveEvidence')).toHaveLength(1);
    expect(toastShown(archived(id))).toBe(false);
    expect(dialogOpen()).toBe(true);
    expect(isBusy()).toBe(true);
    expect(screen.queryByTestId('evidence-archive-pending')).toBeNull();
    // A second press while busy sends nothing.
    fireEvent.press(confirmButton());
    await b.flush();
    expect(b.requests('archiveEvidence')).toHaveLength(1);

    await b.elapse(500);
    expect(screen.getByTestId('evidence-archive-pending')).toBeTruthy();
    expect(toastShown(archived(id))).toBe(false);
    expect(dialogOpen()).toBe(true);

    await b.elapse(700);
    expect(toastShown(archived(id))).toBe(true);
    expect(dialogOpen()).toBe(false);
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.ARCHIVED);
    expect(b.engine.sim.store.getState().audit.rows.some((row) => row.type === 'EVIDENCE_ARCHIVED' && row.evidenceId === id)).toBe(true);
  });

  it('refusal: archiveEvidence 403 (example notPermitted) → the denied toast that names the role; no success toast; the dialog closes', async () => {
    const b = await open({ role: 'supervisor' });
    const id = await openFromList(b, '0002');
    b.fake.answerOnceFromExample('archiveEvidence', 403, 'notPermitted');

    fireEvent.press(confirmButton());
    await b.flush();
    await b.elapse(300);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(toastShown(archived(id))).toBe(false);
    expect(toastShown(FAILED)).toBe(false);
    expect(dialogOpen()).toBe(false);
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.SEALED);
    expect(runtimeLog.records().some((record) => record.source === 'evidence.archive' && record.context?.evidenceId === id)).toBe(true);
  });

  it('outage: no answer → the presenter\'s "Core server unreachable" toast, no success toast, nothing archived', async () => {
    const b = await open({ role: 'supervisor' });
    const id = await openFromList(b, '0003');
    b.fake.failOnce('archiveEvidence');

    fireEvent.press(confirmButton());
    await b.flush();
    await b.elapse(300);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(toastShown(archived(id))).toBe(false);
    expect(dialogOpen()).toBe(false);
    expect(b.state().evidence.find((item) => item.id === id)?.status).not.toBe(EvidenceStatus.ARCHIVED);
  });
});

describe('S3-1 from the detail\'s More menu', () => {
  it('success: the toast after the Core\'s 2xx, the dialog closes, the item is ARCHIVED in the replica', async () => {
    const b = await open({ role: 'supervisor' });
    const id = b.idOf('0004');
    await b.navigate(`/evidence/${id}`);
    expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    pressMenuItem('evidence-action-more', 'evidence-more-archive');
    await b.flush();
    expect(dialogOpen()).toBe(true);
    fireEvent.press(confirmButton());
    await b.flush();
    await b.elapse(300);
    expect(toastShown(archived(id))).toBe(true);
    expect(dialogOpen()).toBe(false);
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.ARCHIVED);
  });

  it('an INVESTIGATOR sees the entry disabled by the hint (S5-5) and the Core is not asked', async () => {
    const b = await open({ role: 'investigator' });
    const id = b.idOf('0001');
    await b.navigate(`/evidence/${id}`);
    pressMenuItem('evidence-action-more', 'evidence-more-archive');
    await b.flush();
    expect(dialogOpen()).toBe(false);
    expect(b.requests('archiveEvidence')).toHaveLength(0);
  });
});

describe('Simulated mode is unchanged (CLG a)', () => {
  it('the dialog toasts and closes in the same handler; the simulator archives the item', async () => {
    resetCoreErrorPresenterForTests();
    const h = renderEvidenceApp({ window: 'phonePortrait', user: 'andi.pratama' });
    await settleSim();
    const id = h.idOf('0001');
    pressMenuItem(`evidence-row-menu-${id}`, `evidence-row-archive-${id}`);
    await settleSim();
    expect(dialogOpen()).toBe(true);
    expect(confirmButton().props.accessibilityState?.busy).toBeUndefined();
    act(() => {
      fireEvent.press(confirmButton());
    });
    expect(toastShown(archived(id))).toBe(true);
    await settleSim();
    expect(dialogOpen()).toBe(false);
    expect(h.sim.store.getState().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.ARCHIVED);
  });
});
