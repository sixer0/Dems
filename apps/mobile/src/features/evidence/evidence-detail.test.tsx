/**
 * Evidence detail (04_mobile_specs §4.11; step 83): Hash & Integrity shows PASS for a pristine item
 * and FAIL on AUDIO-02 for the tampered one (the package's precomputed result, "verified by the
 * Core", D51); the simulator records only verifications that agree with the package
 * (SIM-GAP-M83-1); Metadata shows the byte-exact manifest; the export wizard follows the Core's
 * RBAC, source check and reason rule; the list's kebab "Verify" opens the integrity tab and runs.
 * Real route files, real simulator, real providers; real timers (Reanimated in Jest, S72-12).
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { getDemoEvidenceDocuments } from '@dems/shared/demo-data';
import { EvidenceStatus } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { runtimeLog } from '@/runtime';
import { EXPORT_AUTH_MS, EXPORT_BUILD_MS } from './export-sheet';
import { VERIFY_ASK_MS } from './integrity-tab';
import { renderEvidenceApp, settle, type EvidenceHarness } from './testing/evidence-harness';
import { pressMenuItem } from './testing/kit-helpers';
import { SCRAMBLE_MS } from './use-scramble';

beforeEach(() => resetMissingKeys());
// MA-21: every string the Evidence detail renders comes from an i18n key.
afterEach(() => expect(getMissingKeys()).toEqual([]));

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function openDetail(h: EvidenceHarness, suffix: string): Promise<string> {
  const id = h.idOf(suffix);
  h.navigate(`/evidence/${id}`);
  await settle();
  expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  return id;
}

/** The ask + scramble pass takes VERIFY_ASK_MS + SCRAMBLE_MS; a loaded host gets extra time. */
const VERIFY_TIMEOUT = { timeout: (VERIFY_ASK_MS + SCRAMBLE_MS) * 8 };

async function verify(expected: 'PASS' | 'FAIL') {
  fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
  await settle();
  expect(screen.getByTestId('evidence-integrity-label', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId('evidence-verdict-pending')).toBeTruthy();
  fireEvent.press(screen.getByTestId('evidence-verify'));
  await waitFor(() => expect(screen.getByTestId(`evidence-verdict-${expected}`)).toBeTruthy(), VERIFY_TIMEOUT);
}

function auditRowsFor(h: EvidenceHarness, id: string, type: string) {
  return h.sim.store.getState().audit.rows.filter((row) => row.type === type && row.evidenceId === id);
}

describe('Evidence detail: Hash & Integrity', () => {
  it('shows PASS for a pristine item (EV 0001) and the Core records the verification', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const id = await openDetail(h, '0001');
    await verify('PASS');
    for (const track of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']) {
      expect(screen.getByTestId(`evidence-track-${track}-ok`)).toBeTruthy();
    }
    expect(screen.getByTestId('evidence-check-manifest-ok')).toBeTruthy();
    expect(screen.getByTestId('evidence-check-signature-ok')).toBeTruthy();
    expect(auditRowsFor(h, id, 'EVIDENCE_VERIFIED')).toHaveLength(1);
    const item = h.sim.store.getState().evidence.find((entry) => entry.id === id)!;
    expect(item.verification.status).toBe('PASS');
    expect(item.custody.at(-1)?.action).toBe('VERIFIED');
  });

  it('shows FAIL on AUDIO-02 for the tampered item (EV 0005) and the Core records the same failure (no contradicting row)', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const id = await openDetail(h, '0005');
    await verify('FAIL');
    expect(screen.getByTestId('evidence-verdict-FAIL')).toHaveTextContent(/AUDIO-02/);
    expect(screen.getByTestId('evidence-track-AUDIO-02-fail')).toBeTruthy();
    for (const track of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01']) {
      expect(screen.getByTestId(`evidence-track-${track}-ok`)).toBeTruthy();
    }
    // SIM-GAP-M83-1 closed by step 54 (D115): the simulator's 0005 is tampered on AUDIO-02 at load,
    // so its verdict agrees with the DEMO package and the guard records it unchanged: one
    // EVIDENCE_VERIFY_FAILED row naming AUDIO-02, never an EVIDENCE_VERIFIED row, no gap logged.
    expect(auditRowsFor(h, id, 'EVIDENCE_VERIFIED')).toHaveLength(0);
    const failed = auditRowsFor(h, id, 'EVIDENCE_VERIFY_FAILED');
    expect(failed).toHaveLength(1);
    expect(failed[0]!.details).toMatchObject({ failedTracks: 'AUDIO-02' });
    const item = h.sim.store.getState().evidence.find((entry) => entry.id === id)!;
    expect(item.verification.status).toBe('FAIL');
    expect(item.custody.at(-1)?.action).toBe('VERIFY_FAILED');
    expect(runtimeLog.records().some((record) => record.source === 'evidence.verify.simGap' && record.context?.evidenceId === id)).toBe(false);
  });

  it('the list kebab "Verify" opens the tablet detail pane on Hash & Integrity and runs it', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0002');
    pressMenuItem(`evidence-row-menu-${id}`, `evidence-row-verify-${id}`);
    await settle();
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    await waitFor(() => expect(pane.getByTestId('evidence-verdict-PASS')).toBeTruthy(), VERIFY_TIMEOUT);
  });
});

