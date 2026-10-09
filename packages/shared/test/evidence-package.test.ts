// Evidence package v2 (blueprint row 83; evidence package spec §A, §B, §B.10, §B.12, §C.1).
// The schema, the canonical form, the manifest's own hash, fragments.json and the source class.
// Real signatures over these digests are tested in the Core (`capture/signer/__tests__`).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SOURCE_SLOTS,
  EXAMPLE_SOURCE_ROWS,
  EvidencePackageError,
  FRAGMENT_CHAIN_GENESIS,
  MANIFEST_SIGNATURE_EXCLUSIONS,
  MANIFEST_V2_FIELDS,
  MANIFEST_V2_SCHEMA_ID,
  ManifestV2ExportBlockSchema,
  ManifestV2Schema,
  PackageFile,
  UnsignedManifestV2Schema,
  attachSignature,
  buildUnsignedManifest,
  cameraFilePath,
  canonicalJson,
  computeManifestSha256,
  declaredPackageFiles,
  detachedSignatureOf,
  exampleManifestInput,
  fileTimeMsOfTapSample,
  fragmentsJsonMatchesManifest,
  manifestCanonicalBody,
  manifestHashMatches,
  manifestSignedMessage,
  manifestSourceClassOfAdapterKind,
  nextFragmentChainHash,
  packageFolderName,
  parseDetachedSignature,
  parseFragmentsJson,
  parseManifestV2,
  serializeDetachedSignature,
  serializeFragmentsJson,
  serializeManifest,
  sessionSourceClasses,
  type ManifestV2,
  type SessionCaptureSourceRow,
} from '../src/evidence-package';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** A filler signature of the right length: this file tests form and hash, not signing. */
const FILLER_SIGNATURE = new Uint8Array(64).fill(0xab);
const sealedExample = (rows: readonly SessionCaptureSourceRow[] = EXAMPLE_SOURCE_ROWS): ManifestV2 =>
  attachSignature(buildUnsignedManifest(exampleManifestInput(), rows), FILLER_SIGNATURE);

/** Fields that are one value although they are objects (spec §B.7a field 123, §B.8 field 100). */
const OPAQUE = new Set(['transcript.configSnapshot', 'sealing.steps[].checkpoint']);

/** The leaf paths of a value, `[]` for "each record"; arrays of scalars are one leaf. */
function leafPaths(value: Json, path = ''): string[] {
  if (OPAQUE.has(path) || value === null || typeof value !== 'object') return [path];
  if (Array.isArray(value)) {
    const records = value.filter((entry) => entry !== null && typeof entry === 'object');
    if (records.length === 0) return [path];
    return [...new Set(records.flatMap((entry) => leafPaths(entry, `${path}[]`)))];
  }
  return Object.entries(value).flatMap(([key, member]) => leafPaths(member, path === '' ? key : `${path}.${key}`));
}

/** Every concrete location of a field path in a value: `tracks[].file` -> two locations. */
function locations(root: Json, fieldPath: string): { holder: Record<string, Json>; key: string; where: string }[] {
  const steps = fieldPath.split('.');
  let holders: { value: Json; where: string }[] = [{ value: root, where: '' }];
  steps.forEach((step, index) => {
    const each = step.endsWith('[]');
    const key = each ? step.slice(0, -2) : step;
    if (index === steps.length - 1 && !each) return;
    holders = holders.flatMap(({ value, where }) => {
      const member = (value as Record<string, Json>)[key] as Json;
      const next = `${where}${where ? '.' : ''}${key}`;
      return each ? (member as Json[]).map((entry, position) => ({ value: entry, where: `${next}[${position}]` })) : [{ value: member, where: next }];
    });
  });
  const last = steps[steps.length - 1] ?? '';
  return holders.map(({ value, where }) => ({ holder: value as Record<string, Json>, key: last, where: `${where}${where ? '.' : ''}${last}` }));
}

