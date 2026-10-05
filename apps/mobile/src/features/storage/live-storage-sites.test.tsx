// Backend task, plan row W79: Storage in LIVE mode — settle site S2-6 (Apply in the Manage Storage
// sheet, operation 55 `setStoragePolicy`) with its success, its refusal (a 403 named by the contract's
// `notPermitted` example: the denied toast, AC-C-48), the Core's 422, an outage, a dead link and a limit;
// site S5-3 (the role gate stays a hint, the Core enforces its any-of rule); the screen on the Core's
// data; React StrictMode (decision D158); the Simulated control group. All on the app's real Live source
// over the contract-checked fake transport (04_client_integration_spec §8.1, §8.6, §8.7, §12.2).
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/storage-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { rateLimited, refusal } from '@dems/shared/live/testing';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { runtimeLog } from '@/runtime';
import { renderLiveStorage, renderSimulatedStorage, resetLiveStorageBed, type LiveStorageBed, type LiveStorageBedOptions } from './testing/live-storage-bed';

jest.setTimeout(30_000);

let bed: LiveStorageBed | null = null;

// Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveStorageBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  // MA-21: every string the screen renders comes from an i18n key, in LIVE mode as well.
  expect(getMissingKeys()).toEqual([]);
});

const DENIED = 'Not permitted';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const FAILED = 'The storage policy could not be updated. Please try again.';
const APPLIED_LIVE = 'Storage policy updated';
const APPLIED_SIMULATED = 'Storage policy updated (simulated)';
const LIMIT = 'The Core server is limiting requests from this tablet';

const toastShown = (text: string | RegExp) => screen.queryAllByText(text).length > 0;
/** No text on screen says "simulated" (rule 8, MD-8: a screen with the Core's data says nothing about a simulation). */
const saysSimulated = () => screen.queryAllByText(/simulat/i).length > 0;
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const sheetOpen = () => screen.queryByTestId('storage-manage-sheet') !== null;
const applyState = () => screen.getByTestId('storage-manage-apply').props as { accessibilityLabel: string; accessibilityState?: { disabled?: boolean; busy?: boolean } };
const rowLabels = () => screen.queryAllByTestId('storage-activity-row').map((row) => String(row.props.accessibilityLabel));
const applyRecords = () => runtimeLog.records().filter((record) => record.source === 'storage.manage.apply');
const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') parts.push(node);
    else if (node && typeof node === 'object' && 'children' in node) (node as { children: unknown[] }).children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};

