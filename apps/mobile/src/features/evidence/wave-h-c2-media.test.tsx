// Wave H, driver C2 (mobile) - findings 1 and 2 of the common brief.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G94-02 (BLOCKER), G94-14 / G81-10 | In Live mode NO bundled picture, poster, placeholder feed or player is shown for an item that is not a v1 / simulated demo item; "No DEMO media" is never said of a REAL item; the state sentence + the reason instead | "a REAL item" (tablet pane AND phone screen) |
// | the three kinds | streamable -> the sealed player; demo (and the item IS a demo item) -> the bundled media WITH its demo label; anything else -> no player, no picture | "the three kinds" |
// | G94-01, client half | the sealed player is shown when the item says streamable; a one-camera package offers its one file | "streamable" |
// | the contract's own shape | every `getEvidence` 200 example of the shared contract is classified and rendered; the streamable example is expected-failing until the contract carries one | "the contract's examples" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { Image } from 'expo-image';
import * as ExpoVideo from 'expo-video';
import { EVIDENCE_ITEM_KIND_VECTORS, type EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { hasSealedPackageHere, isDemoItem, mediaKindOf, readDetailFacts, readItemFacts } from './item-facts';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { allText, bedWith, contractDetail, contractDetailNames, openItem, realItem, seedSealedDemo, type ContractItemName } from './testing/wave-h-c2-kit';

jest.setTimeout(30_000);

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
  });

  it('a code this app does not word is shown as a code', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null, reason: 'FRAGMENT_TABLE_INVALID' });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toHaveTextContent(/Reason reported by the Core server: FRAGMENT_TABLE_INVALID\./);
  });

  it('the Core names a bundled demo package for it (the join by the evidence number 0001): NOT a demo item - nothing bundled is shown', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    // The bed's default answer: DEMO_PACKAGE with the suffix of the item's own number.
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toHaveTextContent(new RegExp(NONE_SENTENCE.replace(/\./g, '\\.')));
    await expectNoMediaAtAll(b, root);
  });

  it('operation 40 does not answer (the member is absent): no picture and no player', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window });
    bed = b;
    b.fake.fail('getEvidence');
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-unavailable')).toHaveTextContent(/The Core server reported no media source for this item\./);
    await expectNoMediaAtAll(b, root);
  });
});

describe('G94-02 - the list row', () => {
  it('a REAL item numbered 0001 draws no bundled poster; a demo item keeps its poster (CONTROL)', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window: 'tabletLandscape' });
    bed = b;
    await b.flush();
    expect(picturesIn(`evidence-row-card-${id}`)).toBe(0);
    expect(picturesIn(`evidence-row-card-${b.idOf('0002')}`)).toBe(1);
  });
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
  });

  it('a seed-sealed v2 DEMO item for which the Core names a bundled package: its own members say a package of THIS Core - nothing bundled', async () => {
    const { b, id } = await bedWith('0005', seedSealedDemo());
    bed = b;
    await openItem(b, id);
    expect(screen.getByTestId('evidence-media-none')).toBeTruthy();
    await expectNoMediaAtAll(b, 'evidence-detail-screen');
  });

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
  });

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
  });
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
  });

  it('the shared vector of the ONE rule (sealedPackage; the interrupted fact), read through this app\'s reader', () => {
    for (const vector of EVIDENCE_ITEM_KIND_VECTORS) {
      const facts = readItemFacts(vector.item);
      expect([vector.name, hasSealedPackageHere(facts), isDemoItem(facts), facts.interrupted, facts.interruptedCause]).toEqual([vector.name, vector.kind === 'SEALED_HERE', vector.kind === 'DEMO', vector.interrupted, vector.cause]);
    }
    // The names no Core sends are NOT read (the mismatch reconcile pass R closed).
    expect(readDetailFacts({ media: { source: 'LIVE_STREAM', packageSuffix: null, files: ['VIDEO-02'] }, access: { transcript: false } })).toMatchObject({ media: { files: null }, access: { transcript: null } });
  });

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
  });
});