/** A different value of the same kind (one byte of difference where the kind allows it). */
function altered(value: Json): Json {
  if (value === null) return 0;
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'string') return `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
  if (Array.isArray(value)) return [...value, 'X'];
  return { ...value, x: 1 };
}

const sealedFields = MANIFEST_V2_FIELDS.filter((field) => field.block === 'sealed');
const exportFields = MANIFEST_V2_FIELDS.filter((field) => field.block === 'export');

describe('layout (spec §A.1, §A.2)', () => {
  it('names the package folder and its files', () => {
    expect(packageFolderName('SES-20261009-0001')).toBe('SESSION-SES-20261009-0001');
    expect(cameraFilePath('VIDEO-02')).toBe('fragments/VIDEO-02.mp4');
    expect(declaredPackageFiles({ transcript: true })).toEqual([
      'session-manifest.json',
      'signature.sig',
      'device-certificate.pem',
      'fragments/VIDEO-01.mp4',
      'fragments/VIDEO-02.mp4',
      'fragments/fragments.json',
      'transcript/transcript.json',
      'transcript/transcript.srt',
      'transcript/transcript.vtt',
      'transcript/transcript-revisions.json',
      'audit-session-extract.jsonl',
    ]);
    expect(declaredPackageFiles({ transcript: false }).some((file) => file.startsWith('transcript/'))).toBe(false);
  });
});

describe('the 128 field definitions (spec §B, erratum PE-124-05)', () => {
  it('are 128, numbered 1..128 without a gap: 119 in the sealed manifest and 9 in the export block', () => {
    expect(MANIFEST_V2_FIELDS.map((field) => field.n)).toEqual(Array.from({ length: 128 }, (_, index) => index + 1));
    expect(new Set(MANIFEST_V2_FIELDS.map((field) => field.path)).size).toBe(128);
    expect(sealedFields).toHaveLength(119);
    expect(exportFields.map((field) => field.n)).toEqual([112, 113, 114, 115, 116, 117, 118, 119, 120]);
  });

  it('the sealed fields are exactly the members a complete manifest has, and the schema accepts it', () => {
    const manifest = sealedExample();
    expect(ManifestV2Schema.safeParse(manifest).success).toBe(true);
    expect(leafPaths(manifest as unknown as Json).sort()).toEqual(sealedFields.map((field) => field.path).sort());
  });

  it('the export fields are exactly the members of the export block', () => {
    const block = {
      exportId: 'EXP-20261009-0001',
      exportedAt: 1,
      exportedBy: 'OP-0001',
      authorizationRef: 'AUTH-1',
      derived: false,
      composite: { included: false, encoder: null, sha256: null },
      manifestSha256: 'a'.repeat(64),
    };
    expect(ManifestV2ExportBlockSchema.safeParse(block).success).toBe(true);
    expect(leafPaths({ export: block } as Json).sort()).toEqual(exportFields.map((field) => field.path).sort());
    expect(ManifestV2ExportBlockSchema.safeParse({ ...block, extra: 1 }).success).toBe(false);
  });

  it('the sealed manifest refuses an export block: the export carries the manifest unchanged (§G.2)', () => {
    expect(ManifestV2Schema.safeParse({ ...sealedExample(), export: {} }).success).toBe(false);
  });
});

describe('the schema is strict', () => {
  it.each(sealedFields.map((field) => [field.n, field.path] as const))('field %i %s: a manifest without it is refused', (_n, path) => {
    const manifest = clone(sealedExample()) as unknown as Json;
    const places = locations(manifest, path);
    expect(places.length).toBeGreaterThan(0);
    // Remove it at ONE place (the first record), to show that one missing member is enough.
    const first = places[0];
    if (first === undefined) throw new Error('no location');
    expect(first.key in first.holder, first.where).toBe(true);
    delete first.holder[first.key];
    expect(ManifestV2Schema.safeParse(manifest).success, first.where).toBe(false);
  });

  it('an extra member is refused in every object of the manifest', () => {
    const manifest = clone(sealedExample()) as unknown as Json;
    const objects: { holder: Record<string, Json>; where: string }[] = [];
    const walk = (value: Json, where: string): void => {
      if (value === null || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, `${where}[${index}]`));
      // The checkpoint is a free JSON record by definition (field 100).
      if (/sealing\.steps\[\d+\]\.checkpoint$/.test(where)) return;
      objects.push({ holder: value, where });
      for (const [key, member] of Object.entries(value)) walk(member, where === '' ? key : `${where}.${key}`);
    };
    walk(manifest, '');
    // root, timeline, timeSource, device, device.certificate, operator, subject, 2 tracks, audio,
    // 2 intervals, 2 files, 4 fragments, transcript and its 3 objects, sealing, 3 steps,
    // signature, signature.certificate.
    expect(objects).toHaveLength(28);
    for (const { holder, where } of objects) {
      holder.unexpected = 1;
      expect(ManifestV2Schema.safeParse(manifest).success, where).toBe(false);
      delete holder.unexpected;
    }
    expect(ManifestV2Schema.safeParse(manifest).success).toBe(true);
  });

  it('refuses another schema id, version 1 and a v1 manifest', () => {
    const manifest = sealedExample();
    expect(ManifestV2Schema.safeParse({ ...manifest, schema: 'dems.evidence-manifest/1' }).success).toBe(false);
    expect(ManifestV2Schema.safeParse({ ...manifest, manifestVersion: 1 }).success).toBe(false);
    expect(MANIFEST_V2_SCHEMA_ID).toBe('dems.evidence-manifest/2');
  });

  it('holds the rules between fields', () => {
    const refused = (change: (manifest: ManifestV2) => void): boolean => {
      const manifest = clone(sealedExample());
      change(manifest);
      return !ManifestV2Schema.safeParse(manifest).success;
    };
    expect(refused(() => undefined)).toBe(false);
    expect(refused((m) => void m.tracks.pop())).toBe(true);
    expect(refused((m) => void m.tracks.reverse())).toBe(true);
    expect(refused((m) => void ((m.tracks[0] as ManifestV2['tracks'][number]).file = 'VIDEO-02.mp4'))).toBe(true);
    expect(refused((m) => void m.files.reverse())).toBe(true);
    expect(refused((m) => void ((m.tracks[0] as ManifestV2['tracks'][number]).firstVideoSampleTimescale = null))).toBe(true);
    expect(refused((m) => void (m.timeline.stoppedAt = null))).toBe(true);
    expect(refused((m) => { m.timeline.stoppedAt = null; m.timeline.interrupted = true; })).toBe(false);
    expect(refused((m) => void (m.signature.simulated = true))).toBe(true);
    expect(refused((m) => void (m.signature.value = 'ab'.repeat(32)))).toBe(true);
    expect(refused((m) => void (m.signature.value = 'AB'.repeat(64)))).toBe(true);
    expect(refused((m) => void (m.transcript.sha256 = null))).toBe(true);
    expect(refused((m) => void (m.transcript.disabledReason = 'DISABLED_BY_CONFIGURATION'))).toBe(true);
  });

  it('a disabled transcript is a declared absence: null in fields 79-91 and 93-94 (§B.7a)', () => {
    const input = exampleManifestInput();
    input.transcript = {
      file: null,
      docVersion: null,
      sha256: null,
      srtSha256: null,
      vttSha256: null,
      model: { name: null, version: null, quantisation: null, modelSha256: null },
      diarization: { numSpeakers: null, status: null, confidence: null },
      speakerState: null,
      state: 'DISABLED',
      failedChunks: null,
      revisionHead: null,
      disabledReason: 'DISABLED_BY_CONFIGURATION',
      backendUnreachable: false,
      configSnapshot: { enabled: false, backend: 'cpu-local', model: 'example-model', diarization: true, revision: 2 },
    };
    const unsigned = buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS);
    expect(unsigned.transcript.state).toBe('DISABLED');
    expect(UnsignedManifestV2Schema.safeParse({ ...unsigned, transcript: { ...unsigned.transcript, sha256: 'a'.repeat(64) } }).success).toBe(false);
    expect(UnsignedManifestV2Schema.safeParse({ ...unsigned, transcript: { ...unsigned.transcript, disabledReason: null } }).success).toBe(false);
  });

  it('the configuration snapshot holds five members and nothing credential-shaped (E-31)', () => {
    const manifest = clone(sealedExample());
    for (const extra of ['endpoint', 'credentialRef', 'apiKey']) {
      const snapshot = { ...manifest.transcript.configSnapshot, [extra]: 'x' };
      expect(ManifestV2Schema.safeParse({ ...manifest, transcript: { ...manifest.transcript, configSnapshot: snapshot } }).success, extra).toBe(false);
    }
  });
});

describe('canonical JSON (spec §B, §B.10)', () => {
  it('is the same text whatever the key order, at every depth', () => {
    const manifest = sealedExample();
    const reversed = (value: Json): Json =>
      value === null || typeof value !== 'object'
        ? value
        : Array.isArray(value)
          ? value.map(reversed)
          : Object.fromEntries(Object.entries(value).reverse().map(([key, member]) => [key, reversed(member)]));
    const shuffled = reversed(manifest as unknown as Json);
    expect(Object.keys(shuffled as object)).not.toEqual(Object.keys(manifest));
    expect(canonicalJson(shuffled)).toBe(canonicalJson(manifest));
    expect(computeManifestSha256(shuffled)).toBe(manifest.manifestSha256);
    // And through a text round trip.
    expect(canonicalJson(JSON.parse(JSON.stringify(shuffled, null, 2)))).toBe(canonicalJson(manifest));
  });

  it('sorts keys, writes no white space, keeps array order, encodes UTF-8', () => {
    expect(canonicalJson({ b: [3, 1, 2], a: { d: null, c: 'é' }, A: true })).toBe('{"A":true,"a":{"c":"é","d":null},"b":[3,1,2]}');
    expect(canonicalJson({ n: [1, -0, 0.5, 1e21, 1791500000000] })).toBe('{"n":[1,0,0.5,1e+21,1791500000000]}');
    expect([...serializeManifest({ a: 'é' })]).toEqual([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0xa9, 0x22, 0x7d]);
  });

  it('refuses what has no canonical form, naming the member', () => {
    const cases: [unknown, string][] = [
      [{ a: undefined }, 'a'],
      [{ a: { b: Number.NaN } }, 'a.b'],
      [{ a: [1, Number.POSITIVE_INFINITY] }, 'a[1]'],
      [{ a: 1n }, 'a'],
      [{ a: new Date(0) }, 'a'],
      [{ a: new Map() }, 'a'],
      [{ a: '\ud800' }, 'a'],
      [{ a: () => 1 }, 'a'],
      // eslint-disable-next-line no-sparse-arrays
      [{ a: [1, , 3] }, 'a[1]'],
    ];
    for (const [value, member] of cases) {
      let thrown: unknown;
      try {
        canonicalJson(value);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, member).toBeInstanceOf(EvidencePackageError);
      expect((thrown as EvidencePackageError).code).toBe('NOT_CANONICAL');
      expect((thrown as EvidencePackageError).members).toEqual([member]);
    }
  });
});

describe('manifestSha256 (spec §B.10)', () => {
  it('is the SHA-256 of the canonical body, written into the manifest, and stable over a rebuild', () => {
    const first = buildUnsignedManifest(exampleManifestInput(), EXAMPLE_SOURCE_ROWS);
    const second = buildUnsignedManifest(exampleManifestInput(), EXAMPLE_SOURCE_ROWS);
    expect(first.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(second.manifestSha256).toBe(first.manifestSha256);
    expect(manifestHashMatches(first)).toBe(true);
    expect(manifestSignedMessage(first.manifestSha256)).toHaveLength(32);
    const body = JSON.parse(decode(manifestCanonicalBody(first))) as { manifestSha256: unknown; signature: Record<string, unknown> };
    expect(body.manifestSha256).toBeNull();
    expect('value' in body.signature).toBe(false);
  });

  it('the signature value is outside the digest: signing does not change the hash', () => {
    const unsigned = buildUnsignedManifest(exampleManifestInput(), EXAMPLE_SOURCE_ROWS);
    const sealed = attachSignature(unsigned, FILLER_SIGNATURE);
    expect(sealed.manifestSha256).toBe(unsigned.manifestSha256);
    expect(computeManifestSha256(sealed)).toBe(unsigned.manifestSha256);
    expect(sealed.signature.value).toBe('ab'.repeat(64));
  });

  it('the two excluded members are the only ones outside the digest', () => {
    expect([...MANIFEST_SIGNATURE_EXCLUSIONS]).toEqual(['manifestSha256', 'signature.value']);
    const sealed = sealedExample();
    const outside: string[] = [];
    let checked = 0;
    for (const field of sealedFields) {
      for (const place of locations(clone(sealed) as unknown as Json, field.path)) {
        const manifest = clone(sealed) as unknown as Json;
        const target = locations(manifest, field.path).find((candidate) => candidate.where === place.where);
        if (target === undefined) throw new Error(place.where);
        target.holder[target.key] = altered(target.holder[target.key] as Json);
        checked += 1;
        if (computeManifestSha256(manifest) === sealed.manifestSha256) outside.push(field.path);
      }
    }
    // 119 field paths; the per-record fields at every record (2 tracks, 2 intervals, 2 files, 4 fragments, 3 steps).
    expect(checked).toBeGreaterThan(180);
    expect([...new Set(outside)].sort()).toEqual(['manifestSha256', 'signature.value']);
  });

  it('removing or adding a member changes the digest', () => {
    const sealed = sealedExample();
    const without = clone(sealed) as unknown as { tracks: Record<string, unknown>[] };
    delete (without.tracks[0] as Record<string, unknown>).sourceClass;
    expect(computeManifestSha256(without)).not.toBe(sealed.manifestSha256);
    expect(computeManifestSha256({ ...sealed, added: true })).not.toBe(sealed.manifestSha256);
  });

  it('the bytes of session-manifest.json parse back to the same manifest and the same hash', () => {
    const sealed = sealedExample();
    const text = decode(serializeManifest(sealed));
    const read = parseManifestV2(JSON.parse(text));
    expect(read).toEqual(sealed);
    expect(manifestHashMatches(read)).toBe(true);
  });
});

describe('signature.sig (spec §A.1, §B.10)', () => {
  it('repeats the digest, the signature and the certificate hash of the manifest, strictly', () => {
    const sealed = sealedExample();
    const detached = detachedSignatureOf(sealed);
    expect(detached.signedDigest).toBe(sealed.manifestSha256);
    expect(detached.signature).toBe(sealed.signature.value);
    const text = decode(serializeDetachedSignature(detached));
    expect(parseDetachedSignature(text)).toEqual(detached);
    expect(() => parseDetachedSignature(JSON.stringify({ ...detached, extra: 1 }))).toThrow(EvidencePackageError);
    expect(() => parseDetachedSignature(JSON.stringify({ ...detached, signedDigest: undefined }))).toThrow(EvidencePackageError);
    expect(() => parseDetachedSignature('not json')).toThrow(EvidencePackageError);
  });
});

describe('fragments.json (spec §A.1, §B.6; SEC35-11)', () => {
  it('is the exact serialization of the manifest records', () => {
    const sealed = sealedExample();
    const text = decode(serializeFragmentsJson(sealed.files));
    expect(parseFragmentsJson(text).files).toEqual(sealed.files);
    expect(fragmentsJsonMatchesManifest(text, sealed.files)).toBe(true);
  });

  it('one changed IV, tag, key id or an extra member no longer matches the manifest', () => {
    const sealed = sealedExample();
    const text = decode(serializeFragmentsJson(sealed.files));
    for (const member of ['gcmIv', 'gcmTag', 'keyId', 'sha256', 'byteOffset'] as const) {
      const changed = clone(sealed.files);
      const fragment = (changed[1] as (typeof changed)[number]).fragments[0] as Record<string, Json>;
      fragment[member] = altered(fragment[member] as Json);
      const other = JSON.stringify({ schema: 'dems.fragments/1', files: changed });
      expect(fragmentsJsonMatchesManifest(other, sealed.files), member).toBe(false);
      expect(fragmentsJsonMatchesManifest(text, changed), member).toBe(false);
    }
    // The same value in another byte form (pretty-printed) is not the exact serialization.
    expect(fragmentsJsonMatchesManifest(JSON.stringify(JSON.parse(text), null, 2), sealed.files)).toBe(false);
    expect(fragmentsJsonMatchesManifest('{', sealed.files)).toBe(false);
    expect(() => parseFragmentsJson(JSON.stringify({ schema: 'dems.fragments/1', files: sealed.files, extra: 1 }))).toThrow(EvidencePackageError);
  });

  it('refuses a fragment table that is not VIDEO-01 then VIDEO-02', () => {
    const files = sealedExample().files;
    expect(() => serializeFragmentsJson([...files].reverse())).toThrow(EvidencePackageError);
    expect(() => serializeFragmentsJson(files.slice(0, 1))).toThrow(EvidencePackageError);
  });

  it('the chain rule: chain_0 = SHA-256(""), chain_n = SHA-256(chain_{n-1} || sha_n)', () => {
    expect(FRAGMENT_CHAIN_GENESIS).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    for (const file of sealedExample().files) {
      let chain = FRAGMENT_CHAIN_GENESIS;
      for (const fragment of file.fragments) {
        chain = nextFragmentChainHash(chain, fragment.sha256);
        expect(fragment.chainHash).toBe(chain);
      }
    }
  });
});

describe('source class (spec §B.12, fields 124-126; database contract N.2, N.3)', () => {
  const rows = (kinds: Partial<Record<(typeof CAPTURE_SOURCE_SLOTS)[number], string>>): SessionCaptureSourceRow[] =>
    EXAMPLE_SOURCE_ROWS.map((row) => ({ ...row, adapterKind: kinds[row.slot as (typeof CAPTURE_SOURCE_SLOTS)[number]] ?? row.adapterKind }));

  it('maps the five adapter kinds and fails closed on any other', () => {
    expect(manifestSourceClassOfAdapterKind('ONVIF_RTSP')).toBe('PRODUCTION');
    expect(manifestSourceClassOfAdapterKind('USB_AUDIO')).toBe('PRODUCTION');
    expect(manifestSourceClassOfAdapterKind('SNMP_POE')).toBe('PRODUCTION');
    expect(manifestSourceClassOfAdapterKind('FAKE')).toBe('FAKE');
    expect(manifestSourceClassOfAdapterKind('LOCAL_DEVICE')).toBe('LOCAL_DEVICE');
    for (const unknown of ['', 'RTSP', 'fake', 'toString', 'constructor', '__proto__']) {
      expect(() => manifestSourceClassOfAdapterKind(unknown), unknown).toThrow(/SOURCE_CLASS_UNMAPPED/);
    }
  });

  it('writes the class of each slot on the tracks and of each microphone on its intervals', () => {
    const manifest = buildUnsignedManifest(exampleManifestInput(), rows({ 'VIDEO-01': 'LOCAL_DEVICE', 'MIC-PRIMARY': 'LOCAL_DEVICE' }));
    expect(manifest.tracks.map((track) => track.sourceClass)).toEqual(['LOCAL_DEVICE', 'FAKE']);
    expect(manifest.audio.sourceIntervals.map((interval) => [interval.micDeviceId, interval.sourceClass])).toEqual([
      ['MIC-01', 'LOCAL_DEVICE'],
      ['MIC-02', 'FAKE'],
    ]);
    expect(manifest.developmentSources).toBe(true);
  });

  it('developmentSources is derived: false only when every class is PRODUCTION', () => {
    const production = { 'VIDEO-01': 'ONVIF_RTSP', 'VIDEO-02': 'ONVIF_RTSP', 'MIC-PRIMARY': 'USB_AUDIO', 'MIC-STANDBY': 'USB_AUDIO' } as const;
    expect(buildUnsignedManifest(exampleManifestInput(), rows(production)).developmentSources).toBe(false);
    for (const slot of CAPTURE_SOURCE_SLOTS) {
      for (const kind of ['FAKE', 'LOCAL_DEVICE']) {
        expect(buildUnsignedManifest(exampleManifestInput(), rows({ ...production, [slot]: kind })).developmentSources, `${slot} ${kind}`).toBe(true);
      }
    }
    // A standby microphone that was never selected has no interval and so no mark (rule 4).
    const example = exampleManifestInput();
    const input = { ...example, audio: { ...example.audio, sourceIntervals: [{ seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY' as const, fromMs: 21, toMs: 4_000, reason: 'START' as const, switchedBy: null }] } };
    expect(buildUnsignedManifest(input, rows({ ...production, 'MIC-STANDBY': 'FAKE' })).developmentSources).toBe(false);
  });

  it('the flag cannot disagree with the classes, in either direction', () => {
    const sealed = sealedExample();
    expect(sealed.developmentSources).toBe(true);
    expect(ManifestV2Schema.safeParse({ ...sealed, developmentSources: false }).success).toBe(false);
    const production = attachSignature(
      buildUnsignedManifest(exampleManifestInput(), rows({ 'VIDEO-01': 'ONVIF_RTSP', 'VIDEO-02': 'ONVIF_RTSP', 'MIC-PRIMARY': 'USB_AUDIO', 'MIC-STANDBY': 'USB_AUDIO' })),
      FILLER_SIGNATURE,
    );
    expect(ManifestV2Schema.safeParse(production).success).toBe(true);
    expect(ManifestV2Schema.safeParse({ ...production, developmentSources: true }).success).toBe(false);
  });

  it('absence is refused, never read as PRODUCTION', () => {
    const sealed = sealedExample();
    const noTrackClass = clone(sealed) as unknown as { tracks: Record<string, unknown>[] };
    delete (noTrackClass.tracks[1] as Record<string, unknown>).sourceClass;
    const noIntervalClass = clone(sealed) as unknown as { audio: { sourceIntervals: Record<string, unknown>[] } };
    delete (noIntervalClass.audio.sourceIntervals[0] as Record<string, unknown>).sourceClass;
    const { developmentSources: _flag, ...noFlag } = sealed;
    for (const [name, value] of [['track', noTrackClass], ['interval', noIntervalClass], ['flag', noFlag]] as const) {
      const parsed = ManifestV2Schema.safeParse(value);
      expect(parsed.success, name).toBe(false);
      // The parser never fills the member in.
      expect(JSON.stringify(parsed.success ? parsed.data : null), name).not.toContain('PRODUCTION');
    }
    for (const value of [null, '', 'production', 'DEVELOPMENT', 'UNKNOWN']) {
      const manifest = clone(sealed) as unknown as { tracks: Record<string, unknown>[] };
      (manifest.tracks[0] as Record<string, unknown>).sourceClass = value;
      expect(ManifestV2Schema.safeParse(manifest).success, String(value)).toBe(false);
    }
  });

  it('a session without exactly its four source rows builds nothing (MR-S4)', () => {
    const build = (sourceRows: SessionCaptureSourceRow[]) => () => buildUnsignedManifest(exampleManifestInput(), sourceRows);
    expect(build([])).toThrow(/SOURCE_RECORD_MISSING/);
    expect(build(EXAMPLE_SOURCE_ROWS.slice(0, 3))).toThrow(/SOURCE_RECORD_MISSING: MIC-STANDBY/);
    expect(build([...EXAMPLE_SOURCE_ROWS, { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' }])).toThrow(/SOURCE_RECORD_MISSING/);
    expect(build([...EXAMPLE_SOURCE_ROWS, { slot: 'VIDEO-03', deviceId: 'CAM-03', adapterKind: 'FAKE' }])).toThrow(/SOURCE_RECORD_MISSING/);
    expect(build(rows({ 'VIDEO-02': 'NEW_KIND' }))).toThrow(/SOURCE_CLASS_UNMAPPED/);
    // An interval of a microphone that the session did not record.
    const input = exampleManifestInput();
    (input.audio.sourceIntervals[0] as { micDeviceId: string }).micDeviceId = 'MIC-09';
    expect(() => buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS)).toThrow(/SOURCE_NOT_RECORDED/);
    expect(sessionSourceClasses(EXAMPLE_SOURCE_ROWS).video).toEqual({ 'VIDEO-01': 'FAKE', 'VIDEO-02': 'FAKE' });
  });

  it('a caller cannot hand in a class: the input has no such member, and one smuggled in is overwritten or refused', () => {
    const input = exampleManifestInput() as unknown as { tracks: Record<string, unknown>[]; developmentSources?: boolean };
    (input.tracks[0] as Record<string, unknown>).sourceClass = 'PRODUCTION';
    const built = buildUnsignedManifest(input as never, EXAMPLE_SOURCE_ROWS);
    expect(built.tracks[0]?.sourceClass).toBe('FAKE');
    input.developmentSources = false;
    expect(buildUnsignedManifest(input as never, EXAMPLE_SOURCE_ROWS).developmentSources).toBe(true);
  });

  it('one microphone has one class, and a demo package has FAKE on every source (rules 4, 6)', () => {
    const sealed = clone(sealedExample());
    const twoClasses = clone(sealed);
    (twoClasses.audio.sourceIntervals[1] as { micDeviceId: string }).micDeviceId = 'MIC-01';
    (twoClasses.audio.sourceIntervals[1] as { sourceClass: string }).sourceClass = 'LOCAL_DEVICE';
    expect(ManifestV2Schema.safeParse(twoClasses).success).toBe(false);
    expect(ManifestV2Schema.safeParse({ ...sealed, demo: true, integrity: 'DEMO_PACKAGE' }).success).toBe(true);
    const demoLocal = clone({ ...sealed, demo: true, integrity: 'DEMO_PACKAGE' as const });
    (demoLocal.tracks[0] as { sourceClass: string }).sourceClass = 'LOCAL_DEVICE';
    expect(ManifestV2Schema.safeParse(demoLocal).success).toBe(false);
  });
});

describe('audio intervals in FILE time (spec §B.12 media-time origin; D81)', () => {
  it('file time of tap sample n is (n + 1024) / 48000 s: sample 0 lies at 21 ms, not at 0', () => {
    expect(fileTimeMsOfTapSample(0)).toBe(21);
    expect(fileTimeMsOfTapSample(47)).toBe(22);
    expect(fileTimeMsOfTapSample(48_000)).toBe(1_021);
    expect(fileTimeMsOfTapSample(96_000 - 1_024)).toBe(2_000);
    expect(() => fileTimeMsOfTapSample(-1)).toThrow(RangeError);
    expect(() => fileTimeMsOfTapSample(0.5)).toThrow(RangeError);
  });

  it('intervals count 1..n, run forward, do not overlap, and only the last may be open', () => {
    const refused = (change: (intervals: ManifestV2['audio']['sourceIntervals']) => void): boolean => {
      const manifest = clone(sealedExample());
      change(manifest.audio.sourceIntervals);
      return !ManifestV2Schema.safeParse(manifest).success;
    };
    type Interval = ManifestV2['audio']['sourceIntervals'][number];
    expect(refused(() => undefined)).toBe(false);
    expect(refused((list) => void ((list[1] as Interval).toMs = null))).toBe(false);
    expect(refused((list) => void ((list[0] as Interval).toMs = null))).toBe(true);
    expect(refused((list) => void ((list[0] as Interval).fromMs = -1))).toBe(true);
    expect(refused((list) => void ((list[0] as Interval).fromMs = 21.333))).toBe(true);
    expect(refused((list) => void ((list[0] as Interval).toMs = 20))).toBe(true);
    expect(refused((list) => void ((list[1] as Interval).fromMs = 2_020))).toBe(true);
    expect(refused((list) => void ((list[1] as Interval).seq = 3))).toBe(true);
    expect(refused((list) => void list.reverse())).toBe(true);
  });
});

describe('platform neutral, and v1 untouched', () => {
  const DIR = fileURLToPath(new URL('../src/evidence-package/', import.meta.url));
  const files = readdirSync(DIR).filter((name) => name.endsWith('.ts'));
  const code = (name: string): string =>
    readFileSync(`${DIR}${name}`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('imports zod, @noble/hashes, the domain enums, the capture constants and its own files only', () => {
    expect(files).toContain('index.ts');
    const seen = new Set<string>();
    for (const name of files) {
      for (const match of code(name).matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) seen.add(match[1] ?? '');
    }
    const foreign = [...seen].filter((specifier) => !specifier.startsWith('./')).sort();
    expect(foreign).toEqual(['../api/capture', '../domain', '@noble/hashes/sha2.js', '@noble/hashes/utils.js', 'zod']);
  });

  it('uses no Node built-in, no DOM global and no clock or random source', () => {
    for (const name of files) {
      expect(code(name), name).not.toMatch(/\b(?:Buffer|process|require|window|document|Date\.now|Math\.random|TextEncoder|TextDecoder)\b/);
    }
  });

  it('the 14 v1 demo packages are still v1 and are not a v2 manifest', () => {
    const ASSETS = fileURLToPath(new URL('../assets/demo-evidence/', import.meta.url));
    const folders = readdirSync(ASSETS).filter((name) => name.startsWith('SESSION-'));
    expect(folders).toHaveLength(14);
    for (const folder of folders) {
      const manifest = JSON.parse(readFileSync(`${ASSETS}${folder}/manifest.json`, 'utf8')) as { schema: string };
      expect(manifest.schema, folder).toBe('dems.evidence-manifest/1');
      expect(ManifestV2Schema.safeParse(manifest).success, folder).toBe(false);
    }
    expect(PackageFile.MANIFEST).not.toBe('manifest.json');
  });
});