/** Real time for the kit's sheet: it opens one frame after its content's layout and unmounts 450 ms after it closed. */
async function wallClock(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function openStorage(options: LiveStorageBedOptions = {}): Promise<LiveStorageBed> {
  const b = await renderLiveStorage(options);
  bed = b;
  await b.open('/storage');
  expect(b.app.getPathname()).toBe('/storage');
  expect(screen.getByTestId('screen-storage')).toBeTruthy();
  return b;
}

async function openSheet(b: LiveStorageBed): Promise<void> {
  fireEvent.press(screen.getByTestId('storage-manage'));
  await b.flush();
  await wallClock(50);
  expect(sheetOpen()).toBe(true);
}

/** Picks "1 year" with auto-archive off in the open sheet. */
function draftOneYearNoArchive(): void {
  fireEvent.press(screen.getByTestId('storage-manage-retention-YEAR_1'));
  fireEvent(screen.getByTestId('storage-manage-auto-archive'), 'onSelectedChange', false);
}

async function pressApply(b: LiveStorageBed): Promise<void> {
  fireEvent.press(screen.getByTestId('storage-manage-apply'));
  await b.flush();
}

/** The sheet still shows a draft that differs from the policy: Apply is enabled and labelled "Apply policy". */
function draftKept(): void {
  expect(applyState().accessibilityLabel).toBe('Apply policy');
  expect(applyState().accessibilityState?.disabled).not.toBe(true);
}

describe('S2-6: Apply in the Manage Storage sheet (operation 55)', () => {
  it("success as the SUPERVISOR: busy at once, spinner late (LB-1); one request; the toast and the closing only after the Core's 200; the Core's words", async () => {
    const b = await openStorage({ answerDelayMs: 2_000 });
    await openSheet(b);
    expect(screen.queryByTestId('storage-manage-readonly')).toBeNull();
    expect(textOf('storage-manage-current')).toBe('Current: 90 days · auto-archive on');
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(100);

    expect(b.requests('setStoragePolicy')).toHaveLength(1);
    const call = b.requests('setStoragePolicy')[0]!;
    expect(call.path).toBe('/api/v1/storage/policy');
    expect(call.body).toEqual({ retentionPolicy: 'YEAR_1', autoArchive: false });
    // The Core's delta came first and its answer has not: the Live source holds the delta (CL-16), so
    // nothing changed on screen; Apply is busy with its look unchanged.
    expect(b.state().storagePolicy.retentionPolicy).toBe('DAYS_90');
    expect(isBusy('storage-manage-apply')).toBe(true);
    expect(screen.queryByTestId('storage-manage-apply-spinner')).toBeNull();
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    // A second press sends nothing while the command is out.
    await pressApply(b);
    expect(b.requests('setStoragePolicy')).toHaveLength(1);

    await b.elapse(500);
    expect(screen.getByTestId('storage-manage-apply-spinner')).toBeTruthy();
    expect(sheetOpen()).toBe(true);
    expect(toastShown(APPLIED_LIVE)).toBe(false);

    await b.elapse(1_500);
    // The answer: the held delta, the toast and the closing land together.
    expect(b.state().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: false });
    expect(toastShown(APPLIED_LIVE)).toBe(true);
    expect(toastShown(APPLIED_SIMULATED)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(false);
    // The Core's audit-chain event is the first storage activity row; nothing says "simulated".
    expect(rowLabels()[0]).toContain('Storage policy changed · 365 days · auto-archive off');
    expect(saysSimulated()).toBe(false);
    expect(applyRecords().at(-1)).toMatchObject({ level: 'info', message: 'Storage policy applied' });
  });

  it('answer first, delta later: the toast and the closing wait for the revision the answer named (CL-16)', async () => {
    const b = await openStorage();
    b.order = 'answer-first';
    await openSheet(b);
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(300);
    expect(b.requests('setStoragePolicy')[0]!.status).toBe(200);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    expect(isBusy('storage-manage-apply')).toBe(true);
    b.sendHeldDeltas();
    await b.flush();
    expect(b.state().storagePolicy.retentionPolicy).toBe('YEAR_1');
    expect(toastShown(APPLIED_LIVE)).toBe(true);
    await wallClock(600);
    expect(sheetOpen()).toBe(false);
  });

  it('the other half of the any-of rule: the TECHNICIAN (MAINTENANCE) applies as well', async () => {
    const b = await openStorage({ user: 'rina.wijaya' });
    await openSheet(b);
    expect(screen.queryByTestId('storage-manage-readonly')).toBeNull();
    fireEvent.press(screen.getByTestId('storage-manage-retention-CASE_CLOSURE'));
    await pressApply(b);
    await b.elapse(200);
    expect(b.requests('setStoragePolicy')[0]!.body).toEqual({ retentionPolicy: 'CASE_CLOSURE', autoArchive: true });
    expect(b.state().storagePolicy.retentionPolicy).toBe('CASE_CLOSURE');
    expect(toastShown(APPLIED_LIVE)).toBe(true);
  });

  it("refusal: 403 (the contract's example `notPermitted`) → the denied toast, no role of the wrong kind; the sheet stays open with the draft; Apply idle", async () => {
    const b = await openStorage();
    // The replica says the SUPERVISOR may (the hint, S5-3); the Core decides otherwise (a role changed on the server).
    b.fake.answerOnce('setStoragePolicy', b.fake.example('setStoragePolicy', 403, 'notPermitted'));
    await openSheet(b);
    draftOneYearNoArchive();
    const before = applyRecords().length;
    await pressApply(b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    // F64 / CONTRACT-GAP-5: the any-of permission's label names no role the presenter can find, so the
    // toast names none — and never a wrong one.
    expect(toastShown(/^Requires the /)).toBe(false);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    expect(toastShown(FAILED)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(true);
    draftKept();
    expect(isBusy('storage-manage-apply')).toBe(false);
    expect(b.state().storagePolicy.retentionPolicy).toBe('DAYS_90');
    // One record of level warn (a refusal the presenter showed), with the draft and no error text of the Core.
    const records = applyRecords().slice(before);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ level: 'warn', context: { retentionPolicy: 'YEAR_1', autoArchive: false } });
  });

  it("refusal in the Core's own spelling of the any-of permission (`EVIDENCE_REVIEW_OR_MAINTENANCE`, D88, F64) reads the same", async () => {
    const b = await openStorage();
    b.fake.answerOnce(
      'setStoragePolicy',
      refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
        operationId: 'setStoragePolicy',
        permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE',
        role: 'SUPERVISOR',
      }),
    );
    await openSheet(b);
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(200);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(/^Requires the /)).toBe(false);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(true);
    draftKept();
  });

  it("the Core's 422 (`invalidInput`, the Live source rebuilds it as POLICY_RANGE) keeps the screen's own failure toast; the sheet stays open", async () => {
    const b = await openStorage();
    b.fake.answerOnce('setStoragePolicy', b.fake.example('setStoragePolicy', 422, 'invalidInput'));
    await openSheet(b);
    draftOneYearNoArchive();
    const before = applyRecords().length;
    await pressApply(b);
    await b.elapse(200);
    expect(toastShown(FAILED)).toBe(true);
    expect(toastShown(DENIED)).toBe(false);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(true);
    draftKept();
    const records = applyRecords().slice(before);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ level: 'error', context: { retentionPolicy: 'YEAR_1', autoArchive: false } });
    expect(records[0]!.correlationId).toMatch(/\/storage-policy-/);
  });

  it('outage: "Core server unreachable. Nothing was changed."; the sheet stays open with the draft; a second press sends again and closes it', async () => {
    const b = await openStorage();
    b.fake.failOnce('setStoragePolicy');
    await openSheet(b);
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(200);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(true);
    draftKept();
    expect(isBusy('storage-manage-apply')).toBe(false);

    await pressApply(b);
    await b.elapse(200);
    expect(b.requests('setStoragePolicy')).toHaveLength(2);
    expect(toastShown(APPLIED_LIVE)).toBe(true);
    await wallClock(600);
    expect(sheetOpen()).toBe(false);
  });

  it('a dead link (CL-22): presses send nothing, the offline toast shows, the sheet stays open', async () => {
    const b = await openStorage();
    await openSheet(b);
    draftOneYearNoArchive();
    act(() => void b.connection().drop());
    await b.flush();
    await pressApply(b);
    await b.elapse(100);
    await pressApply(b);
    await b.elapse(100);
    expect(b.requests('setStoragePolicy')).toHaveLength(0);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    expect(sheetOpen()).toBe(true);
    draftKept();
  });

  it('a 429 is a limit, not an outage (LB-10): the limit toast with the seconds; the sheet keeps the draft', async () => {
    const b = await openStorage();
    b.fake.answerOnce('setStoragePolicy', rateLimited(12));
    await openSheet(b);
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(200);
    expect(toastShown(LIMIT)).toBe(true);
    expect(toastShown('Try again in 12 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(toastShown(APPLIED_LIVE)).toBe(false);
    await wallClock(600);
    expect(sheetOpen()).toBe(true);
    draftKept();
  });
});

