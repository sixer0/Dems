// Backend task, plan row W74: the export wizard in LIVE mode — sites S1-5 (the denied role's probe),
// S5-1 (the display hint), S1-6 (the export), and the "Verify source" step on the Core's verdict —
// each with its success, its refusal and an outage, on the app's real Live source over the
// contract-checked fake transport (04_client_integration_spec §8.5 S1-5, S1-6, §8.7 S5-1, §8.1 LB-2,
// LB-6, §6.2 "Web, export wizard"; §14 point 7; F59; AC-C-48).
//
// The refusal of operation 42 is a result union (CL-19: any 403 → FORBIDDEN), so the wizard shows it
// in place, as §6.2 has it for the export wizard: the denied Alert at Authorize, the refusal's Alert
// at Build. An outage is the presenter's toast (LB-6).
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { EvidenceStatus } from '@dems/shared/sim';
import { runtimeLog } from '@/runtime';
import { EXPORT_AUTH_MS, EXPORT_BUILD_MS } from './export-sheet';
import { evidenceEn } from './i18n';
import { VERIFY_ASK_MS } from './integrity-tab';
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

const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const REASON = 'Prosecutor request for case review';
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

async function openExport(suffix: string, options: LiveEvidenceBedOptions = {}): Promise<{ b: LiveEvidenceBed; id: string }> {
  const b = await renderLiveEvidence(options);
  bed = b;
  const id = b.idOf(suffix);
  await b.navigate(`/evidence/${id}`);
  expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  fireEvent.press(screen.getByTestId('evidence-action-export'));
  await b.flush();
  return { b, id };
}

/** SUPERVISOR: Authorize, then the Core's verdict of the source. */
async function throughSource(b: LiveEvidenceBed): Promise<void> {
  await b.elapse(EXPORT_AUTH_MS + 100);
  expect(screen.getByTestId('evidence-export-authorized')).toBeTruthy();
  fireEvent.press(screen.getByTestId('evidence-export-next'));
  await b.flush();
}

/** From a passed source to the Reason step, the reason typed. */
async function toReason(b: LiveEvidenceBed): Promise<void> {
  fireEvent.press(screen.getByTestId('evidence-export-next'));
  await b.flush();
  fireEvent.press(screen.getByTestId('evidence-export-destination-network'));
  fireEvent.press(screen.getByTestId('evidence-export-next'));
  await b.flush();
  fireEvent.changeText(screen.getByTestId('evidence-export-reason'), REASON);
  await b.flush();
}

describe('S5-1 and S1-5: Authorize — the hint decides the display; a denied role still calls the Core', () => {
  it('INVESTIGATOR: after EXPORT_AUTH_MS one call with an empty reason; the Core\'s 403 (forbidden) → the denied Alert, audited by the Core', async () => {
    const { b, id } = await openExport('0001', { role: 'investigator' });
    expect(screen.getByTestId('evidence-export-authorizing')).toBeTruthy();
    expect(b.requests('exportEvidence')).toHaveLength(0);
    await b.elapse(EXPORT_AUTH_MS + 100);
    expect(b.requests('exportEvidence')).toHaveLength(1);
    expect(b.requests('exportEvidence')[0]!.body).toEqual({ reason: '', destination: '' });
    expect(screen.getByTestId('evidence-export-denied')).toBeTruthy();
    expect(screen.getByText(evidenceEn.export.deniedBody)).toBeTruthy();
    // The Core audited the denial; the item is unchanged.
    expect(b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'EXPORT_DENIED' && row.evidenceId === id)).toHaveLength(1);
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.SEALED);
    expect(runtimeLog.records().some((record) => record.source === 'evidence.export.denied' && record.context?.status === 403)).toBe(true);
    expect(screen.queryByTestId('evidence-export-next')).toBeNull();
  });

  it('INVESTIGATOR, outage: the presenter\'s toast, and the denied Alert says the Core did not record the attempt', async () => {
    const { b } = await openExport('0002', { role: 'investigator' });
    b.fake.failOnce('exportEvidence');
    await b.elapse(EXPORT_AUTH_MS + 300);
    expect(b.requests('exportEvidence')).toHaveLength(1);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(screen.getByTestId('evidence-export-denied')).toBeTruthy();
    expect(screen.getByText(evidenceEn.export.deniedBodyUnrecorded)).toBeTruthy();
  });

  it('a hint behind the Core (the Core answers the empty reason 422, F59): still the denied Alert, saying the Core did not record a denial; nothing exported', async () => {
    const { b, id } = await openExport('0002', { role: 'investigator' });
    b.fake.answerOnceFromExample('exportEvidence', 422, 'invalidReason');
    await b.elapse(EXPORT_AUTH_MS + 300);
    expect(b.requests('exportEvidence')).toHaveLength(1);
    expect(screen.getByTestId('evidence-export-denied')).toBeTruthy();
    expect(screen.getByText(evidenceEn.export.deniedBodyUnrecorded)).toBeTruthy();
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.SEALED);
    expect(runtimeLog.records().some((record) => record.source === 'evidence.export.denied' && record.context?.status === 422)).toBe(true);
  });

  it('SUPERVISOR (S5-1): the hint authorizes after EXPORT_AUTH_MS on the store\'s clock and no probe is sent', async () => {
    const { b } = await openExport('0001', { role: 'supervisor' });
    await b.elapse(EXPORT_AUTH_MS - 200);
    expect(screen.getByTestId('evidence-export-authorizing')).toBeTruthy();
    await b.elapse(300);
    expect(screen.getByTestId('evidence-export-authorized')).toBeTruthy();
    expect(b.requests('exportEvidence')).toHaveLength(0);
  });
});

