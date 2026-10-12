// The way back of the rows this task changed (blueprint row 129b): the three sealed columns of an
// evidence item (request of row 79) and the order of the two microphone lines of the selector
// (request of row 66, decision D106 (1), AC-B-70). Pure: no database.
import { DEFAULT_SEED, EVIDENCE_NOT_SEALED_DIGEST, EVIDENCE_NOT_SEALED_SIGNATURE, createIdleState, hasSealedValues, type EvidenceItem, type SimState } from '@dems/shared/sim';
import { EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE, EvidenceItemSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { FIXED_NOW, asStored } from '../../../../test/support/seed';
import {
  MappingError,
  evidenceCustodyToRows,
  evidenceItemFromRows,
  evidenceItemToRow,
  diffSlices,
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

// Fix wave J (decision D243; truth rule 3a; BLOCKER JA2-01 / JW-01): a row with `sealed_at` NULL is a recording that was
// never sealed. The table needs a manifest hash and a signature in every row, and a database that is KEPT holds rows
// written before the wave with the whole integrity block of a seal (lane 2 is never reset): what leaves the store has none.
describe('evidence_items: a row that was never sealed comes back without any sealed value (fix wave J)', () => {
  const state = idle();
  const sealed = state.evidence.find((entry) => entry.sealedAt !== null) as EvidenceItem;
  const recorded = state.evidence.find((entry) => entry.sealedAt === null) as EvidenceItem;

  it('a row written BEFORE the wave - four track rows, a manifest hash, a signature, a stored PASS - is answered with none of them', () => {
    // The old shape: the unsealed item built like a seal, verified once (what the simulator did until wave J).
    const old: EvidenceItem = { ...recorded, tracks: sealed.tracks, manifestHash: sealed.manifestHash, signature: sealed.signature, verification: { status: 'PASS', at: FIXED_NOW }, tampered: true, tamperedTrackId: 'AUDIO-02' };
    const row = evidenceItemToRow(old, context);
    expect([row.sealedAt, row.manifestHash, row.verificationStatus]).toEqual([null, sealed.manifestHash, 'PASS']);
    const back = evidenceItemFromRows(row, evidenceTracksToRows(old), evidenceCustodyToRows(old));
    expect(back).toMatchObject({ sealedAt: null, status: 'RECORDED', tracks: [], manifestHash: EVIDENCE_NOT_SEALED_DIGEST, signature: EVIDENCE_NOT_SEALED_SIGNATURE, verification: { status: 'NOT_RUN', at: null }, tampered: false, tamperedTrackId: null });
    expect(hasSealedValues(back)).toBe(false);
    // Not one hash of the stored integrity block is in the answer.
    expect((JSON.stringify(back).match(/[0-9a-f]{64}/g) ?? []).filter((hex) => hex !== EVIDENCE_NOT_SEALED_DIGEST)).toEqual([]);
    // What is not a sealed value comes back as stored: the custody chain, the times, the sizes.
    expect(back).toMatchObject({ id: old.id, sessionId: old.sessionId, custody: old.custody, recordedAt: old.recordedAt, endedAt: old.endedAt, sizeBytes: old.sizeBytes });
  });

  it('the item the seed writes NOW already has that shape: no track row, the null digest, and toRow(fromRow(row)) is the same row', () => {
    expect(recorded).toMatchObject({ tracks: [], manifestHash: EVIDENCE_NOT_SEALED_DIGEST, signature: EVIDENCE_NOT_SEALED_SIGNATURE });
    expect(evidenceTracksToRows(recorded)).toEqual([]);
    const row = evidenceItemToRow(recorded, context);
    const back = evidenceItemFromRows(row, [], evidenceCustodyToRows(recorded));
    expect(back).toEqual(recorded);
    expect(evidenceItemToRow(back, context)).toEqual(row);
  });

  it('CONTROL - a SEALED row comes back with every sealed value it holds', () => {
    const back = evidenceItemFromRows(evidenceItemToRow(sealed, context), evidenceTracksToRows(sealed), evidenceCustodyToRows(sealed));
    expect(back).toEqual(sealed);
    expect(hasSealedValues(back)).toBe(true);
    expect(back.tracks).toHaveLength(4);
    expect(back.manifestHash).not.toBe(EVIDENCE_NOT_SEALED_DIGEST);
  });

  it('fix wave J round two (JW-13): the markers and the notes of a SEALED item are stored with it and come back whole - the form\'s note with its origin - and a never-sealed item keeps them too', () => {
    for (const base of [sealed, recorded]) {
      const annotated: EvidenceItem = { ...base, markers: [...EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers], notes: EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.notes.map((note) => ({ ...note })) };
      const row = evidenceItemToRow(annotated, context);
      // What the Core stored for the session: the two lists as they are, in the item's own row (no other table, no column added).
      expect(row.markers).toEqual(EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers);
      expect(row.notes).toEqual(EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.notes);
      const back = evidenceItemFromRows(row, evidenceTracksToRows(annotated), evidenceCustodyToRows(annotated));
      expect(back.markers).toEqual(EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers);
      expect(back.notes).toEqual(EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.notes);
      expect(back.notes?.[0]).toMatchObject({ id: 'NOTE-FORM', origin: 'SESSION_FORM' });
      expect(EvidenceItemSchema.safeParse(back).success).toBe(true);
    }
    // CONTROL: an item whose session had none comes back with two empty lists, never with another item's.
    expect(evidenceItemFromRows(evidenceItemToRow(sealed, context), evidenceTracksToRows(sealed), evidenceCustodyToRows(sealed)).notes).toEqual(sealed.notes ?? []);
  });

  it('the whole state comes back equal through fromRows: the never-sealed item is no difference to write (a kept database is never rewritten)', () => {
    const back = fromRows(asStored(toRows(state, context)));
    expect(back.evidence).toEqual(state.evidence);
    expect(diffSlices(state as never, { ...state, evidence: back.evidence } as never, FIXED_NOW)).toEqual([]);
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

// ── Integration pass D4 (controller decision D147; findings F-82-3 and F-82-4 of row 82) ────────

describe('evidence_items.development_sources: the seal\'s mark travels both ways (F-82-3)', () => {
  const base = idle().evidence[0] as EvidenceItem;
  const back = (item: EvidenceItem): EvidenceItem => evidenceItemFromRows(evidenceItemToRow(item, context), evidenceTracksToRows(item), evidenceCustodyToRows(item));

  it('true, false and "not recorded" are three stored values; NULL never comes back as false', () => {
    expect(evidenceItemToRow({ ...base, developmentSources: true }, context).developmentSources).toBe(true);
    expect(evidenceItemToRow({ ...base, developmentSources: false }, context).developmentSources).toBe(false);
    expect(evidenceItemToRow({ ...base, developmentSources: null }, context).developmentSources).toBeNull();
    expect(evidenceItemToRow(base, context).developmentSources).toBeNull();

    expect(back({ ...base, developmentSources: true }).developmentSources).toBe(true);
    expect(back({ ...base, developmentSources: false }).developmentSources).toBe(false);
    // A v1 item (and the simulator's own seal): the member is ABSENT on the way back, not false.
    expect('developmentSources' in back(base)).toBe(false);
    expect('developmentSources' in back({ ...base, developmentSources: null })).toBe(false);
  });

  it('toRow(fromRow(row)) is the same row for the three values; another value is refused', () => {
    for (const developmentSources of [true, false, null]) {
      const row = { ...evidenceItemToRow(base, context), developmentSources };
      expect(evidenceItemToRow(evidenceItemFromRows(row, evidenceTracksToRows(base), evidenceCustodyToRows(base)), context)).toEqual(row);
    }
    expect(() => evidenceItemToRow({ ...base, developmentSources: 'yes' as unknown as boolean }, context)).toThrow(MappingError);
  });
});

describe('evidence_items: the item of a REAL v2 seal comes back with its real signature (F-82-4)', () => {
  const v1 = ((): EvidenceItem => {
    const { transcriptSha256: _hash, files: _files, fragmentChainHead: _head, ...rest } = idle().evidence[0] as EvidenceItem;
    return rest;
  })();
  const SIGNATURE = 'cd'.repeat(64);
  /** What `completeSealTransition` puts on the item: two camera files as tracks, no `files`, the pipeline's signature. */
  const real: EvidenceItem = {
    ...v1,
    integritySource: 'REAL',
    tracks: [
      { trackId: 'VIDEO-01', label: 'Camera 1', sizeBytes: 4_000, sha256: '01'.repeat(32) },
      { trackId: 'VIDEO-02', label: 'Camera 2', sizeBytes: 5_000, sha256: '02'.repeat(32) },
    ],
    signature: { value: SIGNATURE, keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
    manifestVersion: 2,
    transcriptSha256: null,
    labelsStatus: null,
    developmentSources: true,
  } as EvidenceItem;
  const row = evidenceItemToRow(real, context);
  const back = (columns: Partial<typeof row> = {}): EvidenceItem => evidenceItemFromRows({ ...row, ...columns }, evidenceTracksToRows(real), evidenceCustodyToRows(real));

  it('the row is the real pair, and the item comes back equal: signature, two tracks, no files, the sealed members', () => {
    expect(row).toMatchObject({ integritySource: 'REAL', manifestVersion: 2, signatureAlgorithm: 'Ed25519', signatureSimulated: false, signatureValue: SIGNATURE, developmentSources: true });
    const found = back();
    expect(found.signature).toEqual({ value: SIGNATURE, keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false });
    expect(found.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
    expect('files' in found).toBe(false);
    expect(found).toMatchObject({ integritySource: 'REAL', manifestVersion: 2, transcriptSha256: null, labelsStatus: null, developmentSources: true });
    expect(evidenceItemToRow(found, context)).toEqual(row);
  });

  it('NOT LOOSENED FOR V1: a real signature on a row that is not REAL, or not version 2, is refused', () => {
    expect(() => back({ integritySource: 'SIMULATED' })).toThrow(MappingError);
    expect(() => back({ integritySource: null })).toThrow(MappingError);
    expect(() => back({ manifestVersion: 1 })).toThrow(MappingError);
    // A demo row: refused unless it is the row of a SEED-SEALED item (the next case) - without the development mark, or at version 1, it is not one.
    expect(() => back({ integritySource: 'DEMO_PACKAGE', developmentSources: null })).toThrow(MappingError);
    expect(() => back({ integritySource: 'DEMO_PACKAGE', developmentSources: false })).toThrow(MappingError);
    expect(() => back({ integritySource: 'DEMO_PACKAGE', manifestVersion: 1 })).toThrow(MappingError);
    expect(() => back({ integritySource: 'SIMULATED', developmentSources: true })).toThrow(MappingError);
  });

  it('PASS E3 - THE ONE OTHER WRITER: the row of a seed-sealed demo item (DEMO_PACKAGE, version 2, development sources) comes back with its real signature, byte-stable', () => {
    const demo = back({ integritySource: 'DEMO_PACKAGE', tampered: true, tamperedTrackId: 'VIDEO-02' });
    expect(demo.signature).toEqual({ value: SIGNATURE, keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false });
    expect(demo).toMatchObject({ integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, tampered: true, tamperedTrackId: 'VIDEO-02' });
    expect(demo.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
    expect(evidenceItemToRow(demo, context)).toEqual({ ...row, integritySource: 'DEMO_PACKAGE', tampered: true, tamperedTrackId: 'VIDEO-02' });
  });

  it('refuses every other pair: Ed25519 marked simulated, the stand-in marked real, a short value, another algorithm', () => {
    expect(() => back({ signatureSimulated: true })).toThrow(MappingError);
    expect(() => back({ signatureAlgorithm: 'SIMULATED-SHA256' })).toThrow(MappingError);
    expect(() => back({ signatureValue: 'cd'.repeat(32) })).toThrow(MappingError);
    expect(() => back({ signatureAlgorithm: 'ECDSA-P256-SHA256' })).toThrow(MappingError);
  });

  it('CONTROL: the simulated stand-in of a v1 item still comes back as it did', () => {
    const stored = evidenceItemToRow(v1, context);
    const found = evidenceItemFromRows(stored, evidenceTracksToRows(v1), evidenceCustodyToRows(v1));
    expect(found.signature).toEqual(v1.signature);
    expect(found.signature.simulated).toBe(true);
  });
});

describe('capture_devices: a device the state holds no transport for keeps the registry\'s (pass D4)', () => {
  const base = idle();
  const LOCAL_MIC = { id: 'MIC-03', kind: 'MIC', model: 'Core Mac microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [], adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' };
  const withLocalMic = (state: SimState): SimState => ({ ...state, captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] } }) as unknown as SimState;
  /** MIC-03 replaces MIC-02 as the STANDBY, with the transport the registry row gave the selector slot. */
  const selected = (state: SimState): SimState =>
    ({ ...state, captureConfig: { ...state.captureConfig, mics: [state.captureConfig.mics[0], { inputId: 'MIC-03', deviceId: 'MIC-03', role: 'STANDBY', transport: 'AVFOUNDATION', online: true }] } }) as unknown as SimState;
  const deviceChanges = (previous: SimState, next: SimState) => diffSlices(previous, next, FIXED_NOW + 1).filter((change) => change.table === 'captureDevices');

  it('leaving the selector writes NOTHING to the device row; a later state change names its own column only', () => {
    const inSelector = selected(withLocalMic(base));
    const out = withLocalMic(base);
    expect(toRows(inSelector, context).captureDevices.find((row) => row.id === 'MIC-03')?.transport).toBe('AVFOUNDATION');
    // The selector moved back to the built-in pair: the device slice object is rebuilt, as a unit of the engine does.
    expect(deviceChanges(inSelector, { ...out, captureDevices: { devices: [...out.captureDevices.devices] } })).toEqual([]);

    const offline = { ...out, captureDevices: { devices: out.captureDevices.devices.map((device) => (device.id === 'MIC-03' ? { ...device, online: false } : device)) } } as SimState;
    expect(deviceChanges(out, offline)).toEqual([{ op: 'update', table: 'captureDevices', key: { id: 'MIC-03' }, set: { enabled: false } }]);
  });

  it('CONTROL: a selected microphone and a built-in device are still written whole, transport included', () => {
    const inSelector = selected(withLocalMic(base));
    const offline = { ...inSelector, captureDevices: { devices: inSelector.captureDevices.devices.map((device) => (device.id === 'MIC-03' || device.id === 'CAM-01' ? { ...device, online: false } : device)) } } as SimState;
    const changes = deviceChanges(inSelector, offline);
    expect(changes).toHaveLength(1);
    const [change] = changes;
    expect(change?.op).toBe('insert');
    expect(change?.op === 'insert' ? change.rows.map((row) => [(row as { id: string }).id, (row as { transport: string }).transport]) : []).toEqual([['CAM-01', 'RTSP'], ['MIC-03', 'AVFOUNDATION']]);
  });

  it('a NEW device is still inserted (with the neutral code: the column is NOT NULL)', () => {
    const changes = deviceChanges(base, withLocalMic(base));
    expect(changes.map((change) => (change.op === 'insert' ? change.rows.map((row) => [(row as { id: string }).id, (row as { transport: string }).transport]) : null))).toEqual([[['MIC-03', 'UNKNOWN']]]);
  });
});

// Fix F-M4 (review row 69, finding R69-03): the stored registry becomes the device list through the
// rule of the running capture operation. The mapping applies the rule and decides nothing itself.
describe('capture_devices: the device-list rule of the reader (R69-03)', () => {
  const rows = asStored(toRows(idle(), context));
  const ids = (slices: ReturnType<typeof fromRows>): string[] => slices.captureDevices.devices.map((device) => device.id);
  const all = ids(fromRows(rows));

  it('CONTROL - without a rule every stored device is listed, as before', () => {
    expect(all).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
    expect(fromRows(rows, {})).toEqual(fromRows(rows));
  });

  it('a row the rule refuses is not in the slice; the rule is asked with the id, the kind and the stored adapter kind', () => {
    const asked: string[] = [];
    const slices = fromRows(
      { ...rows, captureDevices: [...rows.captureDevices, { ...rows.captureDevices.find((row) => row.kind === 'CAMERA')!, id: 'CAM-03', adapterKind: 'LOCAL_DEVICE' }] },
      { captureDeviceListing: (device) => (asked.push(`${device.id} ${device.kind} ${device.adapterKind}`), device.adapterKind !== 'LOCAL_DEVICE') },
    );
    expect(ids(slices)).toEqual(all);
    expect(asked).toContain('CAM-03 CAMERA LOCAL_DEVICE');
  });

  it('a device the selector names is never left out (its refusal is the capture fence\'s, at boot), and the selector is read against every stored row', () => {
    const slices = fromRows(rows, { captureDeviceListing: () => false });
    const named = [...slices.captureConfig.cameras.map((line) => line.deviceId), ...slices.captureConfig.mics.map((line) => line.deviceId)].sort();
    expect(ids(slices)).toEqual(named);
    expect(named).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
  });
});