describe('S5-3: the role gate is a hint; the Core enforces the any-of rule', () => {
  it('the INVESTIGATOR (neither EVIDENCE_REVIEW nor MAINTENANCE in the replica) sees the policy read-only; nothing is sent', async () => {
    const b = await openStorage({ user: 'budi.santoso' });
    await openSheet(b);
    expect(textOf('storage-manage-readonly')).toContain('Your role (Investigator) can view the storage policy');
    expect(applyState().accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('storage-manage-apply'));
    await b.elapse(200);
    expect(b.requests('setStoragePolicy')).toHaveLength(0);
  });
});

describe("the Storage screen on the Core's data", () => {
  const coreAtLow: LiveStorageBedOptions = {
    setup: (engine) => {
      // The Core's own state, not the seed's: a policy until case closure without auto-archive, a disk past LOW.
      engine.sim.actions.setStoragePolicy({ retentionPolicy: 'CASE_CLOSURE', autoArchive: false });
      engine.sim.actions.inject('STORAGE_LOW');
      engine.advance(200);
    },
  };

  it("shows the Core's policy, fill and activity, says nothing about a simulation, and calls no storage operation", async () => {
    const b = await openStorage({ ...coreAtLow, window: 'tabletLandscape' });
    const core = b.engine.sim.store.getState();
    expect(screen.getByTestId('storage-alert-LOW')).toBeTruthy();
    expect(String(screen.getByTestId('storage-ring').props.accessibilityLabel)).toMatch(/^Evidence storage \d+% used, LOW$/);
    expect(textOf('storage-kpi-retention-value')).toBe(`${core.storagePolicy.retentionDays} days`);
    expect(textOf('storage-kpi-retention-caption')).toBe('Until case closure');
    expect(rowLabels()[0]).toContain('Fault raised');
    expect(rowLabels().some((row) => row.includes('Storage policy changed'))).toBe(true);
    await openSheet(b);
    expect(textOf('storage-manage-current')).toBe('Current: Until case closure · auto-archive off');
    expect(saysSimulated()).toBe(false);
    // The replicated slices are the screen's only source: no read of operation 54, no write.
    expect(b.requests('getStorageDetail')).toHaveLength(0);
    expect(b.requests('setStoragePolicy')).toHaveLength(0);
  });

  it('follows the Core by delta: a disk that fills (one LOW toast) and a policy another client changed', async () => {
    const b = await openStorage();
    expect(screen.queryByTestId('storage-alert-LOW')).toBeNull();
    await b.runCore(200, (engine) => engine.sim.actions.inject('STORAGE_LOW'));
    expect(screen.getByTestId('storage-alert-LOW')).toBeTruthy();
    expect(toastShown('Evidence storage is low')).toBe(true);
    await b.runCore(100, (engine) => engine.sim.actions.setStoragePolicy({ retentionPolicy: 'DAYS_30' }));
    expect(b.state().storagePolicy.retentionPolicy).toBe('DAYS_30');
    expect(rowLabels()[0]).toContain('Storage policy changed · 30 days');
    expect(saysSimulated()).toBe(false);
  });

  it("a lost link keeps the Core's last data on the screen", async () => {
    const b = await openStorage();
    const ring = String(screen.getByTestId('storage-ring').props.accessibilityLabel);
    const rows = rowLabels();
    act(() => void b.connection().drop());
    await b.elapse(2_000, 250);
    expect(String(screen.getByTestId('storage-ring').props.accessibilityLabel)).toBe(ring);
    expect(rowLabels()).toEqual(rows);
  });
});

