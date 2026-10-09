// The way back of the rows this task changed (blueprint row 129b): the three sealed columns of an
// evidence item (request of row 79) and the order of the two microphone lines of the selector
// (request of row 66, decision D106 (1), AC-B-70). Pure: no database.
import { DEFAULT_SEED, createIdleState, type EvidenceItem, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { FIXED_NOW, asStored } from '../../../../test/support/seed';
import {
  MappingError,
  evidenceCustodyToRows,
  evidenceItemFromRows,
  evidenceItemToRow,
  evidenceTracksToRows,
  fromRows,
  toRows,
  type RowContext,
  type SealedEvidenceItem,
} from '..';

const idle = (): SimState => createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED });
const context: RowContext = { at: FIXED_NOW, seededAt: FIXED_NOW, lastResetAt: null };
const HASH = 'cd'.repeat(32);

describe('evidence_items: the sealed columns come back as the item carried them', () => {
  const item = ((): EvidenceItem => {
    const { transcriptSha256: _hash, ...rest } = idle().evidence[0] as EvidenceItem;
    return rest;
  })();
  const row = evidenceItemToRow(item, context);
  const back = (columns: Partial<typeof row>): SealedEvidenceItem =>
    evidenceItemFromRows({ ...row, ...columns }, evidenceTracksToRows(item), evidenceCustodyToRows(item));
  const members = (found: SealedEvidenceItem): Record<string, unknown> =>
    Object.fromEntries(Object.entries(found).filter(([key]) => ['manifestVersion', 'transcriptSha256', 'labelsStatus'].includes(key)));

  it('(1, NULL, NULL): a v1 item gets no member back', () => {
    expect(members(back({ manifestVersion: 1, transcriptSha256: null, labelsStatus: null }))).toEqual({});
  });

  it('(2, hash, labels): the seal\'s three columns come back - the speaker state is not dropped', () => {
    expect(members(back({ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' }))).toEqual({ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' });
    expect(members(back({ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'LABELLED' }))).toEqual({ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'LABELLED' });
  });

  it('(2, NULL, NULL): a v2 item sealed with STT disabled stays version 2, with a null hash', () => {
    expect(members(back({ manifestVersion: 2, transcriptSha256: null, labelsStatus: null }))).toEqual({ manifestVersion: 2, transcriptSha256: null, labelsStatus: null });
  });

  it('(2, hash, NULL): an item that only binds a hash comes back with the hash alone, as before', () => {
    expect(members(back({ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: null }))).toEqual({ transcriptSha256: HASH });
  });

  it('toRow(fromRow(row)) is the same row for every shape the mapping writes', () => {
    for (const columns of [
      { manifestVersion: 1, transcriptSha256: null, labelsStatus: null },
      { manifestVersion: 2, transcriptSha256: HASH, labelsStatus: null },
      { manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'LABELLED' },
      { manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' },
      { manifestVersion: 2, transcriptSha256: null, labelsStatus: null },
    ] as const) {
      expect(evidenceItemToRow(back(columns), context)).toEqual({ ...row, ...columns });
    }
  });

  it('refuses a row no seal wrote: version 1 with a hash or a speaker state, a speaker state without a hash, another version', () => {
    for (const columns of [
      { manifestVersion: 1, transcriptSha256: HASH, labelsStatus: null },
      { manifestVersion: 1, transcriptSha256: null, labelsStatus: 'LABELLED' },
      { manifestVersion: 2, transcriptSha256: null, labelsStatus: 'LABELLED' },
      { manifestVersion: 3, transcriptSha256: null, labelsStatus: null },
    ] as const) {
      expect(() => back(columns)).toThrow(MappingError);
    }
  });
});

describe('capture_config: the microphones come back in input order (D106 (1), AC-B-70)', () => {
  const stored = (state: SimState) => fromRows(asStored(toRows(state, context)));
  const swapped = (): SimState => {
    const state = idle();
    // What `setPrimaryMic(MIC-02)` leaves in the engine state: the same two lines, in input order,
    // with the roles exchanged.
    return { ...state, captureConfig: { ...state.captureConfig, mics: state.captureConfig.mics.map((mic) => ({ ...mic, role: mic.role === 'PRIMARY' ? 'STANDBY' : 'PRIMARY' })) } } as SimState;
  };

  it('the seeded selector: MIC-01 (PRIMARY), MIC-02 (STANDBY)', () => {
    expect(stored(idle()).captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-01', 'PRIMARY'], ['MIC-02', 'STANDBY']]);
  });

  it('after MIC-02 became the PRIMARY: still MIC-01, MIC-02 - the role moved, the order did not', () => {
    const state = swapped();
    expect(state.captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-01', 'STANDBY'], ['MIC-02', 'PRIMARY']]);
    const rows = toRows(state, context);
    expect([rows.captureConfig[0]?.micPrimaryId, rows.captureConfig[0]?.micStandbyId]).toEqual(['MIC-02', 'MIC-01']);
    const back = stored(state).captureConfig;
    expect(back.mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-01', 'STANDBY'], ['MIC-02', 'PRIMARY']]);
    // NEGATIVE CONTROL: primary-first, the order before this row, is not what the engine holds.
    expect([...back.mics].sort((left) => (left.role === 'PRIMARY' ? -1 : 1)).map((mic) => mic.inputId)).toEqual(['MIC-02', 'MIC-01']);
    expect(back.mics).toStrictEqual(state.captureConfig.mics);
  });
});
