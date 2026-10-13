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
  MANIFEST_AUDIO_ABSENT_MAX_MS,
  MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS,
  MANIFEST_SIGNATURE_EXCLUSIONS,
  MANIFEST_VIDEO_ABSENCE_ENDS,
  MANIFEST_VIDEO_ABSENT_MAX_MS,
  MANIFEST_V2_FIELDS,
  MANIFEST_V2_OPTIONAL_FIELDS,
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
import { VERIFY_NOTICE, audioAbsentOnRestartReport, videoAbsentInSessionReport, verifyPackageV2 } from '../src/evidence-verify';

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

  it('refuses a fragment table that is not the sealed camera files, VIDEO-01 before VIDEO-02', () => {
    const files = sealedExample().files;
    expect(() => serializeFragmentsJson([...files].reverse())).toThrow(EvidencePackageError);
    // Fix pass F-M7 (R88-01, D178): ONE camera file is a table (a one-camera session is sealed); none, or one twice, is not.
    expect(() => serializeFragmentsJson(files.slice(0, 1))).not.toThrow();
    expect(() => serializeFragmentsJson([])).toThrow(EvidencePackageError);
    expect(() => serializeFragmentsJson([files[0]!, files[0]!])).toThrow(EvidencePackageError);
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

// Task 4 row V4 (decisions C73, C80; the finding of row 191b): the signed member for AUDIO ABSENT
// ACROSS A WORKER RESTART, `audio.absentOnRestart` - the ONE optional member of the manifest. An
// evidence form may not change what an existing sealed package verifies as, so the member is
// optional and absent in every package sealed before it.
describe('row V4: `audio.absentOnRestart`, the one optional member (fields 129-132)', () => {
  const GAP = { earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: 336, absentAtMostMs: 715 };
  const withGaps = (gaps: unknown): ManifestV2 => {
    const input = exampleManifestInput();
    return attachSignature(buildUnsignedManifest({ ...input, audio: { ...input.audio, absentOnRestart: gaps as never } }, EXAMPLE_SOURCE_ROWS), FILLER_SIGNATURE);
  };
  const refusedMembers = (gaps: unknown): readonly string[] => {
    try {
      withGaps(gaps);
    } catch (error) {
      expect(error).toBeInstanceOf(EvidencePackageError);
      return (error as EvidencePackageError).members;
    }
    return ['accepted'];
  };
  /** A manifest-scope run of the verifier over a manifest text and nothing else: V-01 is the schema. */
  const v01 = async (manifest: unknown): Promise<string | undefined> => {
    const text = JSON.stringify(manifest);
    const result = await verifyPackageV2(
      {
        reader: {
          entry: async (path) => (path === PackageFile.MANIFEST ? { kind: 'FILE', size: text.length } : { kind: 'ABSENT' }),
          readText: async (path) => (path === PackageFile.MANIFEST ? text : Promise.reject(new Error('absent'))),
          readRange: async () => Promise.reject(new Error('absent')),
          list: async () => [],
        },
        opener: null,
        readCertificate: () => null,
        verifySignature: () => false,
      },
      { scope: 'MANIFEST' },
    );
    return result.checks.find((check) => check.id === 'V-01')?.status;
  };

  it('the 128 required fields did not move; the four optional ones are numbered on from 129 and are in no required list', () => {
    expect(MANIFEST_V2_FIELDS).toHaveLength(128);
    expect(MANIFEST_V2_OPTIONAL_FIELDS.map((field) => [field.n, field.path, field.block])).toEqual([
      [129, 'audio.absentOnRestart[].earlierAttempt', 'sealed'],
      [130, 'audio.absentOnRestart[].laterAttempt', 'sealed'],
      [131, 'audio.absentOnRestart[].absentAtLeastMs', 'sealed'],
      [132, 'audio.absentOnRestart[].absentAtMostMs', 'sealed'],
      // Task 4 row P1 (decision U21 (2)): + the second optional member, 4 -> 5 optional fields.
      [133, 'hostProfileNotAsked.platform', 'sealed'],
      // Task 4 row R1b (decision C99): + the third optional member, 5 -> 10 optional fields.
      [134, 'tracks[].absentInSession[].attempt', 'sealed'],
      [135, 'tracks[].absentInSession[].loss', 'sealed'],
      [136, 'tracks[].absentInSession[].absentAtLeastMs', 'sealed'],
      [137, 'tracks[].absentInSession[].absentAtMostMs', 'sealed'],
      [138, 'tracks[].absentInSession[].ended', 'sealed'],
    ]);
    const required = new Set(MANIFEST_V2_FIELDS.map((field) => field.path));
    for (const field of MANIFEST_V2_OPTIONAL_FIELDS) expect(required.has(field.path), field.path).toBe(false);
    expect(MANIFEST_AUDIO_ABSENT_MAX_MS).toBe(86_400_000);
  });

  it('A PACKAGE SEALED BEFORE THE MEMBER IS UNCHANGED: the example has no such key, parses to itself, keeps its digest, its bytes and its V-01 verdict', async () => {
    const sealed = sealedExample();
    expect('absentOnRestart' in sealed.audio).toBe(false);
    expect(Object.keys(sealed.audio)).toEqual(['trackId', 'codec', 'containsIn', 'sourceIntervals']);
    const read = parseManifestV2(JSON.parse(decode(serializeManifest(sealed))));
    expect(read).toEqual(sealed);
    expect('absentOnRestart' in read.audio).toBe(false);
    expect(decode(serializeManifest(read))).toBe(decode(serializeManifest(sealed)));
    expect(manifestHashMatches(read)).toBe(true);
    expect(decode(serializeManifest(sealed))).not.toContain('absentOnRestart');
    // A caller that hands `undefined` for the member seals the SAME manifest as one that leaves it out.
    expect(withGaps(undefined)).toEqual(sealed);
    expect(await v01(sealed)).toBe('PASS');
  });

  it('pass I-9b: the verifier SAYS the member - ONE notice `AUDIO_ABSENT_ON_RESTART`; none for a manifest without the member, whose notices are the ones of before; the line fits the contract', async () => {
    /** The notices of a manifest-scope run of the verifier over a manifest text and nothing else (the form of row R1b's case). */
    const noticesOf = async (manifest: unknown): Promise<readonly { code: string; report: string }[]> => {
      const text = JSON.stringify(manifest);
      const result = await verifyPackageV2(
        {
          reader: {
            entry: async (path) => (path === PackageFile.MANIFEST ? { kind: 'FILE', size: text.length } : { kind: 'ABSENT' }),
            readText: async (path) => (path === PackageFile.MANIFEST ? text : Promise.reject(new Error('absent'))),
            readRange: async () => Promise.reject(new Error('absent')),
            list: async () => [],
          },
          opener: null,
          readCertificate: () => null,
          verifySignature: () => false,
        },
        { scope: 'MANIFEST' },
      );
      return result.notices;
    };
    const one = 'Audio: ABSENT ACROSS A RESTART OF THE CAPTURE. 1 time, at least 336 ms, at most 715 ms. No sound was recorded in that time.';
    const without = await noticesOf(withGaps(undefined));
    const withOne = await noticesOf(withGaps([GAP]));
    // NOTHING CHANGES FOR A PACKAGE WITHOUT THE MEMBER; with it, exactly one line more, the last.
    expect(without.map((notice) => notice.code)).not.toContain('AUDIO_ABSENT_ON_RESTART');
    expect(withOne).toEqual([...without, { code: 'AUDIO_ABSENT_ON_RESTART', report: one }]);
    expect(audioAbsentOnRestartReport([GAP])).toBe(one);
    // Sums over the restarts; a bound one record does not state makes that sum "not measured".
    expect(audioAbsentOnRestartReport([GAP, { absentAtLeastMs: 1000, absentAtMostMs: null }])).toBe(
      'Audio: ABSENT ACROSS A RESTART OF THE CAPTURE. 2 times, at least 1336 ms, at most not measured. No sound was recorded in that time.',
    );
    expect(audioAbsentOnRestartReport([])).toBe('');
    // The contract's bound of a report line (256), for a thousand restarts of the longest time a manifest can state.
    const longest = audioAbsentOnRestartReport(Array.from({ length: 1000 }, () => ({ absentAtLeastMs: 86_400_000, absentAtMostMs: 86_400_000 })));
    expect(longest.length).toBeLessThanOrEqual(256);
    expect(longest).toContain('1000 times, at least 86400000000 ms, at most 86400000000 ms.');
    // Both twins on one package: each its own line, the video line first (the order of the vocabulary).
    const input = exampleManifestInput();
    const both = attachSignature(
      buildUnsignedManifest({ ...input, audio: { ...input.audio, absentOnRestart: [GAP] }, tracks: input.tracks.map((track, index) => (index === 0 ? { ...track, absentInSession: [{ attempt: 1, loss: 1, absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' as const }] } : track)) }, EXAMPLE_SOURCE_ROWS),
      FILLER_SIGNATURE,
    );
    expect((await noticesOf(both)).map((notice) => notice.code).slice(-2)).toEqual(['VIDEO_ABSENT_IN_SESSION', 'AUDIO_ABSENT_ON_RESTART']);
  });

  it('a manifest that states a restart gap is accepted by the schema and by the verifier (V-01); the member is the last of `audio`', async () => {
    const sealed = withGaps([GAP]);
    expect(sealed.audio.absentOnRestart).toEqual([GAP]);
    expect(ManifestV2Schema.safeParse(sealed).success).toBe(true);
    expect(parseManifestV2(JSON.parse(decode(serializeManifest(sealed))))).toEqual(sealed);
    expect(await v01(sealed)).toBe('PASS');
    // Two restarts, the second not measured: both bounds null says "a gap exists and was not measured".
    const two = withGaps([GAP, { earlierAttempt: 2, laterAttempt: 3, absentAtLeastMs: null, absentAtMostMs: null }]);
    expect(two.audio.absentOnRestart).toHaveLength(2);
    expect(await v01(two)).toBe('PASS');
    // The bounds themselves pass: 0 ms and one day; one bound alone may be known.
    for (const gap of [{ ...GAP, absentAtLeastMs: 0, absentAtMostMs: 0 }, { ...GAP, absentAtLeastMs: 86_400_000, absentAtMostMs: 86_400_000 }, { ...GAP, absentAtLeastMs: null }, { ...GAP, absentAtMostMs: null }, { ...GAP, laterAttempt: 5 }]) {
      expect(refusedMembers([gap]), JSON.stringify(gap)).toEqual(['accepted']);
    }
  });

  it('THE MEMBER IS SIGNED: it is inside the digest - adding it, removing it or changing one number changes `manifestSha256`', async () => {
    const without = sealedExample();
    const sealed = withGaps([GAP]);
    expect(sealed.manifestSha256).not.toBe(without.manifestSha256);
    expect(manifestHashMatches(sealed)).toBe(true);
    for (const key of Object.keys(GAP) as (keyof typeof GAP)[]) {
      const changed = clone(sealed) as unknown as { audio: { absentOnRestart: Record<string, number>[] } };
      (changed.audio.absentOnRestart[0] as Record<string, number>)[key] = GAP[key] + 1;
      expect(computeManifestSha256(changed), key).not.toBe(sealed.manifestSha256);
      expect(manifestHashMatches(changed), key).toBe(false);
    }
    // Taken out of a signed manifest, the recorded digest no longer fits: a gap cannot be removed unseen.
    const removed = clone(sealed) as unknown as { audio: Record<string, unknown> };
    delete removed.audio.absentOnRestart;
    expect(ManifestV2Schema.safeParse(removed).success).toBe(true);
    expect(manifestHashMatches(removed)).toBe(false);
    // ... and added to a manifest sealed without one, the same.
    const added = clone(without) as unknown as { audio: Record<string, unknown> };
    added.audio.absentOnRestart = [GAP];
    expect(manifestHashMatches(added)).toBe(false);
    expect([...MANIFEST_SIGNATURE_EXCLUSIONS]).toEqual(['manifestSha256', 'signature.value']);
  });

  it('refuses what states nothing or cannot be: an empty list, null, a foreign key, a missing key, text, a fraction, a bound over one day, a record that goes backwards', async () => {
    const at = (member: string): string[] => [`audio.absentOnRestart.0.${member}`];
    expect(refusedMembers([])).toEqual(['audio.absentOnRestart']);
    expect(refusedMembers(null)).toEqual(['audio.absentOnRestart']);
    expect(refusedMembers(GAP)).toEqual(['audio.absentOnRestart']);
    expect(refusedMembers([{ ...GAP, deviceId: 'MIC-01' }])).toEqual(['audio.absentOnRestart.0']);
    for (const key of Object.keys(GAP)) {
      const { [key]: _gone, ...rest } = GAP as Record<string, number>;
      expect(refusedMembers([rest]), `without ${key}`).toEqual(at(key));
    }
    const invalid: readonly (readonly [string, unknown])[] = [
      ['earlierAttempt', 0], ['earlierAttempt', 1.5], ['earlierAttempt', '1'], ['laterAttempt', null], ['laterAttempt', -2],
      ['absentAtLeastMs', -1], ['absentAtLeastMs', 0.5], ['absentAtLeastMs', '336'], ['absentAtMostMs', 86_400_001], ['absentAtMostMs', 'unknown'],
    ];
    for (const [key, value] of invalid) expect(refusedMembers([{ ...GAP, [key]: value }]), `${key}=${String(value)}`).toEqual(at(key));
    // Forward only: the later attempt after the earlier one, the least not above the most, restarts in order.
    expect(refusedMembers([{ ...GAP, laterAttempt: 1 }])).toEqual(at('laterAttempt'));
    expect(refusedMembers([{ ...GAP, earlierAttempt: 3 }])).toEqual(at('laterAttempt'));
    expect(refusedMembers([{ ...GAP, absentAtLeastMs: 716 }])).toEqual(at('absentAtMostMs'));
    expect(refusedMembers([GAP, { ...GAP }])).toEqual(['audio.absentOnRestart.1.earlierAttempt']);
    // The verifier refuses the same manifests at V-01: an empty list written into a sealed manifest by hand.
    const emptied = clone(withGaps([GAP])) as unknown as { audio: Record<string, unknown> };
    emptied.audio.absentOnRestart = [];
    expect(await v01(emptied)).toBe('FAIL');
  });

  // ── Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): `hostProfileNotAsked`, the second optional member (field 133) ──
  // A production Core is allowed on Linux (the whole host profile asked at every start) and on macOS (none of it asked).
  // The second fact is signed: PRESENT with the platform when the profile was not asked, ABSENT when it was (Linux), so a
  // Linux manifest - and every manifest sealed before - is byte for byte what it was.
  const onPlatform = (member: unknown, more: Record<string, unknown> = {}): ManifestV2 =>
    attachSignature(buildUnsignedManifest({ ...exampleManifestInput(), ...more, hostProfileNotAsked: member as never }, EXAMPLE_SOURCE_ROWS), FILLER_SIGNATURE);
  const refusedHost = (member: unknown, more: Record<string, unknown> = {}): readonly string[] => {
    try {
      onPlatform(member, more);
    } catch (error) {
      expect(error).toBeInstanceOf(EvidencePackageError);
      return (error as EvidencePackageError).members;
    }
    return ['accepted'];
  };

  it('row P1: ABSENT = nothing changes - the example has no such key, a caller that hands `undefined` seals the SAME bytes, digest and V-01 verdict as before', async () => {
    const sealed = sealedExample();
    expect('hostProfileNotAsked' in sealed).toBe(false);
    expect(decode(serializeManifest(sealed))).not.toContain('hostProfileNotAsked');
    expect(onPlatform(undefined)).toEqual(sealed);
    expect(decode(serializeManifest(onPlatform(undefined)))).toBe(decode(serializeManifest(sealed)));
    expect(onPlatform(undefined).manifestSha256).toBe(sealed.manifestSha256);
    expect(await v01(sealed)).toBe('PASS');
    expect([...MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS]).toEqual(['darwin']);
  });

  it('row P1: PRESENT = a production Core sealed on macOS without its host profile being asked - accepted by the schema and by the verifier (V-01), inside the digest, and not removable or addable unseen', async () => {
    const without = sealedExample();
    const sealed = onPlatform({ platform: 'darwin' });
    expect(sealed.hostProfileNotAsked).toEqual({ platform: 'darwin' });
    expect(ManifestV2Schema.safeParse(sealed).success).toBe(true);
    expect(parseManifestV2(JSON.parse(decode(serializeManifest(sealed))))).toEqual(sealed);
    expect(decode(serializeManifest(sealed))).toContain('"hostProfileNotAsked":{"platform":"darwin"}');
    expect(await v01(sealed)).toBe('PASS');
    // Every other member is what it was: the two manifests differ in this member, the digest and nothing else.
    const { hostProfileNotAsked: _member, manifestSha256: _with, ...rest } = sealed;
    const { manifestSha256: _without, ...before } = without;
    expect(rest).toEqual(before);
    // SIGNED: inside the digest.
    expect(sealed.manifestSha256).not.toBe(without.manifestSha256);
    expect(manifestHashMatches(sealed)).toBe(true);
    const removed = clone(sealed) as unknown as Record<string, unknown>;
    delete removed['hostProfileNotAsked'];
    expect(ManifestV2Schema.safeParse(removed).success).toBe(true);
    expect(manifestHashMatches(removed as never)).toBe(false);
    const added = clone(without) as unknown as Record<string, unknown>;
    added['hostProfileNotAsked'] = { platform: 'darwin' };
    expect(manifestHashMatches(added as never)).toBe(false);
    // Both optional members in one manifest.
    const input = exampleManifestInput();
    const both = attachSignature(buildUnsignedManifest({ ...input, audio: { ...input.audio, absentOnRestart: [GAP] }, hostProfileNotAsked: { platform: 'darwin' } }, EXAMPLE_SOURCE_ROWS), FILLER_SIGNATURE);
    expect(await v01(both)).toBe('PASS');
  });

  it('row P1: refuses what cannot be - `linux` (its profile IS asked: the member is absent there), any other platform word, null, an empty or foreign record, text; and the member beside a demo package', async () => {
    for (const platform of ['linux', 'win32', 'Darwin', 'macos', '', null, 7, true]) expect(refusedHost({ platform }), String(platform)).toEqual(['hostProfileNotAsked.platform']);
    expect(refusedHost({})).toEqual(['hostProfileNotAsked.platform']);
    expect(refusedHost({ platform: 'darwin', asked: false })).toEqual(['hostProfileNotAsked']);
    for (const member of [null, 'darwin', ['darwin'], false]) expect(refusedHost(member), JSON.stringify(member)).toEqual(['hostProfileNotAsked']);
    // The verifier refuses the same at V-01: `linux` written into a sealed manifest by hand.
    const forged = clone(onPlatform({ platform: 'darwin' })) as unknown as { hostProfileNotAsked: { platform: string } };
    forged.hostProfileNotAsked.platform = 'linux';
    expect(await v01(forged)).toBe('FAIL');
    // A demo package is never a production Core's: the two do not stand in one manifest.
    const demoRows = EXAMPLE_SOURCE_ROWS.map((row) => ({ ...row, adapterKind: 'FAKE' }));
    const demo = (member: unknown): readonly string[] => {
      try {
        buildUnsignedManifest({ ...exampleManifestInput(), integrity: 'DEMO_PACKAGE', demo: true, ...(member === undefined ? {} : { hostProfileNotAsked: member as never }) }, demoRows);
      } catch (error) {
        return (error as EvidencePackageError).members;
      }
      return ['accepted'];
    };
    expect(demo(undefined)).toEqual(['accepted']);
    expect(demo({ platform: 'darwin' })).toEqual(['hostProfileNotAsked']);
  });

  // ── Task 4 row R1b (decision C99; finding F3-01): `tracks[].absentInSession`, the third optional member (fields 134-138) ──
  // A camera of the session stopped delivering pictures inside it and its relay kept the push: the track's file has a step
  // in time as long as the absence. The Core states it per track, under the signature. ABSENT on every track of a session
  // without a loss, so such a manifest - and every manifest sealed before - is byte for byte what it was.
  const ABSENCE = { attempt: 1, loss: 1, absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' };
  const withAbsences = (first: unknown, second?: unknown): ManifestV2 => {
    const input = exampleManifestInput();
    const tracks = input.tracks.map((track, index) => ({ ...track, ...(index === 0 ? { absentInSession: first as never } : second === undefined ? {} : { absentInSession: second as never }) }));
    return attachSignature(buildUnsignedManifest({ ...input, tracks }, EXAMPLE_SOURCE_ROWS), FILLER_SIGNATURE);
  };
  const refusedAbsences = (first: unknown): readonly string[] => {
    try {
      withAbsences(first);
    } catch (error) {
      expect(error).toBeInstanceOf(EvidencePackageError);
      return (error as EvidencePackageError).members;
    }
    return ['accepted'];
  };

  it('row R1b: ABSENT = nothing changes - the example has no such key on any track, a caller that hands `undefined` seals the SAME bytes, digest and V-01 verdict as before', async () => {
    const sealed = sealedExample();
    expect(sealed.tracks.length).toBeGreaterThanOrEqual(1);
    for (const track of sealed.tracks) expect('absentInSession' in track).toBe(false);
    expect(decode(serializeManifest(sealed))).not.toContain('absentInSession');
    const handed = withAbsences(undefined);
    expect(handed).toEqual(sealed);
    for (const track of handed.tracks) expect('absentInSession' in track).toBe(false);
    expect(decode(serializeManifest(handed))).toBe(decode(serializeManifest(sealed)));
    expect(handed.manifestSha256).toBe(sealed.manifestSha256);
    expect(await v01(sealed)).toBe('PASS');
    expect([...MANIFEST_VIDEO_ABSENCE_ENDS]).toEqual(['RE_OPENED', 'NOT_RE_OPENED']);
    expect(MANIFEST_VIDEO_ABSENT_MAX_MS).toBe(MANIFEST_AUDIO_ABSENT_MAX_MS);
  });

  it('row R1b: PRESENT = the absences of one track, in order - accepted by the schema and by the verifier (V-01), inside the digest, and not removable, addable or alterable unseen', async () => {
    const without = sealedExample();
    const sealed = withAbsences([ABSENCE]);
    expect(sealed.tracks[0]?.absentInSession).toEqual([ABSENCE]);
    expect(ManifestV2Schema.safeParse(sealed).success).toBe(true);
    expect(parseManifestV2(JSON.parse(decode(serializeManifest(sealed))))).toEqual(sealed);
    expect(decode(serializeManifest(sealed))).toContain('"absentInSession":[{"absentAtLeastMs":3048,"absentAtMostMs":8049,"attempt":1,"ended":"RE_OPENED","loss":1}]');
    expect(await v01(sealed)).toBe('PASS');
    // Every other member is what it was: the two manifests differ in this member of the first track, the digest and nothing else.
    const stripped = clone(sealed) as unknown as { manifestSha256?: string; tracks: Record<string, unknown>[] };
    delete (stripped.tracks[0] as Record<string, unknown>)['absentInSession'];
    delete stripped.manifestSha256;
    const { manifestSha256: _without, ...before } = without;
    expect(stripped).toEqual(before);
    // SIGNED: inside the digest.
    expect(sealed.manifestSha256).not.toBe(without.manifestSha256);
    expect(manifestHashMatches(sealed)).toBe(true);
    const removed = clone(sealed) as unknown as { tracks: Record<string, unknown>[] };
    delete (removed.tracks[0] as Record<string, unknown>)['absentInSession'];
    expect(ManifestV2Schema.safeParse(removed).success).toBe(true);
    expect(manifestHashMatches(removed as never)).toBe(false);
    for (const key of ['attempt', 'loss', 'absentAtLeastMs', 'absentAtMostMs'] as const) {
      const changed = clone(sealed) as unknown as { tracks: { absentInSession: Record<string, number>[] }[] };
      ((changed.tracks[0] as { absentInSession: Record<string, number>[] }).absentInSession[0] as Record<string, number>)[key] = ABSENCE[key] + 1;
      expect(manifestHashMatches(changed as never), key).toBe(false);
    }
    const reworded = clone(sealed) as unknown as { tracks: { absentInSession: Record<string, unknown>[] }[] };
    ((reworded.tracks[0] as { absentInSession: Record<string, unknown>[] }).absentInSession[0] as Record<string, unknown>)['ended'] = 'NOT_RE_OPENED';
    expect(ManifestV2Schema.safeParse(reworded).success).toBe(true);
    expect(manifestHashMatches(reworded as never)).toBe(false);
    // Three in order, the last one never ended, bounds not measured; and an absence on the second track too (when the example has one).
    const three = withAbsences([ABSENCE, { ...ABSENCE, loss: 2, absentAtLeastMs: null }, { attempt: 2, loss: 1, absentAtLeastMs: 12, absentAtMostMs: null, ended: 'NOT_RE_OPENED' }], sealed.tracks.length > 1 ? [ABSENCE] : undefined);
    expect(three.tracks[0]?.absentInSession).toHaveLength(3);
    expect(await v01(three)).toBe('PASS');
    // The three optional members in one manifest.
    const input = exampleManifestInput();
    const all = attachSignature(
      buildUnsignedManifest({ ...input, tracks: input.tracks.map((track) => ({ ...track, absentInSession: [ABSENCE] as never })), audio: { ...input.audio, absentOnRestart: [GAP] }, hostProfileNotAsked: { platform: 'darwin' } }, EXAMPLE_SOURCE_ROWS),
      FILLER_SIGNATURE,
    );
    expect(await v01(all)).toBe('PASS');
  });

  it('row R1b: refuses what cannot be - an empty list, null, a bare record, a foreign member, a missing member, a number out of form, the least above the most, records out of order, an absence that did not end before another one', async () => {
    const at = (member: string): string[] => [`tracks.0.absentInSession.0.${member}`];
    expect(refusedAbsences([])).toEqual(['tracks.0.absentInSession']);
    expect(refusedAbsences(null)).toEqual(['tracks.0.absentInSession']);
    expect(refusedAbsences(ABSENCE)).toEqual(['tracks.0.absentInSession']);
    expect(refusedAbsences([{ ...ABSENCE, deviceId: 'CAM-01' }])).toEqual(['tracks.0.absentInSession.0']);
    expect(refusedAbsences([{ ...ABSENCE, profile: 'H264_1080P' }])).toEqual(['tracks.0.absentInSession.0']);
    for (const key of ['attempt', 'loss', 'absentAtLeastMs', 'absentAtMostMs', 'ended'] as const) {
      const { [key]: _left, ...rest } = ABSENCE;
      expect(refusedAbsences([rest]), key).toEqual(at(key));
    }
    for (const value of [0, -1, 1.5, '1', null]) expect(refusedAbsences([{ ...ABSENCE, attempt: value }]), `attempt ${String(value)}`).toEqual(at('attempt'));
    for (const value of [0, -1, 1.5, '1', null]) expect(refusedAbsences([{ ...ABSENCE, loss: value }]), `loss ${String(value)}`).toEqual(at('loss'));
    for (const value of [-1, 1.5, '12', MANIFEST_VIDEO_ABSENT_MAX_MS + 1]) {
      expect(refusedAbsences([{ ...ABSENCE, absentAtLeastMs: value, absentAtMostMs: null }]), `least ${String(value)}`).toEqual(at('absentAtLeastMs'));
      expect(refusedAbsences([{ ...ABSENCE, absentAtLeastMs: null, absentAtMostMs: value }]), `most ${String(value)}`).toEqual(at('absentAtMostMs'));
    }
    expect(refusedAbsences([{ ...ABSENCE, absentAtLeastMs: 0, absentAtMostMs: MANIFEST_VIDEO_ABSENT_MAX_MS }])).toEqual(['accepted']);
    for (const value of ['REOPENED', 're_opened', 'RE-OPENED', '', null, true]) expect(refusedAbsences([{ ...ABSENCE, ended: value }]), `ended ${String(value)}`).toEqual(at('ended'));
    expect(refusedAbsences([{ ...ABSENCE, absentAtLeastMs: 8050 }])).toEqual(at('absentAtMostMs'));
    // Order: the same loss twice, a lower loss, an earlier attempt; a later attempt may count its losses anew.
    expect(refusedAbsences([ABSENCE, { ...ABSENCE }])).toEqual(['tracks.0.absentInSession.1.loss']);
    expect(refusedAbsences([{ ...ABSENCE, loss: 2 }, ABSENCE])).toEqual(['tracks.0.absentInSession.1.loss']);
    expect(refusedAbsences([{ ...ABSENCE, attempt: 2 }, { ...ABSENCE, loss: 9 }])).toEqual(['tracks.0.absentInSession.1.loss']);
    expect(refusedAbsences([{ ...ABSENCE, loss: 7 }, { ...ABSENCE, attempt: 2 }])).toEqual(['accepted']);
    // An absence that did not end is the last one of its track.
    expect(refusedAbsences([{ ...ABSENCE, ended: 'NOT_RE_OPENED' }, { ...ABSENCE, loss: 2 }])).toEqual(['tracks.0.absentInSession.0.ended']);
    // The verifier refuses the same manifests at V-01: an empty list, and a foreign word, written into a sealed manifest by hand.
    const emptied = clone(withAbsences([ABSENCE])) as unknown as { tracks: Record<string, unknown>[] };
    (emptied.tracks[0] as Record<string, unknown>)['absentInSession'] = [];
    expect(await v01(emptied)).toBe('FAIL');
    const forged = clone(withAbsences([ABSENCE])) as unknown as { tracks: { absentInSession: Record<string, unknown>[] }[] };
    ((forged.tracks[0] as { absentInSession: Record<string, unknown>[] }).absentInSession[0] as Record<string, unknown>)['ended'] = 'NEVER_ABSENT';
    expect(await v01(forged)).toBe('FAIL');
  });

  it('row R1b: the verifier SAYS the member - ONE notice `VIDEO_ABSENT_IN_SESSION` with the line of every track that has one; none for a manifest without the member; the line fits the contract for the largest numbers', async () => {
    /** The notices of a manifest-scope run of the verifier over a manifest text and nothing else. */
    const noticesOf = async (manifest: unknown): Promise<readonly { code: string; report: string }[]> => {
      const text = JSON.stringify(manifest);
      const result = await verifyPackageV2(
        {
          reader: {
            entry: async (path) => (path === PackageFile.MANIFEST ? { kind: 'FILE', size: text.length } : { kind: 'ABSENT' }),
            readText: async (path) => (path === PackageFile.MANIFEST ? text : Promise.reject(new Error('absent'))),
            readRange: async () => Promise.reject(new Error('absent')),
            list: async () => [],
          },
          opener: null,
          readCertificate: () => null,
          verifySignature: () => false,
        },
        { scope: 'MANIFEST' },
      );
      return result.notices.filter((notice) => notice.code === VERIFY_NOTICE.VIDEO_ABSENT_IN_SESSION);
    };
    expect(await noticesOf(sealedExample())).toEqual([]);
    const one = 'Video: CAMERA ABSENT INSIDE THE SESSION. VIDEO-01 1 time, at least 3048 ms, at most 8049 ms. No picture was recorded in that time.';
    expect(await noticesOf(withAbsences([ABSENCE]))).toEqual([{ code: 'VIDEO_ABSENT_IN_SESSION', report: one }]);
    expect(videoAbsentInSessionReport([{ trackId: 'VIDEO-01', absences: [ABSENCE] }])).toBe(one);
    // Sums per track; a bound one absence does not state makes the sum "not measured"; an absence that did not end is said.
    expect(
      videoAbsentInSessionReport([
        { trackId: 'VIDEO-01', absences: [ABSENCE, { ...ABSENCE, loss: 2, absentAtLeastMs: 1000, absentAtMostMs: 6000 }] },
        { trackId: 'VIDEO-02', absences: [{ ...ABSENCE, absentAtLeastMs: null, ended: 'NOT_RE_OPENED' }] },
      ]),
    ).toBe('Video: CAMERA ABSENT INSIDE THE SESSION. VIDEO-01 2 times, at least 4048 ms, at most 14049 ms; VIDEO-02 1 time, at least not measured, at most 8049 ms, not re-opened. No picture was recorded in that time.');
    // No absence: no line. A track id that is not of the closed form is not printed.
    expect(videoAbsentInSessionReport([])).toBe('');
    expect(videoAbsentInSessionReport([{ trackId: 'VIDEO-01', absences: [] }])).toBe('');
    expect(videoAbsentInSessionReport([{ trackId: '<b>VIDEO-01</b>', absences: [ABSENCE] }])).toBe('Video: CAMERA ABSENT INSIDE THE SESSION. a track 1 time, at least 3048 ms, at most 8049 ms. No picture was recorded in that time.');
    // The contract's bound of a report line (256), with two tracks, a thousand absences each of the longest time a manifest can state, the last not ended.
    const most = Array.from({ length: 1000 }, (_, index) => ({ absentAtLeastMs: MANIFEST_VIDEO_ABSENT_MAX_MS, absentAtMostMs: MANIFEST_VIDEO_ABSENT_MAX_MS, ended: index === 999 ? 'NOT_RE_OPENED' : 'RE_OPENED' }));
    const longest = videoAbsentInSessionReport([{ trackId: 'VIDEO-01', absences: most }, { trackId: 'VIDEO-02', absences: most }]);
    expect(longest.length).toBeLessThanOrEqual(256);
    expect(longest).toContain('VIDEO-02 1000 times, at least 86400000000 ms, at most 86400000000 ms, not re-opened.');
    // Beyond any real session: the closing sentence is given up before a number is.
    const beyond = Array.from({ length: 100_000 }, () => ({ absentAtLeastMs: MANIFEST_VIDEO_ABSENT_MAX_MS, absentAtMostMs: MANIFEST_VIDEO_ABSENT_MAX_MS, ended: 'NOT_RE_OPENED' }));
    const cut = videoAbsentInSessionReport([{ trackId: 'VIDEO-01', absences: beyond }, { trackId: 'VIDEO-02', absences: beyond }]);
    expect([cut.length <= 256, cut.endsWith('not re-opened.'), cut.includes('No picture')]).toEqual([true, true, false]);
  });
});
