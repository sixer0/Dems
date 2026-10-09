// V-15, the development-source mark, as a pure rule (blueprint row 141; evidence package spec §D
// V-15): what the check says of a RAW manifest object, without a file system, a key or a signer.
// A manifest-scope run over an in-memory reader that holds the manifest text and nothing else; the
// other checks of such a run fail or are skipped and are not this file's subject. Sealed packages
// with real signatures are in `apps/core-server/src/evidence-verify/__tests__/dev-source-mark.test.ts`.
import { describe, expect, it } from 'vitest';
import { EXAMPLE_SOURCE_ROWS, PackageFile, buildUnsignedManifest, exampleManifestInput, type SessionCaptureSourceRow } from '../src/evidence-package';
import { SOURCES_STATE_REPORT, VERIFY_FAILURES, verifyPackageV2, verifyReportLines, type PackageReader, type PackageVerifyResult } from '../src/evidence-verify';

const readerOf = (text: string | null): PackageReader => ({
  entry: async (path) => (path === PackageFile.MANIFEST && text !== null ? { kind: 'FILE', size: text.length } : { kind: 'ABSENT' }),
  readText: async (path) => (path === PackageFile.MANIFEST && text !== null ? text : Promise.reject(new Error('absent'))),
  readRange: async () => Promise.reject(new Error('absent')),
  list: async () => [],
});
const run = (value: unknown): Promise<PackageVerifyResult> =>
  verifyPackageV2({ reader: readerOf(value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value)), opener: null, readCertificate: () => null, verifySignature: () => false }, { scope: 'MANIFEST' });

const DEVELOPMENT_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'LOCAL_DEVICE' },
  { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'LOCAL_DEVICE' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
];
const PRODUCTION_ROWS = DEVELOPMENT_ROWS.map((row) => ({ ...row, adapterKind: row.slot.startsWith('VIDEO') ? 'ONVIF_RTSP' : 'USB_AUDIO' }));

type Raw = { developmentSources?: unknown; tracks: { sourceClass?: unknown }[]; audio: { sourceIntervals: { sourceClass?: unknown; micDeviceId: string }[] } } & Record<string, unknown>;
/** An unsigned manifest of the builder as a plain object, to be altered. */
const raw = (rows: readonly SessionCaptureSourceRow[] = DEVELOPMENT_ROWS): Raw => JSON.parse(JSON.stringify(buildUnsignedManifest(exampleManifestInput(), rows))) as Raw;
const altered = (change: (manifest: Raw) => void, rows?: readonly SessionCaptureSourceRow[]): Raw => {
  const manifest = raw(rows);
  change(manifest);
  return manifest;
};
const v15 = (result: PackageVerifyResult) => {
  const check = result.checks.find((entry) => entry.id === 'V-15');
  if (check === undefined) throw new Error('no V-15');
  return { status: check.status, failureClass: check.failureClass, found: check.findings.map((finding) => `${finding.code} ${finding.member ?? ''}`) };
};

describe('V-15: a class other than PRODUCTION is not a failure', () => {
  it.each([
    ['LOCAL_DEVICE and FAKE', DEVELOPMENT_ROWS],
    ['all FAKE', EXAMPLE_SOURCE_ROWS],
    ['all PRODUCTION', PRODUCTION_ROWS],
  ])('%s: the mark has no finding', async (_name, rows) => {
    const result = await run(raw(rows));
    expect(result.checks.find((check) => check.id === 'V-15')?.findings).toEqual([]);
    // The run has no certificate: nothing of this manifest is repeated as fact, whatever V-15 says.
    expect(result.sources).toMatchObject({ code: 'NOT_TRUSTWORTHY', development: null, tracks: [], audioIntervals: [] });
    expect(verifyReportLines(result)[0]).toBe(SOURCES_STATE_REPORT.NOT_TRUSTWORTHY);
  });
});

describe('V-15 (a): a mark that is not well-formed is MISSING', () => {
  const cases: readonly (readonly [string, (m: Raw) => void, readonly string[]])[] = [
    ['a track without a class', (m: Raw) => void delete m.tracks[0]?.sourceClass, ['SOURCE_CLASS_MISSING tracks.0.sourceClass']],
    ['an interval without a class', (m: Raw) => void delete m.audio.sourceIntervals[1]?.sourceClass, ['SOURCE_CLASS_MISSING audio.sourceIntervals.1.sourceClass']],
    ['every class gone', (m: Raw) => [...m.tracks, ...m.audio.sourceIntervals].forEach((record) => void delete record.sourceClass), ['SOURCE_CLASS_MISSING tracks.0.sourceClass', 'SOURCE_CLASS_MISSING tracks.1.sourceClass', 'SOURCE_CLASS_MISSING audio.sourceIntervals.0.sourceClass', 'SOURCE_CLASS_MISSING audio.sourceIntervals.1.sourceClass']],
    ['a class that is null', (m: Raw) => void Object.assign(m.tracks[1] ?? {}, { sourceClass: null }), ['SOURCE_CLASS_INVALID tracks.1.sourceClass']],
    ['a class of the two-valued device vocabulary', (m: Raw) => void Object.assign(m.tracks[0] ?? {}, { sourceClass: 'DEVELOPMENT' }), ['SOURCE_CLASS_INVALID tracks.0.sourceClass']],
    ['a class in another case', (m: Raw) => void Object.assign(m.tracks[0] ?? {}, { sourceClass: 'production' }), ['SOURCE_CLASS_INVALID tracks.0.sourceClass']],
    ['no flag', (m: Raw) => void delete m.developmentSources, ['DEVELOPMENT_FLAG_MISSING developmentSources']],
    ['a flag that is a string', (m: Raw) => void (m.developmentSources = 'true'), ['DEVELOPMENT_FLAG_INVALID developmentSources']],
    ['a flag that is null', (m: Raw) => void (m.developmentSources = null), ['DEVELOPMENT_FLAG_INVALID developmentSources']],
    ['no track record at all (no source is never "all production")', (m: Raw) => void (m.tracks = []), ['SOURCE_CLASS_MISSING tracks']],
    ['tracks that is no list', (m: Raw) => void ((m as Record<string, unknown>).tracks = { sourceClass: 'PRODUCTION' }), ['SOURCE_CLASS_MISSING tracks']],
    ['no interval list', (m: Raw) => void ((m.audio as Record<string, unknown>).sourceIntervals = undefined), ['SOURCE_CLASS_MISSING audio.sourceIntervals']],
  ];
  it.each(cases)('%s', async (_name, change, found) => {
    const result = await run(altered(change));
    expect(v15(result)).toEqual({ status: 'FAIL', failureClass: 'MISSING', found });
    expect(result.ok).toBe(false);
    expect(result.sources).toMatchObject({ ok: false, code: 'NOT_TRUSTWORTHY', development: null });
  });
});