describe('Evidence detail: Metadata', () => {
  it('lists the 13 §11.3 fields and shows the byte-exact manifest.json', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const id = await openDetail(h, '0004');
    fireEvent.press(screen.getByTestId('evidence-tab-metadata'));
    await settle();
    // Byte-exact: the rendered text is the manifest file's text (hashing it gives the signed digest).
    expect(screen.getByTestId('evidence-manifest-json').props.children).toBe(getDemoEvidenceDocuments(id)!.manifestJson);
    expect(screen.getByTestId('evidence-manifest-caseReference')).toBeTruthy();
    expect(screen.getByTestId('evidence-manifest-finalizationStatus')).toBeTruthy();
    // EV 0004 is the exported item: its §19.2 export entry follows.
    expect(screen.getByTestId('evidence-metadata-export')).toBeTruthy();
  });
});

describe('Evidence detail: Export wizard', () => {
  it('an INVESTIGATOR is refused by the Core; the attempt is audited (S20, EVT-26)', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait', user: 'budi.santoso' });
    await settle();
    const id = await openDetail(h, '0001');
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await settle();
    expect(screen.getByTestId('evidence-export-authorizing')).toBeTruthy();
    await wait(EXPORT_AUTH_MS + 150);
    expect(screen.getByTestId('evidence-export-denied')).toBeTruthy();
    expect(auditRowsFor(h, id, 'EXPORT_DENIED')).toHaveLength(1);
    expect(h.sim.store.getState().evidence.find((entry) => entry.id === id)!.status).toBe(EvidenceStatus.SEALED);
  });

  it('a SUPERVISOR exports with a destination and a mandatory reason; status becomes EXPORTED', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait', user: 'andi.pratama' });
    await settle();
    const id = await openDetail(h, '0001');
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await settle();
    await wait(EXPORT_AUTH_MS + 150);
    expect(screen.getByTestId('evidence-export-authorized')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await settle();
    expect(screen.getByTestId('evidence-export-source-pass')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await settle();
    fireEvent.press(screen.getByTestId('evidence-export-destination-network'));
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await settle();
    // Too short: inline error, Export disabled.
    fireEvent.changeText(screen.getByTestId('evidence-export-reason'), '  abc ');
    fireEvent(screen.getByTestId('evidence-export-reason'), 'blur');
    await settle();
    expect(screen.getByTestId('evidence-export-reason-error')).toBeTruthy();
    expect(screen.getByTestId('evidence-export-submit').props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('evidence-export-reason'), 'Prosecutor request for case review');
    await settle();
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await settle();
    expect(screen.getByTestId('evidence-export-building')).toBeTruthy();
    await wait(EXPORT_BUILD_MS + 200);
    expect(screen.getByTestId('evidence-export-done')).toBeTruthy();
    expect(screen.getByTestId('evidence-export-id')).toHaveTextContent(/EXP-\d+/);
    const item = h.sim.store.getState().evidence.find((entry) => entry.id === id)!;
    expect(item.status).toBe(EvidenceStatus.EXPORTED);
    const row = auditRowsFor(h, id, 'EVIDENCE_EXPORTED').at(-1)!;
    expect(row.details).toMatchObject({ reason: 'Prosecutor request for case review', destination: 'Export/Transfer network (simulated)' });
  });

  it('the tampered source (EV 0005) blocks the export at "Verify source" (§19.3 rule 3)', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait', user: 'andi.pratama' });
    await settle();
    const id = await openDetail(h, '0005');
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await settle();
    await wait(EXPORT_AUTH_MS + 150);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await settle();
    expect(screen.getByTestId('evidence-export-source-fail')).toHaveTextContent(/AUDIO-02/);
    expect(screen.getByTestId('evidence-export-next').props.accessibilityState?.disabled).toBe(true);
    expect(auditRowsFor(h, id, 'EVIDENCE_EXPORTED')).toHaveLength(0);
  });
});
