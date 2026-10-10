// Wave H, driver C2 (mobile) - findings 3, 4 and 5 of the common brief, on the evidence detail
// (tablet pane and phone screen) and the evidence list.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G89-03 / G81-02 (MAJOR) | A REAL Ed25519 signature is never labelled simulated or demo; the only qualifier is the development-key line, from the item's `signature.developmentKey`; class unknown reads "not reported"; a simulated item keeps its simulated label | "the signature" |
// | G75-03 on the evidence surfaces | `interrupted === true`: the status line (+ cause) on the list row and in the item header; absent: nothing extra | "the interrupted item" |
// | G89-04 / G89-09 | A v2 item's file and hash rows are the item's own members: no MIC 1 / MIC 2 rows, no bundled-package panel, before a verify run too | "sealed values" |
// | G89-05 | `common.sourceClass.verify.v1` is the sources line of a v1 item | "sealed values" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { CORE_KEY, bedWith, contractDetail, openItem, realItem, seedSealedDemo, textUnder, type ItemChange } from './testing/wave-h-c2-kit';

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
  });

  it('the key class is not reported by the item: "Signing key class: not reported" - never a production claim, never a demo label', async () => {
    const { text } = await integrityOf('0001', realItem());
    expect(screen.getByTestId('evidence-signature-key-class-UNKNOWN')).toHaveTextContent('Signing key class: not reported');
    expect(text).not.toMatch(/DEMO key|simulated|production/i);
  });

  it('`developmentKey: false`: no qualifier at all', async () => {
    await integrityOf('0001', realItem({ signature: { value: 'c'.repeat(128), keyId: CORE_KEY, algorithm: 'Ed25519', simulated: false, developmentKey: false } }));
    expect(screen.getByTestId('evidence-signature-title')).toHaveTextContent(`Manifest signature (Ed25519, Core key ${CORE_KEY})`);
    expect(screen.queryByTestId(/^evidence-signature-key-class-/)).toBeNull();
  });

  it('CONTROL: a simulated item keeps its simulated label', async () => {
    await integrityOf('0002', null, 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-signature-title')).toHaveTextContent('Signature (simulated)');
    expect(screen.queryByTestId(/^evidence-signature-key-class-/)).toBeNull();
  });
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
  });

  it('D207: the custody entry RECORDING_INTERRUPTED alone (the Core\'s member is not stated yet) names the SAME state with the same cause, on the row and in the header', async () => {
    const custody = contractDetail('productSealedInterrupted').evidence.custody;
    const { b, id } = await bedWith('0001', realItem({ custody }));
    bed = b;
    await b.flush();
    expect(screen.getByTestId(`evidence-row-interrupted-${id}`)).toHaveTextContent('Sealed — recording was interrupted');
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-interrupted')).toHaveTextContent(/Cause: CAPTURE_FAULT/);
  });

  it('D207: the sealed manifest wins - `interrupted: false` of the Core draws nothing although a custody entry says interrupted', async () => {
    const custody = contractDetail('productSealedInterrupted').evidence.custody;
    const { b, id } = await bedWith('0001', realItem({ interrupted: false, custody }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(screen.queryByTestId(`evidence-row-interrupted-${id}`)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-interrupted')).toBeNull();
  });

  it('`interrupted: true` without a cause: "Cause: not reported"', async () => {
    const { b, id } = await bedWith('0001', realItem({ interrupted: true, interruptedCause: null }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-interrupted')).toHaveTextContent(/Cause: not reported/);
  });

  it.each([{ name: 'false', more: { interrupted: false } }, { name: 'absent', more: {} }])('`interrupted` $name: nothing extra on the row or in the header (CONTROL: both are drawn)', async ({ more }) => {
    const { b, id } = await bedWith('0001', realItem(more), { window: 'tabletLandscape' });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId(`evidence-row-status-${id}`)).toBeTruthy();
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(screen.queryByTestId(`evidence-row-interrupted-${id}`)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-interrupted')).toBeNull();
  });
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
  });

  it('a v2 item of ONE camera lists one file', async () => {
    await integrityOf('0001', realItem({}, { cameras: ['VIDEO-01'] }));
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.queryByTestId('evidence-sealed-file-VIDEO-02')).toBeNull();
  });

  it('a seed-sealed v2 DEMO item (the Core names a bundled package for its number): its own tracks only, and the bundled v1 package is not joined to it', async () => {
    const { text } = await integrityOf('0005', seedSealedDemo(), 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.queryByTestId('evidence-track-AUDIO-02')).toBeNull();
    expect(text).not.toMatch(/MIC 1|MIC 2|DEMO key|Bundled demo package/);
    fireEvent.press(screen.getByTestId('evidence-tab-metadata'));
    expect(screen.queryByText(/manifest\.json \(DEMO\)/)).toBeNull();
  });

  it('G89-05: a v1 item says "Sources: not recorded (v1 package)" and keeps its four track rows', async () => {
    await integrityOf('0002', null, 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-sources-v1')).toHaveTextContent('Sources: not recorded (v1 package)');
    expect(screen.getByTestId('evidence-track-AUDIO-02')).toBeTruthy();
  });

  it('G89-05 CONTROL: a v2 item does not say it', async () => {
    await integrityOf('0001', realItem());
    expect(screen.getByTestId('evidence-integrity')).toBeTruthy();
    expect(screen.queryByTestId('evidence-sources-v1')).toBeNull();
  });
});
