// E-fix row FX-M2, defect E2E-T-6 (decision D200/D201): the tablet's Metadata tab was empty for evidence
// that exists only on the Core (`media.source NONE`): one line "No DEMO package for this item: the
// manifest is not on this device.", while the web's Metadata tab shows the Core record. The tab now shows
// the record the web shows (the same keys, labelled "Core record"), on the app's own Live source over the
// contract-checked fake transport. A DEMO_PACKAGE item keeps its manifest; an unanswered media reference
// claims no absence; Simulated mode shows the simulator's record, labelled as such.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { OUTAGE } from '@dems/shared/live/testing';
import { toWibIso } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { evidenceRecordJson } from './metadata-tab';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';

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

const textOf = (testID: string): string => {
  const children = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(children) ? children.join('') : String(children);
};

async function openMetadata(suffix: string, configure?: (b: LiveEvidenceBed) => void, window: 'phonePortrait' | 'tabletLandscape' = 'tabletLandscape'): Promise<{ b: LiveEvidenceBed; id: string }> {
  const b = await renderLiveEvidence({ window });
  bed = b;
  configure?.(b);
  const id = b.idOf(suffix);
  await b.navigate(`/evidence/${id}`);
  await b.flush();
  await b.elapse(300);
  expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  fireEvent.press(screen.getByTestId('evidence-tab-metadata'));
  await b.flush();
  return { b, id };
}

describe('E2E-T-6: the Metadata tab of a Core-only item shows the Core record (web parity)', () => {
  it('media NONE (a session recorded on the Core): "Core record" with the item\'s values; no claim of simulation', async () => {
    const { b, id } = await openMetadata('0002', (configured) => {
      configured.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    });
    const item = b.state().evidence.find((candidate) => candidate.id === id)!;
    expect(screen.getByTestId('evidence-metadata-record')).toBeTruthy();
    expect(textOf('evidence-metadata-none')).toBe("No DEMO package for this item: the Core server's record only.");
    expect(textOf('evidence-record-title')).toBe('Core record');
    const record = JSON.parse(textOf('evidence-record-json')) as Record<string, unknown>;
    expect(record).toMatchObject({
      record: 'CORE',
      evidenceId: id,
      sessionId: item.sessionId,
      caseNumber: item.caseNumber,
      subject: { name: item.subjectName, type: item.subjectType },
      investigatorId: item.investigatorId,
      room: item.room,
      recordedAt: toWibIso(item.recordedAt),
      status: item.status,
      manifestHash: item.manifestHash,
    });
    expect(Object.keys(record)).toEqual([
      'record',
      'note',
      'evidenceId',
      'sessionId',
      'caseNumber',
      'subject',
      'investigatorId',
      'room',
      'recordedAt',
      'endedAt',
      'sealedAt',
      'status',
      'lifecycleStage',
      'manifestHash',
      'tracks',
      'signature',
    ]);
    // The words of the tab never claim a simulation (the record's own values are the Core's data: the
    // test engine's signature happens to name its algorithm, which the web prints the same way).
    expect(record).not.toHaveProperty('simulated');
    expect(String(record.note)).not.toMatch(/simulat/i);
    expect(screen.queryAllByText(/simulat/i).filter((node) => node.props.testID !== 'evidence-record-json')).toHaveLength(0);
    expect(screen.queryByTestId('evidence-metadata')).toBeNull();
  });

  it('the Core did not answer operation 40: the record still shows, and the line says the reference is unavailable (no claim that no package exists)', async () => {
    await openMetadata('0003', (configured) => configured.fake.answerOnce('getEvidence', OUTAGE));
    expect(textOf('evidence-metadata-none')).toBe('Media reference unavailable');
    expect(textOf('evidence-record-title')).toBe('Core record');
    expect(JSON.parse(textOf('evidence-record-json'))).toMatchObject({ record: 'CORE', note: expect.stringMatching(/media reference is unavailable/) });
  });

  it('a DEMO_PACKAGE item keeps the bundled manifest (unchanged), on the phone as well', async () => {
    await openMetadata('0001', undefined, 'phonePortrait');
    expect(screen.getByTestId('evidence-metadata')).toBeTruthy();
    expect(screen.getByTestId('evidence-manifest-json')).toBeTruthy();
    expect(screen.queryByTestId('evidence-metadata-record')).toBeNull();
  });
});

describe('evidenceRecordJson (pure): the web\'s record keys, the mode\'s label', () => {
  it('Simulated mode says it is the simulator\'s record; Live mode never says so', async () => {
    const b = await renderLiveEvidence({});
    bed = b;
    const item = b.state().evidence[0]!;
    const simulated = JSON.parse(evidenceRecordJson(item, { live: false, mediaStatus: 'ready' })) as Record<string, unknown>;
    expect(simulated).toMatchObject({ simulated: true, evidenceId: item.id });
    expect(simulated).not.toHaveProperty('record');
    const live = JSON.parse(evidenceRecordJson(item, { live: true, mediaStatus: 'ready' })) as Record<string, unknown>;
    expect(live).toMatchObject({ record: 'CORE', note: "The Core server's record of this item; no DEMO package joins it." });
    expect(live).not.toHaveProperty('simulated');
    expect(String(live.note)).not.toMatch(/simulat/i);
  });
});
