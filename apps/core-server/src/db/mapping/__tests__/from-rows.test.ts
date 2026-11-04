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
import { captureConfigToRow, selectorDeviceIds } from '../rows';

const idle =(): SimState => createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED });
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

describe('capture_config: the microphones come back in input order (D106 (1), AC-B-70; D61 of 2026-11-04: the numbered channel plane)', () => {
  const stored = (state: SimState) => fromRows(asStored(toRows(state, context)));
  const swapped = (): SimState => {
    const state = idle();
    // What moving the TRANSCRIBED channel onto another device leaves in the engine state (D61: the two-role
    // lane's `setPrimaryMic` is superseded - the lines keep their CHANNELS and exchange their DEVICES), in
    // input order as the slice always holds it.
    const on = (mic: SimState['captureConfig']['mics'][number]) =>
      mic.channel === 'MIC-01' ? { ...mic, inputId: 'MIC-02', deviceId: 'MIC-02' } : mic.channel === 'MIC-02' ? { ...mic, inputId: 'MIC-01', deviceId: 'MIC-01' } : mic;
    const mics = state.captureConfig.mics.map(on).sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0));
    return { ...state, captureConfig: { ...state.captureConfig, mics } } as SimState;
  };

  it('the seeded selector: the four channels MIC-01..MIC-04 on their built-in devices (D61)', () => {
    expect(stored(idle()).captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-01', 'MIC-01'], ['MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
  });

  it('after channel 1 became MIC-02: still MIC-01, MIC-02 in the list - the device moved, the input order did not', () => {
    const state = swapped();
    expect(state.captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-01', 'MIC-02'], ['MIC-02', 'MIC-01'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
    const rows = toRows(state, context);
    // D61 (2026-11-04): the column of a line is its CHANNEL - mic_01_id holds the device of channel 1, MIC-02.
    expect([rows.captureConfig[0]?.mic01Id, rows.captureConfig[0]?.mic02Id]).toEqual(['MIC-02', 'MIC-01']);
    const back = stored(state).captureConfig;
    expect(back.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-01', 'MIC-02'], ['MIC-02', 'MIC-01'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
    // NEGATIVE CONTROL: channel-first, the order of the columns, is not what the engine holds.
    expect([...back.mics].sort((left) => (left.channel === 'MIC-01' ? -1 : 1)).map((mic) => mic.inputId)).toEqual(['MIC-02', 'MIC-01', 'MIC-03', 'MIC-04']);
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
  // D61 (2026-11-04): MIC-03 and MIC-04 are BUILT-IN rows of the nine-row seed now, so the device this suite
  // adds by hand carries a number of its own - the case is a registered interface, not a built-in channel.
  const LOCAL_MIC = { id: 'MIC-11', kind: 'MIC', model: 'Core Mac microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [], adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' };
  const withLocalMic = (state: SimState): SimState => ({ ...state, captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] } }) as unknown as SimState;
  /** MIC-11 takes the SECOND channel, with the transport the registry row gave the selector slot (D61: the line names its channel). */
  const selected = (state: SimState): SimState =>
    ({ ...state, captureConfig: { ...state.captureConfig, mics: state.captureConfig.mics.map((mic) => (mic.channel === 'MIC-02' ? { ...mic, channel: 'MIC-02', inputId: 'MIC-11', deviceId: 'MIC-11', transport: 'AVFOUNDATION' } : mic)) } }) as unknown as SimState;
  const deviceChanges = (previous: SimState, next: SimState) => diffSlices(previous, next, FIXED_NOW + 1).filter((change) => change.table === 'captureDevices');

  it('leaving the selector writes NOTHING to the device row; a later state change names its own column only', () => {
    const inSelector = selected(withLocalMic(base));
    const out = withLocalMic(base);
    expect(toRows(inSelector, context).captureDevices.find((row) => row.id === 'MIC-11')?.transport).toBe('AVFOUNDATION');
    // The selector moved back to the built-in pair: the device slice object is rebuilt, as a unit of the engine does.
    expect(deviceChanges(inSelector, { ...out, captureDevices: { devices: [...out.captureDevices.devices] } })).toEqual([]);

    const offline = { ...out, captureDevices: { devices: out.captureDevices.devices.map((device) => (device.id === 'MIC-11' ? { ...device, online: false } : device)) } } as SimState;
    expect(deviceChanges(out, offline)).toEqual([{ op: 'update', table: 'captureDevices', key: { id: 'MIC-11' }, set: { enabled: false } }]);
  });

  it('CONTROL: a selected microphone and a built-in device are still written whole, transport included', () => {
    const inSelector = selected(withLocalMic(base));
    const offline = { ...inSelector, captureDevices: { devices: inSelector.captureDevices.devices.map((device) => (device.id === 'MIC-11' || device.id === 'CAM-01' ? { ...device, online: false } : device)) } } as SimState;
    const changes = deviceChanges(inSelector, offline);
    expect(changes).toHaveLength(1);
    const [change] = changes;
    expect(change?.op).toBe('insert');
    expect(change?.op === 'insert' ? change.rows.map((row) => [(row as { id: string }).id, (row as { transport: string }).transport]) : []).toEqual([['CAM-01', 'RTSP'], ['MIC-11', 'AVFOUNDATION']]);
  });

  it('a NEW device is still inserted (with the neutral code: the column is NOT NULL)', () => {
    const changes = deviceChanges(base, withLocalMic(base));
    expect(changes.map((change) => (change.op === 'insert' ? change.rows.map((row) => [(row as { id: string }).id, (row as { transport: string }).transport]) : null))).toEqual([[['MIC-11', 'UNKNOWN']]]); // D61: the built-in MIC-03/04 ride in the base state; the hand-added row is MIC-11
  });

  // Task 4 integration pass I-7 (decision C43 (3)): the registry stores no capability, so what the
  // registration stated must be what a restart reads back - `AUDIO` for the adapter kind the action
  // `registerCaptureMicrophone` fixes, as `VIDEO` is for an adopted camera.
  it('a microphone registered by `registerCaptureMicrophone` reads back with the capability AUDIO; CONTROL: a local-device microphone keeps none', () => {
    const REGISTERED_MIC = { id: 'MIC-12', kind: 'MIC', model: 'Fixture interface', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: ['AUDIO'], adapter: 'USB_AUDIO', sourceClass: 'PRODUCTION' }; // D61: MIC-04 is a built-in row of the seed now
    const state = { ...base, captureDevices: { devices: [...base.captureDevices.devices, LOCAL_MIC, REGISTERED_MIC] } } as unknown as SimState;
    const back = fromRows(asStored(toRows(state, context))).captureDevices.devices;
    expect(back.find((device) => device.id === 'MIC-12')).toEqual(REGISTERED_MIC);
    expect(back.find((device) => device.id === 'MIC-11')).toEqual(LOCAL_MIC);
    // The built-in pair is what the seed states, unchanged.
    expect(back.filter((device) => device.id === 'MIC-01' || device.id === 'MIC-02').map((device) => device.capabilities)).toEqual([['AUDIO'], ['AUDIO']]);
  });

  // Task 4 row V7 (decisions C36, C117; the blocking request lines of row W5): the profile list a camera's row holds
  // comes back on its device entry. MUTATION SEEN RED: `captureDeviceFromRow` without the `profiles` member.
  it('row V7: a registered camera reads back with the profile list its row holds, each code with what it states; an empty or unreadable list is an empty list; the engine never writes the column', () => {
    const CAMERA = { id: 'CAM-05', kind: 'CAMERA', model: null, firmware: null, host: '192.0.2.10', poePort: null, online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' };
    const LISTED = [{ code: 'HEVC_2560X1920P', codec: 'HEVC', resolution: '2560x1920', fps: null }, { code: 'H264_720P30', codec: 'H.264', resolution: '720p', fps: 30 }];
    const state = { ...base, captureDevices: { devices: [...base.captureDevices.devices, { ...CAMERA, profiles: LISTED }] } } as unknown as SimState;
    const written = asStored(toRows(state, context));
    // The engine's row keeps the empty form whatever the entry lists: the adoption's own statement is the one writer.
    expect(written.captureDevices.find((row) => row.id === 'CAM-05')?.profiles).toEqual([]);
    const withList = (profiles: unknown) => ({ ...written, captureDevices: written.captureDevices.map((row) => (row.id === 'CAM-05' ? { ...row, profiles } : row)) });
    const cameraOf = (profiles: unknown) => fromRows(withList(profiles)).captureDevices.devices.find((device) => device.id === 'CAM-05');
    expect(cameraOf(['HEVC_2560X1920P', 'H264_720P30'])).toEqual({ ...CAMERA, profiles: LISTED });
    expect(cameraOf([])).toEqual({ ...CAMERA, profiles: [] });
    // A stored value that is no list of codes within the bound states nothing: never cut, never cleaned, no refusal of the rehydration.
    for (const stored of [['hevc_1080p'], ['HEVC_1080P', 'HEVC_1080P'], 'HEVC_1080P', null, Array.from({ length: 17 }, (_, index) => `H264_${String(100 + index)}P`)]) {
      expect(cameraOf(stored)?.profiles, JSON.stringify(stored)).toEqual([]);
    }
    // The built-in devices, the microphones and the switch state no member, as before.
    expect(fromRows(withList(['HEVC_1080P'])).captureDevices.devices.filter((device) => Object.hasOwn(device, 'profiles')).map((device) => device.id)).toEqual(['CAM-05']);
  });
});

// Fix F-M4 (review row 69, finding R69-03): the stored registry becomes the device list through the
// rule of the running capture operation. The mapping applies the rule and decides nothing itself.
describe('capture_devices: the device-list rule of the reader (R69-03)', () => {
  const rows = asStored(toRows(idle(), context));
  const ids = (slices: ReturnType<typeof fromRows>): string[] => slices.captureDevices.devices.map((device) => device.id);
  const all = ids(fromRows(rows));

  it('CONTROL - without a rule every stored device is listed, as before', () => {
    expect(all).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH']); // D60: four built-in cameras; D61 (2026-11-04): four built-in microphones
    expect(fromRows(rows, {})).toEqual(fromRows(rows));
  });

  it('a row the rule refuses is not in the slice; the rule is asked with the id, the kind and the stored adapter kind', () => {
    const asked: string[] = [];
    const slices = fromRows(
      { ...rows, captureDevices: [...rows.captureDevices, { ...rows.captureDevices.find((row) => row.kind === 'CAMERA')!, id: 'CAM-05', adapterKind: 'LOCAL_DEVICE' }] },
      { captureDeviceListing: (device) => (asked.push(`${device.id} ${device.kind} ${device.adapterKind}`), device.adapterKind !== 'LOCAL_DEVICE') },
    );
    expect(ids(slices)).toEqual(all);
    expect(asked).toContain('CAM-05 CAMERA LOCAL_DEVICE');
  });

  it('a device the selector names is never left out (its refusal is the capture fence\'s, at boot), and the selector is read against every stored row', () => {
    const slices = fromRows(rows, { captureDeviceListing: () => false });
    const named = [...slices.captureConfig.cameras.map((line) => line.deviceId), ...slices.captureConfig.mics.map((line) => line.deviceId)].sort();
    expect(ids(slices)).toEqual(named);
    expect(named).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D60: four cameras; D61: four numbered channels
  });
});

// Task 4 row 166 (WP-13a; AD-04 (2); decisions C18, C21, C25; names register E13, E17; row 27 sites
// A3, A4, A5): a selector slot may be UNASSIGNED - a NULL in the six nullable columns of schema set
// A, an ABSENT line in the slice. The mapping goes by the NAME of a line (its track - and since
// D61 of 2026-11-04 its NUMBERED CHANNEL), never by its position. Pure: the row images are written
// by hand, no database; the seeded selector stays complete and no fixture of another suite holds a NULL.
describe('capture_config: an unassigned slot is NULL in the row and an absent line in the slice (task 4 row 166)', () => {
  type Selector = SimState['captureConfig'];
  const SLOT_COLUMNS = ['video01DeviceId', 'video01Profile', 'video02DeviceId', 'video02Profile', 'video03DeviceId', 'video03Profile', 'video04DeviceId', 'video04Profile', 'mic01Id', 'mic02Id', 'mic03Id', 'mic04Id'] as const; // D60 (2026-11-04): four video pairs; D61 (2026-11-04): four numbered mic channels - twelve slot columns
  const seeded = (): Selector => idle().captureConfig;
  /** The seeded selector with only the lines of the slots named. */
  const holding = (slots: readonly string[]): Selector => {
    const selector = seeded();
    return { ...selector, cameras: selector.cameras.filter((camera) => slots.includes(camera.trackId)), mics: selector.mics.filter((mic) => slots.includes(mic.channel)) }; // D61 (2026-11-04): the slot of a mic line is its channel
  };
  const withSelector = (captureConfig: Selector): SimState => ({ ...idle(), captureConfig });
  const slotsOf = (selector: Selector): Record<string, unknown> => {
    const row: Record<string, unknown> = captureConfigToRow(selector);
    return Object.fromEntries(SLOT_COLUMNS.map((column) => [column, row[column]]));
  };
  /** The stored rows of the idle state with a selector row written by hand. */
  const storedWith = (columns: Partial<Record<(typeof SLOT_COLUMNS)[number], string | null>>) => {
    const rows = asStored(toRows(idle(), context));
    return { ...rows, captureConfig: rows.captureConfig.map((row) => ({ ...row, ...columns })) } as typeof rows;
  };
  const ALL_NULLS = Object.fromEntries(SLOT_COLUMNS.map((column) => [column, null])); // D60, D61: a row without a line is twelve NULLs
  const PROFILE = seeded().cameras[0]?.profile ?? '';

  it('GATE AD-04 (2): only VIDEO-02 and only channel MIC-02 - written with video_01_* and mic_01_id NULL, and read back as the same two lines (D61)', () => {
    const selector = holding(['VIDEO-02', 'MIC-02']);
    expect(selector.cameras.map((line) => line.trackId)).toEqual(['VIDEO-02']);
    expect(selector.mics.map((line) => line.channel)).toEqual(['MIC-02']);
    expect(slotsOf(selector)).toEqual({ video01DeviceId: null, video01Profile: null, video02DeviceId: 'CAM-02', video02Profile: PROFILE, video03DeviceId: null, video03Profile: null, video04DeviceId: null, video04Profile: null, mic01Id: null, mic02Id: 'MIC-02', mic03Id: null, mic04Id: null }); // D60, D61: every other slot NULL too

    const back = fromRows(asStored(toRows(withSelector(selector), context))).captureConfig;
    expect(back).toStrictEqual(selector);
    // The mirror image, so that neither half passes by the place of a line.
    expect(slotsOf(holding(['VIDEO-01', 'MIC-01']))).toEqual({ video01DeviceId: 'CAM-01', video01Profile: PROFILE, video02DeviceId: null, video02Profile: null, video03DeviceId: null, video03Profile: null, video04DeviceId: null, video04Profile: null, mic01Id: 'MIC-01', mic02Id: null, mic03Id: null, mic04Id: null });
    // Control: the seeded selector is written whole, as before.
    expect(slotsOf(seeded())).toEqual({ video01DeviceId: 'CAM-01', video01Profile: PROFILE, video02DeviceId: 'CAM-02', video02Profile: PROFILE, video03DeviceId: 'CAM-03', video03Profile: PROFILE, video04DeviceId: 'CAM-04', video04Profile: PROFILE, mic01Id: 'MIC-01', mic02Id: 'MIC-02', mic03Id: 'MIC-03', mic04Id: 'MIC-04' }); // D60, D61: four tracks and four channels
  });

  it('GATE AD-04 (2): a row of twelve NULLs (D60 four video pairs, D61 four channels) rehydrates to two empty lists without a throw, and names no device', () => {
    const slices = fromRows(storedWith(ALL_NULLS));
    expect(slices.captureConfig.cameras).toEqual([]);
    expect(slices.captureConfig.mics).toEqual([]);
    expect(slices.captureConfig.locked).toBe(false);
    // The registry is still read whole; with a rule that lists nothing, no slot keeps a device in.
    expect(slices.captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH']); // D60: four cameras; D61: four microphones - nine built-ins
    expect(fromRows(storedWith(ALL_NULLS), { captureDeviceListing: () => false }).captureDevices.devices).toEqual([]);
    expect([...selectorDeviceIds({ video01DeviceId: null, video02DeviceId: null, video03DeviceId: null, video04DeviceId: null, mic01Id: null, mic02Id: null, mic03Id: null, mic04Id: null } as never)]).toEqual([]);
    // And the way there: a selector without a line is twelve NULLs.
    expect(slotsOf(holding([]))).toEqual(ALL_NULLS);
  });

  it('each of the 256 selectors of eight slots (D60, D61 of 2026-11-04) goes to its own columns and comes back equal; a NULL slot names no device', () => {
    const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const; // D60, D61
    const DEVICE_COLUMN = { 'VIDEO-01': 'video01DeviceId', 'VIDEO-02': 'video02DeviceId', 'VIDEO-03': 'video03DeviceId', 'VIDEO-04': 'video04DeviceId', 'MIC-01': 'mic01Id', 'MIC-02': 'mic02Id', 'MIC-03': 'mic03Id', 'MIC-04': 'mic04Id' } as const;
    const DEVICE = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', 'VIDEO-03': 'CAM-03', 'VIDEO-04': 'CAM-04', 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' } as const;
    let checked = 0;
    for (let mask = 0; mask < 256; mask += 1) { // D60, D61: 2^8
      const held = SLOTS.filter((_slot, index) => (mask & (1 << index)) !== 0);
      const selector = holding(held);
      const row = slotsOf(selector);
      for (const slot of SLOTS) expect(row[DEVICE_COLUMN[slot]], `${held.join('+')} ${slot}`).toBe(held.includes(slot) ? DEVICE[slot] : null);
      // The pair rule of a video slot: device and profile NULL together.
      for (const pair of ['video01', 'video02', 'video03', 'video04'] as const) expect(row[`${pair}Profile`] === null, `${held.join('+')} ${pair}`).toBe(row[`${pair}DeviceId`] === null); // D60: the pair rule on all four slots
      const stored = asStored(toRows(withSelector(selector), context));
      expect(fromRows(stored).captureConfig, held.join('+')).toStrictEqual(selector);
      expect([...selectorDeviceIds(stored.captureConfig[0] as never)].sort(), held.join('+')).toEqual(held.map((slot) => DEVICE[slot]).sort());
      checked += 1;
    }
    expect(checked).toBe(256); // D60, D61
  });

  it('nothing goes by position: lines listed in the other order reach the same columns', () => {
    const selector = seeded();
    const reversed: Selector = { ...selector, cameras: [...selector.cameras].reverse(), mics: [...selector.mics].reverse() };
    expect(reversed.cameras[0]?.trackId).toBe('VIDEO-04'); // D60: four lines reversed
    expect(reversed.mics[0]?.channel).toBe('MIC-04'); // D61: four numbered channels reversed
    expect(slotsOf(reversed)).toEqual(slotsOf(selector));
    // A lone channel 1 that holds the SECOND input (MIC-02) is the mic_01_id column, not mic_02_id (D61).
    const lone: Selector = { ...selector, mics: selector.mics.filter((mic) => mic.inputId === 'MIC-02').map((mic) => ({ ...mic, channel: 'MIC-01' as const })) };
    expect(slotsOf(lone)).toMatchObject({ mic01Id: 'MIC-02', mic02Id: null });
    expect(fromRows(asStored(toRows(withSelector(lone), context))).captureConfig.mics).toStrictEqual(lone.mics);
  });

  it('the engine write of a cleared slot names the NULL columns of that slot and no other', () => {
    const before = withSelector(seeded());
    const after = withSelector(holding(['VIDEO-02', 'MIC-02']));
    expect(diffSlices(before, after, FIXED_NOW).filter((change) => change.table === 'captureConfig')).toEqual([
      // D60: three video pairs cleared; D61: every channel column but MIC-02's own.
      { op: 'update', table: 'captureConfig', key: { singleton: true }, set: { video01DeviceId: null, video01Profile: null, video03DeviceId: null, video03Profile: null, video04DeviceId: null, video04Profile: null, mic01Id: null, mic03Id: null, mic04Id: null } },
    ]);
  });

  it('a slice the columns cannot hold is refused, never trimmed: a track or a channel twice, a plane short of four, a line of neither (D60, D61)', () => {
    const selector = seeded();
    const [camera01, camera02, , camera04] = selector.cameras;
    const [channel01, channel02, channel03, channel04] = selector.mics;
    if (camera01 === undefined || camera02 === undefined || camera04 === undefined || channel01 === undefined || channel02 === undefined || channel03 === undefined || channel04 === undefined) throw new Error('the seeded selector is complete');
    const refusals: Selector[] = [
      { ...selector, cameras: [camera01, { ...camera02, trackId: 'VIDEO-01' }] },
      { ...selector, cameras: [camera01, camera02, { ...camera02, deviceId: 'CAM-03' }] },
      { ...selector, cameras: [{ ...camera01, trackId: 'VIDEO-05' as never }] },
      // D61 (2026-11-04): the microphone plane is keyed by channel - one channel twice, three channels, and a line that names no channel are all refused.
      { ...selector, mics: [channel01, { ...channel02, channel: 'MIC-01' }, channel03, channel04] },
      // (A plane short of four is NOT refused here: an absent line is an unassigned slot - see the 256 selectors above.)
      { ...selector, mics: [{ ...channel01, channel: 'MIC-05' as never }, channel02, channel03, channel04] },
      { ...selector, mics: [{ ...channel01, channel: undefined as never }, channel02, channel03, channel04] },
    ];
    for (const [index, refused] of refusals.entries()) {
      expect(() => captureConfigToRow(refused), `refusal ${index}`).toThrowError(MappingError);
      expect(() => captureConfigToRow(refused), `refusal ${index}`).toThrowError(expect.objectContaining({ code: 'ROW_SHAPE' }));
    }
  });

  it('a row the pair CHECK cannot hold, and a slot that names an unknown device, are refused as before; a NULL slot beside them is not', () => {
    const half = (columns: Parameters<typeof storedWith>[0]) => () => fromRows(storedWith(columns));
    expect(half({ video01DeviceId: null })).toThrowError(expect.objectContaining({ code: 'ROW_SHAPE', place:'capture_config.video_01_device_id' }));
    expect(half({ video02Profile: null })).toThrowError(expect.objectContaining({ code: 'ROW_SHAPE', place:'capture_config.video_02_profile' }));
    expect(half({ mic01Id: null, mic02Id: 'MIC-09' })).toThrowError(expect.objectContaining({ code: 'ROW_SHAPE', place: 'capture_config.mic_02_id' })); // D61: the column of channel 2
    expect(half({ video01DeviceId: null, video01Profile: null, video02Profile: 'h264-1080p25' })).toThrowError(expect.objectContaining({ code: 'ROW_SHAPE', place:'capture_config.video_02_profile' }));
    // Control: the same hand-written form with a whole NULL slot is read.
    expect(half({ video01DeviceId: null, video01Profile: null })().captureConfig.cameras.map((line) => line.trackId)).toEqual(['VIDEO-02', 'VIDEO-03', 'VIDEO-04']); // D60: the other three lines ride on
  });
});

// Task 4 row V7c (decision C126 (b)): a restart reads no stream - the selector line of a REGISTERED camera comes back NOT READ
// (null), as its registry entry does, whatever the engine held before; the built-in cameras keep the model's value from `enabled`.
describe('capture_config: a registered camera\'s line comes back NOT READ (row V7c)', () => {
  it('a line the engine held LIVE comes back null, as the entry; CONTROL: the built-in CAM-01 comes back LIVE, and LOST when its row is disabled', () => {
    const base = idle();
    const REGISTERED = { id: 'CAM-07', kind: 'CAMERA', model: null, firmware: null, host: '192.0.2.17', poePort: null, online: true, streamState: 'LIVE', capabilities: ['VIDEO'], adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', profiles: [] };
    const read = {
      ...base,
      captureDevices: { devices: [...base.captureDevices.devices.map((device) => (device.id === 'CAM-01' ? { ...device, online: false, streamState: 'LOST' } : device)), REGISTERED] },
      captureConfig: { ...base.captureConfig, cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: 'CAM-07', streamState: 'LIVE' } : line)) },
    } as unknown as SimState;
    const back = fromRows(asStored(toRows(read, context)));
    expect(back.captureConfig.cameras.map((line) => [line.trackId, line.deviceId, line.online, line.streamState])).toEqual([
      ['VIDEO-01', 'CAM-01', false, 'LOST'],
      ['VIDEO-02', 'CAM-07', true, null],
      // D60 (2026-11-04): the two further built-in lines come back LIVE from the model.
      ['VIDEO-03', 'CAM-03', true, 'LIVE'],
      ['VIDEO-04', 'CAM-04', true, 'LIVE'],
    ]);
    expect(back.captureDevices.devices.find((device) => device.id === 'CAM-07')?.streamState).toBeNull();
    // CONTROL: the seeded selector of the built-in pair reads back LIVE, the demonstration model's value.
    expect(fromRows(asStored(toRows(base, context))).captureConfig.cameras.map((line) => line.streamState)).toEqual(['LIVE', 'LIVE', 'LIVE', 'LIVE']); // D60: four built-in lines
  });
});
