/**
 * Evidence detail (04_mobile_specs §4.11; step 83): Hash & Integrity shows PASS for a pristine item
 * and FAIL on AUDIO-02 for the tampered one (the package's precomputed result, "verified by the
 * Core", D51); the simulator records only verifications that agree with the package
 * (SIM-GAP-M83-1); Metadata shows the byte-exact manifest; the export wizard follows the Core's
 * RBAC, source check and reason rule; the list's kebab "Verify" opens the integrity tab and runs.
 * Real route files, real simulator, real providers; real timers (Reanimated in Jest, S72-12).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { getDemoEvidenceDocuments } from '@dems/shared/demo-data';
import { EvidenceStatus, EVIDENCE_ITEM_KIND_VECTORS, type EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { runtimeLog } from '@/runtime';
import { EXPORT_AUTH_MS, EXPORT_BUILD_MS } from './export-sheet';
import { VERIFY_ASK_MS } from './integrity-tab';
import { renderEvidenceApp, settle, type EvidenceHarness } from './testing/evidence-harness';
import { pressMenuItem } from './testing/kit-helpers';
import { SCRAMBLE_MS } from './use-scramble';
import * as ExpoVideo from 'expo-video';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';
import { bedWith, openItem, realItem, textUnder, type ItemChange, CORE_KEY, contractDetail, seedSealedDemo, allText, contractDetailNames, type ContractItemName } from './testing/real-item-kit';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { Image } from 'expo-image';
import { hasSealedPackageHere, isDemoItem, mediaKindOf, readDetailFacts, readItemFacts, MEMBER, NO_DETAIL_FACTS, readSealedProfiles } from './item-facts';
import { EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } from '@dems/shared/api';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('evidence detail', () => {
unmountBeforeTheHooksOfThisGroup();

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

// Fix wave M (re-check 89 finding G89d-03): in the tablet's pane the tab strip lay below the first screen, behind the
// fixed Play / Export / More bar - a tap meant for "Hash & Integrity" opened the Export sheet. THE LAYOUT RULE: in
// the pane the strip is pinned outside the scroll view (above it), so it can never share a point with the bar and
// every tab is tappable at the first scroll position; the bar stays the last child. The phone keeps the strip in
// its scrolled content.
describe('Evidence detail: the tab strip and the action bar never overlap (G89d-03)', () => {
  type Node = { readonly parent: Node | null; readonly props: { readonly testID?: string } };
  const inside = (node: Node | null, testID: string): boolean => (node === null ? false : node.props.testID === testID ? true : inside(node.parent, testID));

  it('tablet pane: the strip is pinned outside the scroll view and outside the action bar; each tab opens by a press without scrolling', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    fireEvent.press(screen.getByTestId(`evidence-row-${h.idOf('0002')}`));
    await settle();
    const pinned = screen.getByTestId('evidence-detail-tabs-pinned');
    for (const key of ['media', 'metadata', 'integrity']) {
      const tab = screen.getByTestId(`evidence-tab-${key}`) as unknown as Node;
      expect(inside(tab, 'evidence-detail-tabs-pinned')).toBe(true);
      expect(inside(tab, 'evidence-detail-scroll')).toBe(false);
      expect(inside(tab, 'evidence-detail-actions')).toBe(false);
    }
    // Order inside the pane: header, the pinned strip, the scroll view, the action bar.
    const root = screen.getByTestId('evidence-detail-pane') as unknown as { readonly children: readonly unknown[] };
    const order = root.children.map((child) => (child as Node).props?.testID).filter((id) => id === 'evidence-detail-tabs-pinned' || id === 'evidence-detail-scroll' || id === 'evidence-detail-actions');
    expect(order).toEqual(['evidence-detail-tabs-pinned', 'evidence-detail-scroll', 'evidence-detail-actions']);
    expect(pinned).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
    await settle();
    expect(screen.getByTestId('evidence-verdict-pending')).toBeTruthy();
    expect(screen.queryByTestId('export-sheet')).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-tab-metadata'));
    await settle();
    expect(screen.queryByTestId('evidence-verdict-pending')).toBeNull();
  });

  it('CONTROL - phone: the strip stays in the scrolled content (no pinned strip)', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    fireEvent.press(screen.getByTestId(`evidence-row-${h.idOf('0002')}`));
    await settle();
    expect(screen.queryByTestId('evidence-detail-tabs-pinned')).toBeNull();
    expect(inside(screen.getByTestId('evidence-tab-integrity') as unknown as Node, 'evidence-detail-scroll')).toBe(true);
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
    // Fix wave K (D223 (1)): the required role is stated and NO row is written by opening the wizard;
    // the explicit "Request authorization" press is the audited attempt.
    expect(screen.getByTestId('evidence-export-requires-role-hint')).toBeTruthy();
    expect(auditRowsFor(h, id, 'EXPORT_DENIED')).toHaveLength(0);
    fireEvent.press(screen.getByTestId('evidence-export-request-authorization'));
    await settle();
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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-c2-exports-playback.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave H, driver C2 (mobile) - finding 7 of the common brief.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G94-05 | The detail lists the item's finished exports (operation 40 `exports`), each with "Download from the web console."; no download control on this app | "finished exports" |
// | G94-09 | The export sheet of a REAL item names no "(simulated)" destination and says where the export is stored; what it sends as the destination is the plain label. A simulated / demo item keeps its simulated labels | "the export sheet" |
// | G94-07 | A stop caused only by the END OF THE MEDIA SESSION reads "Playback paused: the media session ended. Press Play to continue."; the integrity hint stays for a stop on a session that had not ended | "a stopped playback" |
describe('finished exports, the export sheet and a stopped playback', () => {
unmountBeforeTheHooksOfThisGroup();
type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
}
let players: FakePlayer[] = [];
function fakePlayer(): FakePlayer {
  const listeners = new Map<string, Set<Listener>>();
  return {
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn(async () => undefined),
    addListener: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, set);
      set.add(listener);
      return { remove: () => void set.delete(listener) };
    },
    emit: (event, payload = {}) => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
    },
  };
}

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  players = [];
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<FakePlayer | null>(null);
    if (held.current === null) {
      held.current = fakePlayer();
      players.push(held.current);
    }
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const finished = (exportId: string, jobId: string, kind: 'PACKAGE' | 'COMPOSITE', completedAt: number) => ({ exportId, jobId, kind, completedAt, exportedBy: 'OPR-002', archiveBytes: 136_096_844 });

describe('G94-05 - the finished exports of an item', () => {
  it('operation 40 lists two exports: each is named with its kind and "Download from the web console."; no download control', async () => {
    const { b, id } = await bedWith('0001', realItem({ status: 'EXPORTED' }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    b.detailExtras = () => ({
      access: { play: true, readTranscript: true, export: true },
      exports: [finished('EXP-000036', 'EXPJ-000036', 'PACKAGE', 1_791_600_000_000), finished('EXP-000033', 'EXPJ-000033', 'COMPOSITE', 1_791_500_000_000)],
    });
    await openItem(b, id);
    const text = textUnder('evidence-finished-exports');
    expect(text).toMatch(/Finished exports/);
    expect(screen.getByTestId('evidence-finished-export-EXP-000036')).toHaveTextContent(/EXP-000036 · Package/);
    expect(screen.getByTestId('evidence-finished-export-EXP-000036')).toHaveTextContent(/Download from the web console\./);
    expect(screen.getByTestId('evidence-finished-export-EXP-000033')).toHaveTextContent(/EXP-000033 · Composite/);
    // The page view asked for no job and no download path.
    expect(b.requests('getEvidenceExportJob')).toHaveLength(0);
  }, 40_000);

  it('an empty list: "No finished export of this item."', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true }, exports: [] });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-finished-exports')).toHaveTextContent(/No finished export of this item\./);
  }, 40_000);

  it('the member is absent on an EXPORTED item: "Finished exports: not reported"', async () => {
    const { b, id } = await bedWith('0001', realItem({ status: 'EXPORTED' }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-finished-exports')).toHaveTextContent(/Finished exports: not reported/);
  }, 40_000);

  it('CONTROL: the member is absent on an item that was never exported - nothing is drawn', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    expect(screen.queryByTestId('evidence-finished-exports')).toBeNull();
  }, 40_000);
});

describe('G94-09 - the export sheet', () => {
  async function toDestination(suffix: string, change: ItemChange | null, verifyV2: boolean): Promise<{ b: LiveEvidenceBed; id: string }> {
    const { b, id } = await bedWith(suffix, change);
    bed = b;
    if (change !== null) b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 200);
    if (verifyV2) b.fake.answerOnce('verifyEvidence', { status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: id, at: b.fake.clock.now() } });
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    return { b, id };
  }

  it('a REAL item: the destinations carry no "(simulated)"; the sheet says the export is stored on the Core server; the request names the plain destination', async () => {
    const { b } = await toDestination('0001', realItem(), true);
    const wizard = textUnder('evidence-export-wizard');
    expect(wizard).toMatch(/Destination recorded with the export/);
    expect(wizard).toMatch(/Encrypted USB drive/);
    expect(wizard).toMatch(/Export\/Transfer network/);
    expect(wizard).toMatch(/The export is stored on the Core server\. The destination is recorded with it; nothing is sent to it from here\./);
    expect(wizard).not.toMatch(/simulated|DEMO/i);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    fireEvent.changeText(screen.getByTestId('evidence-export-reason'), 'Requested by the prosecutor');
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 300);
    const sent = b.requests('exportEvidence').at(-1)?.body as { destination?: string };
    // Fix wave K (G94b-12): the pre-selected option is the case-file one, as on the web console (this Core stated no default).
    expect(sent.destination).toBe('Case file transfer');
  }, 40_000);

  it('CONTROL: a simulated demo item keeps its "(simulated)" destinations and gets no "stored on the Core server" sentence', async () => {
    await toDestination('0002', null, false);
    const wizard = textUnder('evidence-export-wizard');
    expect(wizard).toMatch(/Encrypted USB drive \(simulated\)/);
    expect(wizard).not.toMatch(/The export is stored on the Core server/);
  }, 40_000);
});

describe('G94-07 - a stopped playback', () => {
  const OWN_ORIGIN = 'http://core.test:8090';
  const TTL_MS = 60_000;

  /** Opens the sealed player of a streamable REAL item, plays, and moves the playhead to 1:10 of 2:00. */
  async function playing(): Promise<{ b: LiveEvidenceBed; lead: FakePlayer }> {
    const { b, id } = await bedWith('0001', realItem({ durationMs: 120_000 }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
    (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
    let calls = 0;
    b.fake.answer('createEvidenceMediaSession', (call) => {
      calls += 1;
      const first = calls % 2 === 1;
      return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `http://127.0.0.1:8443/media/mts_${first ? 'a' : 'b'}${'x'.repeat(20)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS, ranges: true } };
    });
    await openItem(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    const lead = players.at(-2) as FakePlayer;
    act(() => lead.emit('timeUpdate', { currentTime: 70 }));
    // The first error, on a session at its END by the Core's clock (wave K Z1, G94b-10: an error on a
    // live session is not renewed by itself): ONE renewal, back at the same place.
    await b.elapse(TTL_MS + 2_000, 1_000);
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
    return { b, lead };
  }

  it('the renewed session ENDED too (the Core\'s clock is past its end) when the player fails again: "the media session ended. Press Play to continue." - no integrity sentence; Play renews and continues', async () => {
    const { b, lead } = await playing();
    await b.elapse(TTL_MS + 2_000, 1_000);
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    const stopped = screen.getByTestId('evidence-playback-stopped-session');
    expect(stopped).toHaveTextContent('Playback paused: the media session ended. Press Play to continue.');
    expect(stopped).not.toHaveTextContent(/integrity|Verify/);
    expect(screen.queryByTestId('evidence-playback-stopped-position')).toBeNull();
    // Play: the session is at its end, so it is renewed first (two files, two requests) and playback goes on.
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(6);
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
  }, 40_000);

  it('CONTROL: the session had NOT ended when the player fails again at the same place: the stop names its position and points to Verify', async () => {
    const { b, lead } = await playing();
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 1:10 and did not resume\..*run Verify to see which\./);
    expect(screen.queryByTestId('evidence-playback-stopped-session')).toBeNull();
  }, 40_000);
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-c2-item-lines.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave H, driver C2 (mobile) - findings 3, 4 and 5 of the common brief, on the evidence detail
// (tablet pane and phone screen) and the evidence list.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G89-03 / G81-02 (MAJOR) | A REAL Ed25519 signature is never labelled simulated or demo; the only qualifier is the development-key line, from the item's `signature.developmentKey`; class unknown reads "not reported"; a simulated item keeps its simulated label | "the signature" |
// | G75-03 on the evidence surfaces | `interrupted === true`: the status line (+ cause) on the list row and in the item header; absent: nothing extra | "the interrupted item" |
// | G89-04 / G89-09 | A v2 item's file and hash rows are the item's own members: no MIC 1 / MIC 2 rows, no bundled-package panel, before a verify run too | "sealed values" |
// | G89-05 | `common.sourceClass.verify.v1` is the sources line of a v1 item | "sealed values" |
describe('the lines of a REAL item', () => {
unmountBeforeTheHooksOfThisGroup();
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

const VARIANTS = [
  { layout: 'tablet', window: 'tabletLandscape' },
  { layout: 'phone', window: 'phonePortrait' },
] as const;

async function integrityOf(suffix: string, change: ItemChange | null, window: 'tabletLandscape' | 'phonePortrait' = 'phonePortrait', media: 'NONE' | 'default' = 'NONE'): Promise<{ b: LiveEvidenceBed; id: string; text: string }> {
  const { b, id } = await bedWith(suffix, change, { window });
  bed = b;
  if (media === 'NONE') b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
  await openItem(b, id);
  fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
  await b.flush();
  return { b, id, text: textUnder('evidence-integrity') };
}

describe('G89-03 / G81-02 - the signature of a REAL item', () => {
  it.each(VARIANTS)('$layout: "Manifest signature (Ed25519, Core key ...)" - never "DEMO key", never "simulated"; `developmentKey: true` draws the development-key line', async ({ window }) => {
    const { text } = await integrityOf('0001', realItem({ signature: { value: 'c'.repeat(128), keyId: CORE_KEY, algorithm: 'Ed25519', simulated: false, developmentKey: true } }), window);
    expect(screen.getByTestId('evidence-signature-title')).toHaveTextContent(`Manifest signature (Ed25519, Core key ${CORE_KEY})`);
    expect(text).not.toMatch(/DEMO key/i);
    expect(text).not.toMatch(/simulated/i);
    expect(screen.getByTestId('evidence-signature-key-class-DEVELOPMENT')).toHaveTextContent('Signed with a DEVELOPMENT key — not a production signature');
  }, 30_000);

  it('the key class is not reported by the item: "Signing key class: not reported" - never a production claim, never a demo label', async () => {
    const { text } = await integrityOf('0001', realItem());
    expect(screen.getByTestId('evidence-signature-key-class-UNKNOWN')).toHaveTextContent('Signing key class: not reported');
    expect(text).not.toMatch(/DEMO key|simulated|production/i);
  }, 30_000);

  it('`developmentKey: false`: no qualifier at all', async () => {
    await integrityOf('0001', realItem({ signature: { value: 'c'.repeat(128), keyId: CORE_KEY, algorithm: 'Ed25519', simulated: false, developmentKey: false } }));
    expect(screen.getByTestId('evidence-signature-title')).toHaveTextContent(`Manifest signature (Ed25519, Core key ${CORE_KEY})`);
    expect(screen.queryByTestId(/^evidence-signature-key-class-/)).toBeNull();
  }, 30_000);

  it('CONTROL: a simulated item keeps its simulated label', async () => {
    await integrityOf('0002', null, 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-signature-title')).toHaveTextContent('Signature (simulated)');
    expect(screen.queryByTestId(/^evidence-signature-key-class-/)).toBeNull();
  }, 30_000);
});

describe('finding 4 - the interrupted item', () => {
  it.each(VARIANTS)('$layout: `interrupted: true` with a cause - the list row and the item header say "Sealed — recording was interrupted" and the cause', async ({ window }) => {
    const { b, id } = await bedWith('0001', realItem({ interrupted: true, interruptedCause: 'CAMERA_LOST' }), { window });
    bed = b;
    await b.flush();
    expect(screen.getByTestId(`evidence-row-interrupted-${id}`)).toHaveTextContent('Sealed — recording was interrupted');
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    const header = screen.getByTestId('evidence-detail-interrupted');
    expect(header).toHaveTextContent(/Sealed — recording was interrupted/);
    expect(header).toHaveTextContent(/Cause: CAMERA_LOST/);
  }, 30_000);

  it('D207: the custody entry RECORDING_INTERRUPTED alone (the Core\'s member is not stated yet) names the SAME state with the same cause, on the row and in the header', async () => {
    const custody = contractDetail('productSealedInterrupted').evidence.custody;
    const { b, id } = await bedWith('0001', realItem({ custody }));
    bed = b;
    await b.flush();
    expect(screen.getByTestId(`evidence-row-interrupted-${id}`)).toHaveTextContent('Sealed — recording was interrupted');
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-interrupted')).toHaveTextContent(/Cause: CAPTURE_FAULT/);
  }, 30_000);

  it('D207: the sealed manifest wins - `interrupted: false` of the Core draws nothing although a custody entry says interrupted', async () => {
    const custody = contractDetail('productSealedInterrupted').evidence.custody;
    const { b, id } = await bedWith('0001', realItem({ interrupted: false, custody }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(screen.queryByTestId(`evidence-row-interrupted-${id}`)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-interrupted')).toBeNull();
  }, 30_000);

  it('`interrupted: true` without a cause: "Cause: not reported"', async () => {
    const { b, id } = await bedWith('0001', realItem({ interrupted: true, interruptedCause: null }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-interrupted')).toHaveTextContent(/Cause: not reported/);
  }, 30_000);

  it.each([{ name: 'false', more: { interrupted: false } }, { name: 'absent', more: {} }])('`interrupted` $name: nothing extra on the row or in the header (CONTROL: both are drawn)', async ({ more }) => {
    const { b, id } = await bedWith('0001', realItem(more), { window: 'tabletLandscape' });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId(`evidence-row-status-${id}`)).toBeTruthy();
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(screen.queryByTestId(`evidence-row-interrupted-${id}`)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-interrupted')).toBeNull();
  }, 30_000);
});

describe('G89-04 / G89-09 / G89-05 - the sealed values of an item, before a verify run', () => {
  it.each(VARIANTS)('$layout: a v2 item lists its OWN camera files - no MIC 1 / MIC 2 row, no four-track list', async ({ window }) => {
    const { text } = await integrityOf('0001', realItem(), window);
    expect(screen.getByTestId('evidence-sealed-values')).toHaveTextContent(/Sealed values of this item/);
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-track-AUDIO-01')).toBeNull();
    expect(screen.queryByTestId('evidence-track-AUDIO-02')).toBeNull();
    expect(text).not.toMatch(/MIC 1|MIC 2/);
    expect(text).not.toMatch(/Per-track SHA-256/i);
  }, 30_000);

  it('a v2 item of ONE camera lists one file', async () => {
    await integrityOf('0001', realItem({}, { cameras: ['VIDEO-01'] }));
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.queryByTestId('evidence-sealed-file-VIDEO-02')).toBeNull();
  }, 30_000);

  it('a seed-sealed v2 DEMO item (the Core names a bundled package for its number): its own tracks only, and the bundled v1 package is not joined to it', async () => {
    const { text } = await integrityOf('0005', seedSealedDemo(), 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.queryByTestId('evidence-track-AUDIO-02')).toBeNull();
    expect(text).not.toMatch(/MIC 1|MIC 2|DEMO key|Bundled demo package/);
    fireEvent.press(screen.getByTestId('evidence-tab-metadata'));
    expect(screen.queryByText(/manifest\.json \(DEMO\)/)).toBeNull();
  }, 30_000);

  it('G89-05: a v1 item says "Sources: not recorded (v1 package)" and keeps its four track rows', async () => {
    await integrityOf('0002', null, 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-sources-v1')).toHaveTextContent('Sources: not recorded (v1 package)');
    expect(screen.getByTestId('evidence-track-AUDIO-02')).toBeTruthy();
  }, 30_000);

  it('G89-05 CONTROL: a v2 item does not say it', async () => {
    await integrityOf('0001', realItem());
    expect(screen.getByTestId('evidence-integrity')).toBeTruthy();
    expect(screen.queryByTestId('evidence-sources-v1')).toBeNull();
  }, 30_000);
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-c2-media.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave H, driver C2 (mobile) - findings 1 and 2 of the common brief.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G94-02 (BLOCKER), G94-14 / G81-10 | In Live mode NO bundled picture, poster, placeholder feed or player is shown for an item that is not a v1 / simulated demo item; "No DEMO media" is never said of a REAL item; the state sentence + the reason instead | "a REAL item" (tablet pane AND phone screen) |
// | the three kinds | streamable -> the sealed player; demo (and the item IS a demo item) -> the bundled media WITH its demo label; anything else -> no player, no picture | "the three kinds" |
// | G94-01, client half | the sealed player is shown when the item says streamable; a one-camera package offers its one file | "streamable" |
// | the contract's own shape | every `getEvidence` 200 example of the shared contract is classified and rendered; the streamable example is expected-failing until the contract carries one | "the contract's examples" |
describe('the media of a REAL item', () => {
unmountBeforeTheHooksOfThisGroup();
const NONE_SENTENCE = 'This recording has no playable media on this Core.';
const DEMO_LABEL = 'DEMO media — bundled with this application, not a recording of this Core';
const OWN_ORIGIN = 'http://core.test:8090';

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  // The sealed player's two players: plain objects (no native player in jest).
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<Record<string, unknown> | null>(null);
    held.current ??= { play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => undefined), addListener: () => ({ remove: () => undefined }), currentTime: 0 };
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const picturesIn = (testID: string): number => within(screen.getByTestId(testID)).UNSAFE_queryAllByType(Image).length;
const VARIANTS = [
  { layout: 'tablet', window: 'tabletLandscape', root: 'evidence-detail-pane' },
  { layout: 'phone', window: 'phonePortrait', root: 'evidence-detail-screen' },
] as const;

/** No bundled picture, no player, no demo wording; Play opens nothing. */
async function expectNoMediaAtAll(b: LiveEvidenceBed, root: string): Promise<void> {
  expect(screen.getByTestId(root)).toBeTruthy();
  expect(picturesIn('evidence-detail-hero')).toBe(0);
  expect(screen.queryByTestId('evidence-media')).toBeNull();
  expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
  fireEvent.press(screen.getByTestId('evidence-action-play'));
  await b.flush();
  expect(screen.queryByTestId('evidence-player-none')).toBeNull();
  expect(screen.queryByTestId('evidence-player')).toBeNull();
  expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
  expect(allText()).not.toMatch(/DEMO media|DEMO package|DEMO excerpt|Simulated playback|Bundled demo/);
}

describe.each(VARIANTS)('G94-02 / G94-14 / G81-10 - a REAL item on the $layout layout', ({ window, root }) => {
  it('the Core says NONE with a reason: the state sentence and the reason; no picture in the hero, no player, Play opens nothing, no DEMO wording', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null, reason: 'PACKAGE_MISSING' });
    await openItem(b, id);
    const none = screen.getByTestId('evidence-media-none');
    expect(none).toHaveTextContent(new RegExp(NONE_SENTENCE.replace(/\./g, '\\.')));
    expect(none).toHaveTextContent(/The sealed package is not in the evidence store of this Core\./);
    await expectNoMediaAtAll(b, root);
  }, 30_000);

  it('a code this app does not word is shown as a code', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null, reason: 'FRAGMENT_TABLE_INVALID' });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toHaveTextContent(/Reason reported by the Core server: FRAGMENT_TABLE_INVALID\./);
  }, 30_000);

  it('the Core names a bundled demo package for it (the join by the evidence number 0001): NOT a demo item - nothing bundled is shown', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    // The bed's default answer: DEMO_PACKAGE with the suffix of the item's own number.
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toHaveTextContent(new RegExp(NONE_SENTENCE.replace(/\./g, '\\.')));
    await expectNoMediaAtAll(b, root);
  }, 30_000);

  it('operation 40 does not answer (the member is absent): no picture and no player', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.fake.fail('getEvidence');
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-unavailable')).toHaveTextContent(/The Core server reported no media source for this item\./);
    await expectNoMediaAtAll(b, root);
  }, 30_000);
});

describe('G94-02 - the list row', () => {
  it('a REAL item numbered 0001 draws no bundled poster; a demo item keeps its poster (CONTROL)', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window: 'tabletLandscape' });
    bed = b;
    await b.flush();
    expect(picturesIn(`evidence-row-card-${id}`)).toBe(0);
    expect(picturesIn(`evidence-row-card-${b.idOf('0002')}`)).toBe(1);
  }, 30_000);
});

describe('the three kinds', () => {
  it.each(VARIANTS)('DEMO on the $layout layout: a demo item with the package the Core named shows the bundled media WITH its demo label, and Play opens the bundled player', async ({ window, root }) => {
    const { b, id } = await bedWith('0002', null, { window });
    bed = b;
    await openItem(b, id);
    expect(screen.getByTestId(root)).toBeTruthy();
    expect(screen.getByTestId('evidence-media-panel-bundled')).toBeTruthy();
    expect(screen.getByTestId('evidence-media-demo-label')).toHaveTextContent(DEMO_LABEL);
    expect(screen.getByTestId('evidence-media')).toBeTruthy();
    expect(picturesIn('evidence-detail-hero')).toBe(1);
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(screen.getByTestId('evidence-player')).toBeTruthy();
    expect(screen.getByTestId('evidence-play-bundled')).toBeTruthy();
  }, 30_000);

  it('a seed-sealed v2 DEMO item for which the Core names a bundled package: its own members say a package of THIS Core - nothing bundled', async () => {
    const { b, id } = await bedWith('0005', seedSealedDemo());
    bed = b;
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toBeTruthy();
    await expectNoMediaAtAll(b, 'evidence-detail-screen');
  }, 30_000);

  it.each(VARIANTS)('STREAMABLE on the $layout layout (G94-01, client half): the sealed player, no bundled picture, no demo label', async ({ window, root }) => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
    await openItem(b, id);
    expect(screen.getByTestId(root)).toBeTruthy();
    expect(screen.getByTestId('evidence-media-panel-sealed')).toBeTruthy();
    expect(screen.getByTestId('evidence-playback-open-ALLOWED')).toBeTruthy();
    expect(picturesIn('evidence-detail-hero')).toBe(0);
    expect(screen.queryByTestId('evidence-media-demo-label')).toBeNull();
    expect(screen.queryByTestId('evidence-media-none')).toBeNull();
    // Opening is a press: the page view asked for no media session.
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
  }, 30_000);

  it('a package of ONE camera (the Core names `fileIds: [VIDEO-01]`; the item names no `files`): one media session is asked, for that file, and the player says so', async () => {
    const { b, id } = await bedWith('0001', realItem({}, { cameras: ['VIDEO-01'], files: false }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01'] });
    (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
    b.fake.answer('createEvidenceMediaSession', (call) => ({ status: 201, body: { evidenceId: call.params.id ?? '', fileId: 'VIDEO-01', url: 'http://127.0.0.1:8443/media/mts_onecameraAAAAAAAAAAAA', expiresAt: b.fake.clock.now() + 60_000, ranges: true } }));
    await openItem(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-ready-VIDEO-01')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(1);
    expect(screen.getByTestId('evidence-playback-one-camera')).toHaveTextContent('This recording has one camera file (Camera 1).');
  }, 30_000);
});

describe("the contract's examples of `getEvidence` (packages/shared/src/api/evidence.ts), fed UNMODIFIED", () => {
  /** What the page must draw for each example: the Core's REAL shape decides, by the contract's own member names. */
  const EXPECTED: Record<ContractItemName, { kind: 'SEALED' | 'DEMO' | 'NONE'; files?: readonly string[]; reason?: string; interrupted?: string; mayPlay?: boolean }> = {
    withPackage: { kind: 'DEMO' },
    productSealed: { kind: 'SEALED', files: ['VIDEO-01', 'VIDEO-02'], mayPlay: true },
    productSealedInterrupted: { kind: 'SEALED', files: ['VIDEO-01', 'VIDEO-02'], interrupted: 'CAPTURE_FAULT', mayPlay: true },
    productSealedOneCamera: { kind: 'SEALED', files: ['VIDEO-01'], mayPlay: true },
    noMedia: { kind: 'NONE', reason: 'PACKAGE_MISSING' },
    outsideCaseScope: { kind: 'SEALED', files: ['VIDEO-01', 'VIDEO-02'], mayPlay: false },
    seedSealedDemo: { kind: 'SEALED', files: ['VIDEO-01', 'VIDEO-02'], mayPlay: true },
  };

  it('every 200 example of the contract has its expectation here (a new example cannot go unread)', () => {
    expect(contractDetailNames().sort()).toEqual(Object.keys(EXPECTED).sort());
  }, 30_000);

  it('the shared vector of the ONE rule (sealedPackage; the interrupted fact), read through this app\'s reader', () => {
    for (const vector of EVIDENCE_ITEM_KIND_VECTORS) {
      const facts = readItemFacts(vector.item);
      expect([vector.name, hasSealedPackageHere(facts), isDemoItem(facts), facts.interrupted, facts.interruptedCause]).toEqual([vector.name, vector.kind === 'SEALED_HERE', vector.kind === 'DEMO', vector.interrupted, vector.cause]);
    }
    // The names no Core sends are NOT read (the mismatch reconcile pass R closed).
    expect(readDetailFacts({ media: { source: 'LIVE_STREAM', packageSuffix: null, files: ['VIDEO-02'] }, access: { transcript: false } })).toMatchObject({ media: { files: null }, access: { transcript: null } });
  }, 30_000);

  it.each(Object.keys(EXPECTED) as ContractItemName[])('the example "%s" is read by the contract\'s names and rendered by the page from the Core\'s own shape', async (name) => {
    const want = EXPECTED[name];
    const body = contractDetail(name);
    const item = readItemFacts(body.evidence);
    const detail = readDetailFacts(body);
    // The reader, on the example as it is: nothing renamed, nothing added.
    expect(detail.media).toEqual({ source: body.media.source, packageSuffix: body.media.packageSuffix, files: body.media.fileIds ?? null, reason: body.media.reason ?? null });
    expect(detail.access).toEqual({ play: body.access?.play ?? null, transcript: body.access?.readTranscript ?? null, export: body.access?.export ?? null });
    expect(detail.exports?.map((entry) => entry.jobId) ?? null).toEqual(body.exports?.map((entry) => entry.jobId) ?? null);
    expect(item.sealedPackage).toBe((body.evidence as { sealedPackage?: string }).sealedPackage ?? null);
    expect(item.interrupted).toBe((body.evidence as { interrupted?: boolean }).interrupted ?? null);
    expect(mediaKindOf(detail.media, item)).toBe(want.kind);

    // The Core's own item and body, as the example states them, on the Live bed.
    const { b } = await bedWith('0004', () => body.evidence as unknown as EvidenceItem);
    bed = b;
    const { evidence: _evidence, media, ...extras } = body as unknown as Record<string, unknown>;
    b.mediaRef = () => media as never;
    b.detailExtras = () => extras;
    const asked: string[] = [];
    (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
    b.fake.answer('createEvidenceMediaSession', (call) => {
      const fileId = (call.body as { fileId?: 'VIDEO-01' | 'VIDEO-02' } | undefined)?.fileId ?? 'VIDEO-01';
      asked.push(fileId);
      return { status: 201, body: { evidenceId: call.params.id ?? '', fileId, url: `http://127.0.0.1:8443/media/mts_reconcileRAAAAAAAAAA${fileId.slice(-2)}`, expiresAt: b.fake.clock.now() + 60_000, ranges: true } };
    });
    await openItem(b, body.evidence.id);
    expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(body.evidence.id);
    if (want.kind === 'DEMO') {
      expect(screen.getByTestId('evidence-media-panel-bundled')).toBeTruthy();
      expect(screen.getByTestId('evidence-media-demo-label')).toHaveTextContent(DEMO_LABEL);
    } else {
      // A package sealed on this Core - also the seed-sealed demonstration item (D205) - never draws anything bundled.
      expect(picturesIn('evidence-detail-hero')).toBe(0);
      expect(screen.queryByTestId('evidence-media-demo-label')).toBeNull();
      expect(allText()).not.toMatch(/DEMO media|DEMO package|DEMO excerpt|Simulated playback|Bundled demo/);
    }
    if (want.kind === 'NONE') {
      expect(screen.getByTestId('evidence-media-none')).toBeTruthy();
      expect(allText()).toContain(NONE_SENTENCE);
    }
    if (want.kind === 'SEALED') {
      // A page view asks operation 88 for nothing.
      expect(asked).toEqual([]);
      if (want.mayPlay === false) {
        expect(screen.queryByTestId('evidence-playback-open-ALLOWED')).toBeNull();
        expect(allText()).toContain('You are not permitted to play this recording.');
      } else {
        expect(screen.getByTestId('evidence-media-panel-sealed')).toBeTruthy();
        // The press asks for exactly the files `media.fileIds` names - one session each, never a constant pair.
        fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
        await b.flush();
        expect([...asked].sort()).toEqual(want.files);
        expect(screen.getByTestId(`evidence-playback-ready-${(want.files ?? []).join('+')}`)).toBeTruthy();
      }
    }
    if (want.interrupted !== undefined) expect(allText()).toContain('Sealed — recording was interrupted');
    else expect(allText()).not.toContain('recording was interrupted');
  }, 30_000);
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m2-phone-layout.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave K, driver M2 - item 7: the PHONE layout of the sealed player (`M8-PB-P`, gate 94: "NOT
// PROVEN - the phone sits on the simulated lane, which has no v2 item"). Every screen state of the
// sealed player is held here in the phone window (`phonePortrait`, the pushed detail screen), so the
// re-check on the device only has to confirm them. The tablet's own cases are the wave H tests; one
// tablet case stays here as the CONTROL of the window switch.
//
// | State | What the phone shows |
// |-------|----------------------|
// | before a press | "Open playback"; the page view asks for no media session |
// | ready, two files | both sealed files, the play / pause control, the time, the audio band; no bundled picture |
// | ready, one file | one media session, "This recording has one camera file (Camera 1)." |
// | `409 MEDIA_NOT_AVAILABLE` | "No playback media is available for this evidence item."; no player |
// | `access.play: false` | "You are not permitted to play this recording."; nothing is asked |
// | the session ended | "Playback paused: the media session ended. Press Play to continue." |
// | a stop that is not the session's end | the position and "run Verify to see which." |
// | the Core says NONE | the state sentence and its reason; no player |
describe('the phone layout of the sealed player', () => {
unmountBeforeTheHooksOfThisGroup();
const OWN_ORIGIN = 'http://127.0.0.1:8443';
const TTL_MS = 60_000;
type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
}
let players: FakePlayer[] = [];
function fakePlayer(): FakePlayer {
  const listeners = new Map<string, Set<Listener>>();
  return {
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn(async () => undefined),
    addListener: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, set);
      set.add(listener);
      return { remove: () => void set.delete(listener) };
    },
    emit: (event, payload = {}) => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
    },
  };
}

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  players = [];
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<FakePlayer | null>(null);
    if (held.current === null) {
      held.current = fakePlayer();
      players.push(held.current);
    }
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const PHONE = { window: 'phonePortrait', root: 'evidence-detail-screen' } as const;
const INTERVALS = [
  { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 40_000, reason: 'START' },
  { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 40_000, toMs: 120_000, reason: 'MANUAL' },
];

/** A sealed item of this Core whose files the Core says are streamable, opened on the phone. */
async function sealedOnPhone(options: { cameras?: readonly string[]; window?: 'phonePortrait' | 'tabletLandscape'; extras?: Readonly<Record<string, unknown>> } = {}): Promise<{ b: LiveEvidenceBed; id: string }> {
  const cameras = options.cameras ?? ['VIDEO-01', 'VIDEO-02'];
  const { b, id } = await bedWith('0001', realItem({ durationMs: 120_000, audioSourceIntervals: INTERVALS }, { cameras, files: cameras.length === 2 }), { window: options.window ?? PHONE.window });
  bed = b;
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: [...cameras] as ('VIDEO-01' | 'VIDEO-02')[] });
  (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const fileId = cameras.length === 1 ? cameras[0] : calls % 2 === 1 ? 'VIDEO-01' : 'VIDEO-02';
    return { status: 201, body: { evidenceId: call.params.id ?? '', fileId, url: `${OWN_ORIGIN}/media/mts_${'p'.repeat(22)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS, ranges: true } };
  });
  if (options.extras !== undefined) b.detailExtras = () => options.extras as Readonly<Record<string, unknown>>;
  await openItem(b, id);
  return { b, id };
}
const openPlayback = async (b: LiveEvidenceBed) => {
  fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
  await b.flush();
};

describe('the sealed player in the PHONE layout (M8-PB-P)', () => {
  it('the pushed detail screen (not the tablet\'s pane): "Open playback", and the page view asks for no media session', async () => {
    const { b } = await sealedOnPhone();
    expect(screen.getByTestId(PHONE.root)).toBeTruthy();
    expect(screen.queryByTestId('evidence-detail-pane')).toBeNull();
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-media-panel-sealed')).toBeTruthy();
    expect(screen.getByTestId('evidence-playback-open-ALLOWED')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
    // No bundled picture and no demo wording on a recording of this Core.
    expect(screen.queryByTestId('evidence-media-demo-label')).toBeNull();
  }, 30_000);

  it('ready with two files: both sealed files, the play control, the time and the audio band of both microphones', async () => {
    const { b } = await sealedOnPhone();
    await openPlayback(b);
    const root = within(screen.getByTestId(PHONE.root));
    expect(root.getByTestId('evidence-playback-ready-VIDEO-01+VIDEO-02')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(2);
    expect(root.getByTestId('evidence-sealed-video-VIDEO-01')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-video-VIDEO-02')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-time')).toBeTruthy();
    expect(root.getByTestId('evidence-band-legend-MIC-01')).toBeTruthy();
    expect(root.getByTestId('evidence-band-legend-MIC-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-playback-one-camera')).toBeNull();
  }, 30_000);

  it('ready with ONE file: one media session and "This recording has one camera file (Camera 1)."', async () => {
    const { b } = await sealedOnPhone({ cameras: ['VIDEO-01'] });
    await openPlayback(b);
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-ready-VIDEO-01')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(1);
    expect(screen.getByTestId('evidence-playback-one-camera')).toHaveTextContent('This recording has one camera file (Camera 1).');
  }, 30_000);

  it('`409 MEDIA_NOT_AVAILABLE`: the fixed sentence, and no player', async () => {
    const { b } = await sealedOnPhone();
    b.fake.answer('createEvidenceMediaSession', () => b.fake.example('createEvidenceMediaSession', 409));
    await openPlayback(b);
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-refused-NOT_AVAILABLE')).toHaveTextContent('No playback media is available for this evidence item.');
    expect(screen.queryByTestId(/^evidence-playback-ready-/)).toBeNull();
    expect(screen.queryByTestId(/^evidence-sealed-video-/)).toBeNull();
  }, 30_000);

  it('`access.play: false`: "You are not permitted to play this recording."; Play is disabled and nothing is asked', async () => {
    const { b } = await sealedOnPhone({ extras: { access: { play: false, readTranscript: false, export: false } } });
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-media-may-not-play')).toHaveTextContent('You are not permitted to play this recording.');
    expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
  }, 30_000);

  it('the Core says NONE: the state sentence and its reason; no player and no picture', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window: PHONE.window });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null, reason: 'PACKAGE_MISSING' });
    await openItem(b, id);
    const root = within(screen.getByTestId(PHONE.root));
    expect(root.getByTestId('evidence-media-none')).toBeTruthy();
    expect(root.getByTestId('evidence-media-none-reason')).toBeTruthy();
    expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
    expect(screen.getByTestId('evidence-action-play').props.accessibilityState?.disabled).toBe(true);
  }, 30_000);

  describe('a stopped playback', () => {
    async function stoppedOnce(): Promise<{ b: LiveEvidenceBed; lead: FakePlayer }> {
      const { b } = await sealedOnPhone();
      await openPlayback(b);
      fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
      const lead = players.at(-2) as FakePlayer;
      act(() => lead.emit('timeUpdate', { currentTime: 70 }));
      // The first error, on a session at its END by the Core's clock (wave K Z1, G94b-10: an error on a
      // live session is not renewed by itself): ONE renewal, back at the same place.
      await b.elapse(TTL_MS + 2_000, 1_000);
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
      return { b, lead };
    }

    it('the session had not ended: the stop names its position and points to Verify', async () => {
      const { b, lead } = await stoppedOnce();
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 1:10 and did not resume\..*run Verify to see which\./);
    }, 30_000);

    it('the media session ended: "Playback paused: the media session ended. Press Play to continue." - no integrity sentence', async () => {
      const { b, lead } = await stoppedOnce();
      await b.elapse(TTL_MS + 2_000, 1_000);
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      const stopped = within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-stopped-session');
      expect(stopped).toHaveTextContent('Playback paused: the media session ended. Press Play to continue.');
      expect(stopped).not.toHaveTextContent(/integrity|Verify/);
    }, 30_000);
  });

  it('CONTROL of the window: the tablet draws the same item in its detail PANE, not on a pushed screen', async () => {
    await sealedOnPhone({ window: 'tabletLandscape' });
    expect(screen.getByTestId('evidence-detail-pane')).toBeTruthy();
    expect(screen.queryByTestId(PHONE.root)).toBeNull();
  }, 30_000);
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-l-m-sealed-format.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave L, driver L-M - re-check 89 finding G89c-04 (ruling D229 (3)): no client showed the format
// the SIGNED manifest states (field 36), nor the session's STREAM_PROFILE_DIFFERS notice on its item.
//
// The members are L-S's (`delegation_progress/contract_wave_l.md` section 4), read BY NAME through the
// contract's own examples: `evidence.files[].profile` and `evidence.streamProfileNotice` of operation 40.
// Rule: the detail repeats what the Core states, or shows nothing - never `profileId`, never "1080p / 25 fps".
describe('the sealed format of an item', () => {
unmountBeforeTheHooksOfThisGroup();
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

describe('G89c-04 - the members, by the names of the contract', () => {
  it('the reader\'s names ARE the names the contract examples hold', () => {
    expect(MEMBER.item.files in EVIDENCE_SEALED_PROFILE_EXAMPLE).toBe(true);
    expect(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.every((file) => MEMBER.item.fileProfile in file)).toBe(true);
    expect(MEMBER.detail.streamProfileNotice in EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE).toBe(true);
    const track = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks[0]!;
    expect(MEMBER.detail.noticeStream in track && MEMBER.detail.noticeConfigured in track && MEMBER.item.trackId in track).toBe(true);
  });

  it('reads the per-file format as SIGNED and the notice from operation 40\'s item', () => {
    const facts = readDetailFacts({ evidence: { ...EVIDENCE_SEALED_PROFILE_EXAMPLE, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } });
    expect(facts.sealedProfiles).toEqual(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ trackId: file.trackId, profile: file.profile })));
    expect(facts.streamProfileNotice).toEqual(EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks);
  });

  it('CONTROL - nothing stated is nothing reported: absent members, a `profileId`, a value that is no profile code', () => {
    expect(NO_DETAIL_FACTS.sealedProfiles).toBeNull();
    expect(NO_DETAIL_FACTS.streamProfileNotice).toBeNull();
    const plain = EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map(({ profile: _profile, ...file }) => file);
    expect(readDetailFacts({ evidence: { files: plain, profileId: 'STANDARD_1080P25' } }).sealedProfiles).toBeNull();
    expect(readSealedProfiles({ files: [{ trackId: 'VIDEO-01', profile: 'Standard (1080p / 25 fps)' }] })).toBeNull();
    expect(readSealedProfiles({ files: [{ trackId: 'AUDIO-01', profile: 'H264_720P30' }] })).toBeNull();
    expect(readDetailFacts({ evidence: { streamProfileNotice: { tracks: [] } } }).streamProfileNotice).toBeNull();
  });
});

describe('G89c-04 - the evidence detail of a recording this Core sealed', () => {
  it('shows the format per camera file as the signed manifest states it', async () => {
    const { b, id } = await bedWith('0001', realItem({ ...EVIDENCE_SEALED_PROFILE_EXAMPLE }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-sealed-format-profiles')).toHaveTextContent(/Sealed format \(signed manifest\)/);
    expect(screen.getByTestId('evidence-sealed-format-VIDEO-01')).toHaveTextContent(`Camera 1: ${EVIDENCE_SEALED_PROFILE_EXAMPLE.files[0]!.profile}`);
    expect(screen.getByTestId('evidence-sealed-format-VIDEO-02')).toHaveTextContent(`Camera 2: ${EVIDENCE_SEALED_PROFILE_EXAMPLE.files[1]!.profile}`);
    expect(screen.queryByTestId('evidence-sealed-format-notice')).toBeNull();
    expect(allText()).not.toMatch(/1080p|25 fps|STANDARD_1080P25/);
  });

  it('shows the session\'s profile notice: what the stream declared against what was configured', async () => {
    const { b, id } = await bedWith('0001', realItem({ ...EVIDENCE_SEALED_PROFILE_EXAMPLE, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    const first = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks[0]!;
    expect(screen.getByTestId('evidence-sealed-format-notice')).toHaveTextContent(/The recorded stream was not the configured profile/);
    expect(screen.getByTestId('evidence-sealed-format-notice-VIDEO-01')).toHaveTextContent(`Camera 1: recorded ${first.stream}, configured ${first.configured}`);
  });

  it('CONTROL - an item for which the Core states neither: no format block at all', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    expect(screen.queryByTestId('evidence-sealed-format')).toBeNull();
    expect(allText()).not.toMatch(/Sealed format|1080p|H264_/);
  });
});
});
