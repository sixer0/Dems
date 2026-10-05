// Backend task, plan row W74: integrity verification in LIVE mode — the server's verdict is the
// record (04_client_integration_spec §14 point 7, §8.5 "verify", §8.1 LB-2; 01_specs MS-2; AC-C-61),
// on the app's real Live source over the contract-checked fake transport.
//
// AC-C-61: verification calls operation 41 and no demo operation; the verdict shown is the server's.
// The bundled demo package's check is shown beside it only for a DEMO_PACKAGE item (operation 40),
// labelled, writing nothing; when it differs, an info Alert says the Core's verdict is the record.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { CORE_API_OPERATIONS, CoreApiTag } from '@dems/shared/api';
import { OUTAGE } from '@dems/shared/live/testing';
import { verifyEvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { evidenceEn } from './i18n';
import { VERIFY_ASK_MS } from './integrity-tab';
import { pressMenuItem } from './testing/kit-helpers';
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
  // MA-21: every string the Live tab renders comes from an i18n key.
  expect(getMissingKeys()).toEqual([]);
});

const OFFLINE = 'Core server unreachable';
const DEMO_OPERATIONS = new Set(CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.DEMO).map((operation) => operation.operationId));
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const passToast = (id: string) => evidenceEn.integrity.passToast.replace('{{id}}', id);
const failToast = (id: string) => evidenceEn.integrity.failToast.replace('{{id}}', id);

async function openIntegrity(suffix: string, options: LiveEvidenceBedOptions = {}, configure?: (b: LiveEvidenceBed) => void): Promise<{ b: LiveEvidenceBed; id: string }> {
  const b = await renderLiveEvidence(options);
  bed = b;
  configure?.(b);
  const id = b.idOf(suffix);
  await b.navigate(`/evidence/${id}`);
  expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
  await b.flush();
  return { b, id };
}

/** Presses Verify and runs the ask and the scramble to the end. */
async function verifyToEnd(b: LiveEvidenceBed): Promise<void> {
  fireEvent.press(screen.getByTestId('evidence-verify'));
  await b.flush();
  await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
}