describe('Verify source on the Core\'s verdict (§14 point 7)', () => {
  it('operation 41 is asked once; PASS lets the export go on', async () => {
    const { b } = await openExport('0001');
    await throughSource(b);
    expect(screen.getByTestId('evidence-export-source-asking')).toBeTruthy();
    expect(b.requests('verifyEvidence')).toHaveLength(1);
    await b.elapse(VERIFY_ASK_MS + 100);
    expect(screen.getByTestId('evidence-export-source-pass')).toBeTruthy();
    expect(isDisabled('evidence-export-next')).toBe(false);
  });

  it('the Core\'s FAIL (EV 0005, AUDIO-02) blocks the export', async () => {
    const { b } = await openExport('0005');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    expect(screen.getByTestId('evidence-export-source-fail')).toHaveTextContent(/AUDIO-02/);
    expect(isDisabled('evidence-export-next')).toBe(true);
    expect(b.requests('exportEvidence')).toHaveLength(0);
  });

  it('outage: the presenter\'s toast, no verdict, "Verify again" asks once more', async () => {
    const { b } = await openExport('0001');
    b.fake.failOnce('verifyEvidence');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(screen.getByTestId('evidence-export-source-none')).toBeTruthy();
    expect(isDisabled('evidence-export-next')).toBe(true);
    fireEvent.press(screen.getByTestId('evidence-export-verify-again'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + 100);
    expect(b.requests('verifyEvidence')).toHaveLength(2);
    expect(screen.getByTestId('evidence-export-source-pass')).toBeTruthy();
  });
});

describe('S1-6: the export — the request starts with the build step; the result at the later of the answer and EXPORT_BUILD_MS (LB-2)', () => {
  it('success: one request at the press; "Building" until EXPORT_BUILD_MS though the Core answered; then Done with the Core\'s export ID', async () => {
    const { b, id } = await openExport('0001');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    await toReason(b);
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    expect(b.requests('exportEvidence')).toHaveLength(1);
    expect(b.requests('exportEvidence')[0]!.body).toMatchObject({ reason: REASON });
    expect(screen.getByTestId('evidence-export-building')).toBeTruthy();
    await b.elapse(300);
    // The Core has answered by now (the replica says EXPORTED), and the step still shows its pipeline.
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.EXPORTED);
    expect(screen.getByTestId('evidence-export-building')).toBeTruthy();
    await b.elapse(EXPORT_BUILD_MS);
    expect(screen.getByTestId('evidence-export-done')).toBeTruthy();
    const exportRow = b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'EVIDENCE_EXPORTED' && row.evidenceId === id).at(-1);
    expect(exportRow).toBeTruthy();
    expect(screen.getByTestId('evidence-export-id')).toHaveTextContent(/EXP-\d+/);
    expect(screen.getByText(evidenceEn.export.zipNoteLive)).toBeTruthy();
    // The Live success sentence names the Core, never a simulation (rule 8).
    expect(toastShown(evidenceEn.export.successLive.replace('{{id}}', id))).toBe(true);
    // The one text that says "simulated" is the destination the operator chose, the shared label the
    // Core records as given (no transfer happens in either mode; finding F-4 of the row's report).
    const simulatedTexts = screen.queryAllByText(/simulated/i).map((node) => String(node.props.children));
    expect(simulatedTexts).toEqual(['Export/Transfer network (simulated)']);
    expect(b.requests('exportEvidence')[0]!.body).toMatchObject({ destination: 'Export/Transfer network (simulated)' });
  });

  it('refusal: 403 (example forbidden) at the press → the refusal\'s Alert at Build (the union, §6.2); nothing exported', async () => {
    const { b, id } = await openExport('0002');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    await toReason(b);
    b.fake.answerOnceFromExample('exportEvidence', 403, 'forbidden');
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 100);
    expect(screen.getByTestId('evidence-export-failed-FORBIDDEN')).toBeTruthy();
    expect(screen.getByText(evidenceEn.export.failed.FORBIDDEN)).toBeTruthy();
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.SEALED);
  });

  it('the Core\'s 422 INVALID_REASON (F59: the Core is the judge) → back to Reason, the reason kept, the inline error shown', async () => {
    const { b } = await openExport('0003');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    await toReason(b);
    b.fake.answerOnceFromExample('exportEvidence', 422, 'invalidReason');
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 100);
    expect(screen.getByTestId('evidence-export-reason').props.value).toBe(REASON);
    expect(screen.getByTestId('evidence-export-reason-error')).toBeTruthy();
  });

  it('outage (LB-6): the presenter\'s toast after the build step; back to Reason with what was typed; Export can be pressed again', async () => {
    const { b, id } = await openExport('0001');
    await throughSource(b);
    await b.elapse(VERIFY_ASK_MS + 100);
    await toReason(b);
    b.fake.failOnce('exportEvidence');
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 100);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(screen.getByTestId('evidence-export-reason').props.value).toBe(REASON);
    expect(isDisabled('evidence-export-submit')).toBe(false);
    expect(screen.queryByTestId('evidence-export-done')).toBeNull();
    expect(b.state().evidence.find((item) => item.id === id)?.status).toBe(EvidenceStatus.SEALED);
  });
});