describe('V-15 (b): a mark that is not consistent is CORRUPT', () => {
  const cases: readonly (readonly [string, readonly SessionCaptureSourceRow[] | undefined, (m: Raw) => void, readonly string[]])[] = [
    ['development classes, the flag says false', undefined, (m: Raw) => void (m.developmentSources = false), ['DEVELOPMENT_FLAG_INCONSISTENT developmentSources']],
    ['all PRODUCTION, the flag says true', PRODUCTION_ROWS, (m: Raw) => void (m.developmentSources = true), ['DEVELOPMENT_FLAG_INCONSISTENT developmentSources']],
    ['one class turned to PRODUCTION leaves the flag true: consistent, so nothing here (the hash and the signature catch that edit)', undefined, (m: Raw) => void Object.assign(m.tracks[0] ?? {}, { sourceClass: 'PRODUCTION' }), []],
    [
      'every class turned to PRODUCTION, the flag left true',
      undefined,
      (m: Raw) => [...m.tracks, ...m.audio.sourceIntervals].forEach((record) => void (record.sourceClass = 'PRODUCTION')),
      ['DEVELOPMENT_FLAG_INCONSISTENT developmentSources'],
    ],
    [
      'one microphone with two classes',
      undefined,
      (m: Raw) => {
        const [first, second] = m.audio.sourceIntervals;
        if (first !== undefined && second !== undefined) second.micDeviceId = first.micDeviceId;
      },
      ['MIC_SOURCE_CLASS_INCONSISTENT audio.sourceIntervals.1.sourceClass'],
    ],
  ];
  it.each(cases)('%s', async (_name, rows, change, found) => {
    const result = await run(altered(change, rows));
    if (found.length === 0) expect(result.checks.find((check) => check.id === 'V-15')?.findings).toEqual([]);
    else expect(v15(result)).toEqual({ status: 'FAIL', failureClass: 'CORRUPT', found });
  });
});

describe('V-15 has nothing to read without a v2 manifest object', () => {
  it.each([
    ['no manifest', undefined],
    ['no JSON', '{ not json'],
    ['a JSON list', []],
    ['a v1 manifest', { schema: 'dems.evidence-manifest/1', tracks: [] }],
    ['an object of another schema with a perfect mark', { schema: 'x', developmentSources: false, tracks: [{ sourceClass: 'PRODUCTION' }], audio: { sourceIntervals: [] } }],
  ])('%s: SKIPPED (never PASS), sources UNKNOWN', async (_name, value) => {
    const result = await run(value);
    const check = result.checks.find((entry) => entry.id === 'V-15');
    expect(check).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED', findings: [] });
    expect(result.sources).toEqual({ ok: false, code: 'UNKNOWN', development: null, report: 'Sources: unknown — the manifest cannot be read', lines: [], tracks: [], audioIntervals: [] });
  });

  it('a well-formed mark in a manifest V-01 refuses for another reason is not vouched for: SKIPPED, not PASS', async () => {
    const result = await run(altered((m) => void delete (m as Record<string, unknown>).caseNumber));
    expect(result.checks.find((entry) => entry.id === 'V-01')?.status).toBe('FAIL');
    expect(result.checks.find((entry) => entry.id === 'V-15')).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED' });
  });
});

describe('the failure table', () => {
  it('the codes of V-15: (a) MISSING, (b) CORRUPT', () => {
    const codes = Object.entries(VERIFY_FAILURES).filter(([, rule]) => rule.check === 'V-15').map(([code, rule]) => `${code} ${rule.failureClass}`);
    expect(codes).toEqual([
      'SOURCE_CLASS_MISSING MISSING',
      'SOURCE_CLASS_INVALID MISSING',
      'DEVELOPMENT_FLAG_MISSING MISSING',
      'DEVELOPMENT_FLAG_INVALID MISSING',
      'DEVELOPMENT_FLAG_INCONSISTENT CORRUPT',
      'MIC_SOURCE_CLASS_INCONSISTENT CORRUPT',
    ]);
  });
});