describe('React StrictMode (decision D158, finding F69-1): no Core command or query starts on mount', () => {
  /** Every operation Storage or Network & Time could send: the policy write and the four reads of the two areas. */
  const OPERATIONS = ['setStoragePolicy', 'getStorageDetail', 'getStorageStatus', 'getNetworkStatus', 'getTimeStatus'] as const;
  const sent = (b: LiveStorageBed) => b.operations().filter((operationId) => (OPERATIONS as readonly string[]).includes(operationId));

  it('Storage, its sheet, Network & Time and its LAN sheet mount (effects twice) and send nothing; one Apply then sends exactly ONE request', async () => {
    const b = await renderLiveStorage({ strict: true });
    bed = b;
    await b.open('/storage');
    expect(screen.getByTestId('screen-storage')).toBeTruthy();
    await openSheet(b);
    fireEvent.press(screen.getByTestId('storage-manage-close'));
    await wallClock(600);
    await b.open('/network-time');
    expect(screen.getByTestId('screen-network-time')).toBeTruthy();
    fireEvent.press(screen.getByTestId('network-time-lan'));
    await b.flush();
    await wallClock(50);
    await b.elapse(1_000, 250);
    expect(sent(b)).toEqual([]);

    await b.open('/storage');
    await openSheet(b);
    draftOneYearNoArchive();
    await pressApply(b);
    await b.elapse(200);
    expect(sent(b)).toEqual(['setStoragePolicy']);
    expect(toastShown(APPLIED_LIVE)).toBe(true);
  });
});

describe('SIMULATED mode is as before (the same call site; the simulator settles at once)', () => {
  it('Apply writes the store before the press returns, toasts "(simulated)", closes the sheet, and nothing is ever marked busy', async () => {
    const { test, app } = renderSimulatedStorage({ user: 'rina.wijaya' });
    await wallClock(50);
    fireEvent.press(screen.getByTestId('storage-manage'));
    await wallClock(50);
    draftOneYearNoArchive();
    fireEvent.press(screen.getByTestId('storage-manage-apply'));
    // Synchronous: the store and its audit row are there right after the press.
    expect(test.sim.store.getState().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: false });
    expect(test.sim.store.getState().audit.rows.at(-1)?.type).toBe('STORAGE_POLICY_CHANGED');
    expect(screen.getByTestId('storage-manage-apply').props.accessibilityState?.busy).toBeUndefined();
    expect(screen.queryByTestId('storage-manage-apply-spinner')).toBeNull();
    expect(toastShown(APPLIED_SIMULATED)).toBe(true);
    await wallClock(600);
    expect(sheetOpen()).toBe(false);
    app.unmount();
  });
});