describe('AC-C-61: operation 41, no demo operation; the verdict shown is the Core\'s', () => {
  it('PASS (EV 0001): one verifyEvidence and nothing else; "Asking the Core" for at least VERIFY_ASK_MS; the Core\'s hashes, chip, toast and custody entry', async () => {
    const { b, id } = await openIntegrity('0001');
    expect(screen.getByTestId('evidence-integrity-label')).toHaveTextContent(evidenceEn.integrity.coreLabel);
    expect(screen.getByTestId('evidence-verdict-pending')).toBeTruthy();
    expect(screen.getByText(evidenceEn.integrity.coreNote)).toBeTruthy();
    b.fake.log.clear();

    fireEvent.press(screen.getByTestId('evidence-verify'));
    await b.flush();
    expect(within(screen.getByTestId('evidence-verify')).getByText(evidenceEn.integrity.verifying)).toBeTruthy();
    await b.elapse(VERIFY_ASK_MS - 150);
    // The Core has answered, and the paced "asking" state still shows (LB-2): no verdict, no hash of it yet.
    expect(b.requests('verifyEvidence')).toHaveLength(1);
    expect(screen.queryByTestId('evidence-verdict-PASS')).toBeNull();
    expect(screen.getByTestId('evidence-track-VIDEO-01-stored')).toHaveTextContent('—');
    await b.elapse(SCRAMBLE_MS + 450);
    expect(screen.getByTestId('evidence-verdict-PASS')).toBeTruthy();

    // The log of the fake: operation 41, once, and no demo operation at all.
    const operations = b.fake.log.operationIds();
    expect(operations.filter((operation) => operation === 'verifyEvidence')).toHaveLength(1);
    expect(operations.filter((operation) => DEMO_OPERATIONS.has(operation))).toEqual([]);

    // What is shown is the Core's answer, hash for hash.
    const verdict = b.engine.sim.store.getState().evidence.find((item) => item.id === id)!;
    for (const track of verdict.tracks) {
      expect(screen.getByTestId(`evidence-track-${track.trackId}-ok`)).toBeTruthy();
      expect(screen.getByTestId(`evidence-track-${track.trackId}-stored`)).toHaveTextContent(track.sha256);
    }
    expect(screen.getByTestId('evidence-check-manifest-ok')).toBeTruthy();
    expect(screen.getByTestId('evidence-check-signature-ok')).toBeTruthy();
    expect(toastShown(passToast(id))).toBe(true);
    // The custody entry is the Core's (replicated before the action settled, CL-16).
    expect(b.state().evidence.find((item) => item.id === id)?.custody.at(-1)?.action).toBe('VERIFIED');
    expect(within(screen.getByTestId('evidence-custody-0')).getByText(evidenceEn.custodyAction.VERIFIED)).toBeTruthy();
    // The bundled package (DEMO_PACKAGE 0001) agrees: shown, labelled, no Alert.
    expect(screen.getByTestId('evidence-bundled-PASS')).toBeTruthy();
    expect(screen.queryByTestId('evidence-bundled-differs')).toBeNull();
  });

  it('FAIL (EV 0005, AUDIO-02): the Core\'s verdict names the track; the bundled package agrees', async () => {
    const { b, id } = await openIntegrity('0005');
    await verifyToEnd(b);
    expect(screen.getByTestId('evidence-verdict-FAIL')).toHaveTextContent(/AUDIO-02/);
    expect(screen.getByTestId('evidence-track-AUDIO-02-fail')).toBeTruthy();
    for (const track of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01']) expect(screen.getByTestId(`evidence-track-${track}-ok`)).toBeTruthy();
    // The stored hash shown is the one the Core computed, not the sealed one.
    const item = b.engine.sim.store.getState().evidence.find((entry) => entry.id === id)!;
    const computed = verifyEvidenceItem(item, b.engine.sim.clock.now()).tracks.find((track) => track.trackId === 'AUDIO-02')!;
    expect(computed.actual).not.toBe(computed.expected);
    expect(screen.getByTestId('evidence-track-AUDIO-02-stored')).toHaveTextContent(computed.actual);
    expect(toastShown(failToast(id))).toBe(true);
    expect(b.state().evidence.find((item) => item.id === id)?.custody.at(-1)?.action).toBe('VERIFY_FAILED');
    expect(screen.getByTestId('evidence-bundled-FAIL')).toBeTruthy();
    expect(screen.queryByTestId('evidence-bundled-differs')).toBeNull();
  });

  it('the Core and the bundled package differ (a tamper the Core recorded on VIDEO-01): the Core\'s FAIL is shown, and the info Alert says so', async () => {
    const { b, id } = await openIntegrity('0001', {
      setup: (engine) => engine.sim.actions.inject('TAMPER', { evidenceId: engine.sim.store.getState().evidence.find((item) => item.id.endsWith('-0001'))!.id, trackId: 'VIDEO-01' }),
    });
    await verifyToEnd(b);
    expect(screen.getByTestId('evidence-verdict-FAIL')).toHaveTextContent(/VIDEO-01/);
    expect(screen.getByTestId('evidence-track-VIDEO-01-fail')).toBeTruthy();
    expect(screen.getByTestId('evidence-bundled-PASS')).toBeTruthy();
    expect(screen.getByTestId('evidence-bundled-differs')).toBeTruthy();
    expect(screen.getByText(evidenceEn.integrity.bundledDiffers)).toBeTruthy();
    expect(toastShown(failToast(id))).toBe(true);
  });

  it('a session recorded in Live mode (media NONE): no bundled check and no bundled media, the Core\'s verdict all the same', async () => {
    const { b } = await openIntegrity('0002', {}, (configured) => {
      configured.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    });
    expect(b.requests('getEvidence')).toHaveLength(1);
    await verifyToEnd(b);
    expect(screen.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(screen.queryByTestId('evidence-bundled-PASS')).toBeNull();
    expect(screen.queryByTestId('evidence-bundled-FAIL')).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-tab-media'));
    await b.flush();
    expect(screen.getByTestId('evidence-media-none')).toBeTruthy();
  });

  it('operation 40 gets no answer: the Media tab says the reference is unavailable; the Core\'s verdict still works', async () => {
    const { b } = await openIntegrity('0003', {}, (configured) => configured.fake.answerOnce('getEvidence', OUTAGE));
    await verifyToEnd(b);
    expect(screen.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(screen.queryByTestId('evidence-bundled-PASS')).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-tab-media'));
    await b.flush();
    expect(screen.getByTestId('evidence-media-unavailable')).toBeTruthy();
  });
});

describe('No verdict: the presenter first, then the tab\'s own message (LB-5, LB-6)', () => {
  it('outage: the "Core server unreachable" toast; the button returns to Verify; nothing is shown as a verdict', async () => {
    const { b } = await openIntegrity('0001');
    b.fake.failOnce('verifyEvidence');
    await verifyToEnd(b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(screen.getByTestId('evidence-verdict-pending')).toBeTruthy();
    expect(within(screen.getByTestId('evidence-verify')).getByText(evidenceEn.integrity.verify)).toBeTruthy();
    expect(screen.queryByTestId('evidence-verdict-PASS')).toBeNull();
  });

  it('a 404 the presenter does not word (example notFound): the tab\'s own "could not verify" toast; a later Verify gets the verdict', async () => {
    const { b } = await openIntegrity('0001');
    b.fake.answerOnceFromExample('verifyEvidence', 404, 'notFound');
    await verifyToEnd(b);
    expect(toastShown(evidenceEn.integrity.verifyError)).toBe(true);
    expect(screen.getByTestId('evidence-verdict-pending')).toBeTruthy();
    await verifyToEnd(b);
    expect(screen.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(b.requests('verifyEvidence')).toHaveLength(2);
  });
});

describe('The list kebab "Verify" on a tablet', () => {
  it('opens the detail pane on Hash & Integrity and sends operation 41 once', async () => {
    const b = await renderLiveEvidence({ window: 'tabletLandscape' });
    bed = b;
    const id = b.idOf('0002');
    pressMenuItem(`evidence-row-menu-${id}`, `evidence-row-verify-${id}`);
    await b.flush();
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    expect(pane.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(b.requests('verifyEvidence')).toHaveLength(1);
  });
});
