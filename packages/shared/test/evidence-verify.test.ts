// Verify v2 in the shared package (blueprint row 85): what can be held WITHOUT a file system, a
// key or a signer - the folder is platform neutral, the check table is complete, and a verdict is
// never a pass by default. The 14 checks against real packages on disk (real bytes, AES-256-GCM,
// Ed25519) are in `apps/core-server/src/evidence-verify/__tests__/`.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PackageFile } from '../src/evidence-package';
import {
  SIGNED_BY_COMPROMISED_KEY_REPORT,
  VERIFY_FAILURES,
  VERIFY_NOTICE,
  hostProfileNotAskedReport,
  VERIFY_V2_CHECKS,
  VerifiedSigningKeyMark,
  pemCertificateSha256,
  verifyPackageV2,
  type PackageReader,
  type PackageVerifyResult,
  type VerifyNotice,
  type VerifyPorts,
} from '../src/evidence-verify';
import { en } from '../src/i18n';
import {
  CORE_API_EXAMPLES,
  EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE,
  EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE,
  EvidenceTranscriptModelSchema,
  TRANSCRIPT_REVISION_REASON_EXAMPLE,
  VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE,
  VERIFY_REPORT_CHECK_STATUSES,
} from '../src/api';
import {
  REVISION_REASON_MAX,
  REVISION_REASON_MEMBER,
  TRANSCRIPT_MODEL_MEMBER,
  TRANSCRIPT_MODEL_TEXT_MAX,
  V2_FILE_PART_CHECK,
  readRevisionReason,
  readTranscriptModel,
  v2FilePartOutcome,
  type V2FilePart,
  type V2PartOutcome,
} from '../src/evidence-rules';

const DIR = fileURLToPath(new URL('../src/evidence-verify/', import.meta.url));
const files = readdirSync(DIR).filter((name) => name.endsWith('.ts'));
const code = (name: string): string =>
  readFileSync(`${DIR}${name}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

describe('the folder is platform neutral: the Core and a receiver of a copy run the same rules', () => {
  it('holds the five files of the unit', () => {
    expect(files.sort()).toEqual(['index.ts', 'report.ts', 'revisions.ts', 'types.ts', 'verify.ts']);
  });

  it('imports zod, the hash library and the package format only: no Node built-in, no file system, no cryptography module', () => {
    const seen = new Set<string>();
    for (const name of files) for (const match of code(name).matchAll(/\bfrom\s+'([^']+)'/g)) seen.add(match[1] ?? '');
    expect([...seen].sort()).toEqual(['../evidence-package', './report', './revisions', './types', './verify', '@noble/hashes/sha2.js', '@noble/hashes/utils.js', 'zod']);
  });

  it('uses no Node global, no clock, no chance and no log', () => {
    const refused = /\bBuffer\b|\bprocess\b|\brequire\s*\(|\bDate\b|\bperformance\b|\bMath\s*\.\s*random\b|\bconsole\b|\bsetTimeout\b|\bfetch\s*\(/;
    expect(files.filter((name) => refused.test(code(name)))).toEqual([]);
    // Positive control: the scan reads code.
    expect(code('verify.ts')).toMatch(/export async function verifyPackageV2/);
  });
});

describe('the check table', () => {
  it('is V-01 to V-15, in order, and every check has a failure code', () => {
    expect(VERIFY_V2_CHECKS.map((check) => check.id)).toEqual(Array.from({ length: 15 }, (_, index) => `V-${String(index + 1).padStart(2, '0')}`));
    const used = new Set(Object.values(VERIFY_FAILURES).map((rule) => rule.check));
    expect([...used].sort()).toEqual(VERIFY_V2_CHECKS.map((check) => check.id));
  });
});

// Task 4 row V4 (decision C77; SX-09 (d); rows 227, 227b): the notice of a package under a key that
// was later marked compromised, and the state a receiver's verifier shows. The Core server sends
// the notice since row 227 by a constant of its own; these are the shared members it sends.
describe('row V4: `SIGNED_BY_COMPROMISED_KEY`, the notice and the state of the signing key', () => {
  it('the vocabulary holds the member, last; the three earlier codes did not move', () => {
    // Row V6 (decision C97; row P1's request): `HOST_PROFILE_NOT_ASKED` was ADDED after it; the four earlier codes did not move.
    // Row R1b (decision C99): `VIDEO_ABSENT_IN_SESSION` was ADDED after it; the five earlier codes did not move.
    // Pass I-9b: `AUDIO_ABSENT_ON_RESTART` was ADDED after it; the six earlier codes did not move.
    expect(Object.values(VERIFY_NOTICE)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED', 'EXPORT_FOLDER_UNEXPECTED_FILE', 'REVISION_APPEND_PENDING', 'SIGNED_BY_COMPROMISED_KEY', 'HOST_PROFILE_NOT_ASKED', 'VIDEO_ABSENT_IN_SESSION', 'AUDIO_ABSENT_ON_RESTART']);
    // Its line: the manifest's platform word only when it is one lower-case word; anything else is stated without a name.
    expect(hostProfileNotAskedReport('darwin')).toBe('Host profile: NOT ASKED. This package was sealed by a production Core on darwin, where the checks of the host profile are not run.');
    for (const platform of ['<b>darwin</b>', 'Darwin', 'darwin linux', '', 'x'.repeat(17), null, undefined, 7]) {
      expect(hostProfileNotAskedReport(platform)).toBe('Host profile: NOT ASKED. This package was sealed by a production Core, where the checks of the host profile are not run.');
    }
    expect(hostProfileNotAskedReport('darwin').length).toBeLessThanOrEqual(256);
    expect(Object.entries(VERIFY_NOTICE).every(([key, value]) => key === value)).toBe(true);
  });

  it('the report lines are EXACTLY what the Core server sends for a pass on its stored digest and for a failure, plus the line of a receiver; each fits the contract', () => {
    expect(Object.keys(SIGNED_BY_COMPROMISED_KEY_REPORT)).toEqual(['COMPROMISED_KEY_STORED_DIGEST', 'COMPROMISED_KEY_NOT_STORED_DIGEST', 'COMPROMISED_KEY_NO_RECORD']);
    // Character for character the two strings of `COMPROMISED_KEY_NOTICE_REPORT` (apps/core-server/src/evidence-verify/index.ts, row 227).
    expect(SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_STORED_DIGEST).toBe(
      'Signing key: MARKED COMPROMISED after this package was sealed. The signature alone proves nothing any more; the package passes because its manifest digest is the one this Core recorded when it sealed the item.',
    );
    expect(SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_NOT_STORED_DIGEST).toBe('Signing key: MARKED COMPROMISED, and the package is not the one this Core recorded when it sealed the item: not verified.');
    for (const [name, line] of Object.entries(SIGNED_BY_COMPROMISED_KEY_REPORT)) {
      expect(line, name).toMatch(/^Signing key: MARKED COMPROMISED/);
      // The contract of operation 41: a code of the open form and a trimmed line of at most 256 characters.
      expect(line.length, name).toBeLessThanOrEqual(256);
      expect(line.trim(), name).toBe(line);
      const notice: VerifyNotice = { code: VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY, report: line };
      expect(notice.code).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
    }
    // The receiver's line states the state and NO verdict word: since row V5 the verdict beside it is NOT A PASS (V-13 / V-11 fail by name), said by the checks.
    expect(SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_NO_RECORD).not.toMatch(/passes|not verified|verified|fail/i);
    // Only a pass says "passes", only the failure says "not verified".
    expect(SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_STORED_DIGEST).toMatch(/passes because/);
    expect(SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_NOT_STORED_DIGEST).toMatch(/not verified\.$/);
  });

  it('the state of the mark is three values, and absent means NOT_ESTABLISHED: `verifyPackageV2` is told of no marked key, so no result of it carries the member or the notice', async () => {
    expect(Object.values(VerifiedSigningKeyMark)).toEqual(['NOT_ESTABLISHED', 'NOT_MARKED', 'COMPROMISED']);
    const absent: PackageReader = { entry: async () => ({ kind: 'ABSENT' }), readText: async () => Promise.reject(new Error('absent')), readRange: async () => Promise.reject(new Error('absent')), list: async () => [] };
    const result = await verifyPackageV2({ reader: absent, opener: null, readCertificate: () => null, verifySignature: () => false });
    expect('compromisedKey' in result.signature).toBe(false);
    expect(result.notices.map((notice) => notice.code)).not.toContain(VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY);
    expect(Object.keys(result.signature)).toEqual(['ok', 'algorithm', 'keyId', 'simulated', 'developmentKey', 'integrityCheckedWithoutKey']);
    // The member is optional in the type: a result without it is a whole result, one with it names one of the three.
    const marked: PackageVerifyResult['signature'] = { ...result.signature, compromisedKey: VerifiedSigningKeyMark.COMPROMISED };
    expect(marked.compromisedKey).toBe('COMPROMISED');
  });

  it('row V5 (C84 R-2): the verifier is TOLD the marked fingerprints through one optional input - handed the list (the empty one too) it states the mark, and of a package it could not rely on it states NOT_ESTABLISHED; the two failure codes exist for V-13 and V-11 and nothing else names a mark', async () => {
    const absent: PackageReader = { entry: async () => ({ kind: 'ABSENT' }), readText: async () => Promise.reject(new Error('absent')), readRange: async () => Promise.reject(new Error('absent')), list: async () => [] };
    const ports: VerifyPorts = { reader: absent, opener: null, readCertificate: () => null, verifySignature: () => false };
    const before = await verifyPackageV2(ports, { expected: { trustedCertificateSha256: ['ab'.repeat(32)] } });
    for (const compromisedCertificateSha256 of [[], ['ab'.repeat(32)]]) {
      const told = await verifyPackageV2(ports, { expected: { trustedCertificateSha256: ['ab'.repeat(32)], compromisedCertificateSha256 } });
      expect(Object.keys(told.signature)).toEqual(['ok', 'algorithm', 'keyId', 'simulated', 'developmentKey', 'compromisedKey', 'integrityCheckedWithoutKey']);
      expect(told.signature.compromisedKey).toBe('NOT_ESTABLISHED');
      // Nothing else of the result moves: the same verdict, checks and notices as without the list.
      const { compromisedKey: _mark, ...signature } = told.signature;
      expect({ ...told, signature }).toEqual(before);
    }
    expect('compromisedKey' in before.signature).toBe(false);
    expect(VERIFY_FAILURES.CERTIFICATE_KEY_COMPROMISED).toEqual({ check: 'V-13', failureClass: 'TAMPERED' });
    expect(VERIFY_FAILURES.REVISION_CERTIFICATE_KEY_COMPROMISED).toEqual({ check: 'V-11', failureClass: 'TAMPERED' });
    expect(Object.keys(VERIFY_FAILURES).filter((name) => /COMPROMISED/.test(name))).toEqual(['REVISION_CERTIFICATE_KEY_COMPROMISED', 'CERTIFICATE_KEY_COMPROMISED']);
    // The input is read in three places of the verifier and nowhere else: the seal's certificate, a revision's, the result.
    expect(code('verify.ts').match(/compromisedCertificateSha256/g)).toHaveLength(3);
  });

  it('the clients word the notice as a state of the signing key: three sentences, none under the title of what the signature does not cover', () => {
    const words = en.evidence.verifyV2Key.compromisedKey;
    expect(Object.keys(words)).toEqual(['title', 'storedDigest', 'notStoredDigest', 'noRecord']);
    expect(words.title).not.toBe(en.evidence.verifyV2Key.noticesTitle);
    for (const sentence of [words.storedDigest, words.notStoredDigest, words.noRecord]) {
      expect(sentence).toMatch(/marked compromised/);
      expect(sentence).not.toContain('{{');
    }
    expect(words.storedDigest).toMatch(/It passes because/);
    expect(words.notStoredDigest).toMatch(/It is not verified\.$/);
    expect(words.noRecord).not.toMatch(/passes|not verified|fail/i);
  });
});

describe('a verdict is never a pass by default', () => {
  const empty: PackageReader = {
    entry: async () => ({ kind: 'ABSENT' }),
    readText: async () => Promise.reject(new Error('absent')),
    readRange: async () => Promise.reject(new Error('absent')),
    list: async () => [],
  };
  const ports = (reader: PackageReader): VerifyPorts => ({ reader, opener: null, readCertificate: () => null, verifySignature: () => true });

  it('an empty folder: not ok, V-01 and V-14 fail, and no other check is called PASS', async () => {
    const result = await verifyPackageV2(ports(empty));
    expect(result.ok).toBe(false);
    expect(result.overall).toBe('MISSING');
    // V-15 (row 141) has no mark to read without a manifest: SKIPPED, not PASS.
    expect(result.checks.map((check) => check.status)).toEqual(['FAIL', ...Array.from({ length: 12 }, () => 'SKIPPED'), 'FAIL', 'SKIPPED']);
    expect(result.sources).toMatchObject({ ok: false, code: 'UNKNOWN', development: null, tracks: [], audioIntervals: [] });
    expect(result.checks.every((check) => check.status !== 'PASS')).toBe(true);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings.map((finding) => finding.file)).toContain(PackageFile.MANIFEST);
  });

  it('a reader that fails on everything: not ok, and nothing thrown', async () => {
    const broken: PackageReader = { ...empty, entry: async () => ({ kind: 'UNREADABLE' }), list: async () => null };
    const result = await verifyPackageV2(ports(broken), { plaintext: 'WHEN_KEY_AVAILABLE' });
    expect(result.ok).toBe(false);
    expect(result.checks.filter((check) => check.status === 'PASS')).toEqual([]);
  });
});

describe('the SHA-256 of a PEM certificate', () => {
  it('is the hash of the decoded bytes, for every padding; anything that is not exactly one certificate has none', () => {
    const pem = (body: string): string => `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
    // SHA-256 of the bytes "a", "ab", "abc".
    expect(pemCertificateSha256(pem('YQ=='))).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
    expect(pemCertificateSha256(pem('YWI='))).toBe('fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603');
    expect(pemCertificateSha256(pem('YW\nJj'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const text of ['', 'YWJj', pem(''), pem('YWJ'), pem('YW=j'), pem('YWJj') + pem('YWJj'), pem('YWJj').replace('CERTIFICATE', 'PRIVATE KEY')]) {
      expect(pemCertificateSha256(text)).toBeNull();
    }
  });
});

// ── Batch N (final code review R101-03; ruling D241): ONE rule for both clients ─────────────────────
// `src/evidence-rules` holds the three pure rules the web console and the mobile apps each had a copy
// of, and that had diverged: the same answer read "FAIL" on one client and "Not run" on the other.
// The vectors are the CONTRACT'S examples; each client's own test asserts that it draws this outcome.
describe('R101-03: the client rules of an evidence answer are one module, without a dependency', () => {
  const RULES = fileURLToPath(new URL('../src/evidence-rules/', import.meta.url));
  const source = readFileSync(`${RULES}index.ts`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('one file, no import at all (no zod, no verifier, no contract, no React), no Node global, no clock, no log', () => {
    expect(readdirSync(RULES)).toEqual(['index.ts']);
    expect([...source.matchAll(/\bfrom\s+'([^']+)'|\bimport\s*\(|\brequire\s*\(/g)]).toEqual([]);
    expect(source).not.toMatch(/\bBuffer\b|\bprocess\b|\bDate\b|\bperformance\b|\bMath\s*\.\s*random\b|\bconsole\b|\bsetTimeout\b|\bfetch\s*\(/);
  });

  describe('a part of a camera-file row (operation 41): PASS, FAIL, or NOT_RUN - never FAIL for a check that did not run, never a guess', () => {
    const check = (id: string, status: (typeof VERIFY_REPORT_CHECK_STATUSES)[number]) => ({ id, status });
    const [checkedRow, notCheckedRow] = VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE;
    if (checkedRow === undefined || notCheckedRow === undefined) throw new Error('the contract example has two file rows');
    const PARTS: readonly V2FilePart[] = ['stored', 'plain', 'chain'];
    const all = (row: Parameters<typeof v2FilePartOutcome>[0], checks: Parameters<typeof v2FilePartOutcome>[2]): V2PartOutcome[] => PARTS.map((part) => v2FilePartOutcome(row, part, checks));

    it('the parts are judged by V-04, V-05 and V-06, and SKIPPED is a status of the contract', () => {
      expect(V2_FILE_PART_CHECK).toEqual({ stored: 'V-04', plain: 'V-05', chain: 'V-06' });
      expect(VERIFY_REPORT_CHECK_STATUSES).toContain('SKIPPED');
    });

    it('the contract example (VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE): the checked row passes all three; the tampered row reads FAIL / NOT_RUN / FAIL - `plainChecked` by name, per FILE, whatever V-05 says for the result', () => {
      expect(all(checkedRow, null)).toEqual(['PASS', 'PASS', 'PASS']);
      expect(notCheckedRow.plainChecked).toBe(false);
      for (const checks of [null, undefined, [], [check('V-05', 'FAIL')], [check('V-05', 'PASS')], [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'FAIL')]]) {
        expect(all(notCheckedRow, checks), JSON.stringify(checks)).toEqual(['FAIL', 'NOT_RUN', 'FAIL']);
      }
    });

    it('THE ONE RULE, each part alike: the check of the part SKIPPED in the same result -> NOT_RUN (this was FAIL on the web and "Not run" on the mobile apps for stored bytes and chain)', () => {
      const failed = { storedOk: false, plainOk: false, chainOk: false };
      expect(all(failed, [check('V-04', 'SKIPPED'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')])).toEqual(['NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
      expect(all(failed, [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')])).toEqual(['FAIL', 'NOT_RUN', 'NOT_RUN']);
      // Only the check OF THAT PART counts: another check that was skipped says nothing about it.
      expect(all(failed, [check('V-06', 'SKIPPED')])).toEqual(['FAIL', 'FAIL', 'NOT_RUN']);
      expect(all(failed, [check('V-09', 'SKIPPED'), check('V-14', 'SKIPPED')])).toEqual(['FAIL', 'FAIL', 'FAIL']);
    });

    it('NEVER A GUESS: without a statement of the answer the flag stands - no report, an empty report, a report that does not name the check, a check that ran', () => {
      const failed = { storedOk: false, plainOk: false, chainOk: false };
      for (const checks of [null, undefined, [], [check('V-01', 'PASS')], [check('V-04', 'FAIL'), check('V-05', 'FAIL'), check('V-06', 'FAIL')], [check('V-04', 'PASS'), check('V-05', 'PASS'), check('V-06', 'PASS')]]) {
        expect(all(failed, checks), JSON.stringify(checks)).toEqual(['FAIL', 'FAIL', 'FAIL']);
      }
      // `plainChecked` belongs to the plaintext part alone: it makes no other part "not run".
      expect(all({ ...failed, plainChecked: false }, null)).toEqual(['FAIL', 'NOT_RUN', 'FAIL']);
      // Only the value `false` counts: `true` is "the check ran", so the flag stands.
      expect(all({ ...failed, plainChecked: true }, null)).toEqual(['FAIL', 'FAIL', 'FAIL']);
    });

    it('a part the answer states as passed is PASS, whatever a report or `plainChecked` says beside it', () => {
      const passed = { storedOk: true, plainOk: true, chainOk: true };
      expect(all(passed, [check('V-04', 'SKIPPED'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')])).toEqual(['PASS', 'PASS', 'PASS']);
      expect(all({ ...passed, plainChecked: false }, null)).toEqual(['PASS', 'PASS', 'PASS']);
    });
  });

  describe('the transcript model (`transcriptModel`): the bounds are the contract\'s, once', () => {
    it('reads the two contract examples member for member, by the member name of the contract', () => {
      expect(TRANSCRIPT_MODEL_MEMBER).toBe('transcriptModel');
      expect(readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE)).toEqual(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE);
      expect(readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE)).toEqual(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE);
    });

    it.each(['name', 'version', 'quantisation', 'report'] as const)('`%s`: the reader and the contract schema accept the same longest text (256) and refuse the same one above it', (member) => {
      expect(TRANSCRIPT_MODEL_TEXT_MAX).toBe(256);
      const at = { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, [member]: 'm'.repeat(TRANSCRIPT_MODEL_TEXT_MAX) };
      const over = { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, [member]: 'm'.repeat(TRANSCRIPT_MODEL_TEXT_MAX + 1) };
      expect(EvidenceTranscriptModelSchema.safeParse(at).success).toBe(true);
      expect(EvidenceTranscriptModelSchema.safeParse(over).success).toBe(false);
      expect(readTranscriptModel(at)?.[member]).toBe('m'.repeat(TRANSCRIPT_MODEL_TEXT_MAX));
      // Above the bound: a REQUIRED member makes the model "not stated"; an optional one is null on its own.
      const read = readTranscriptModel(over);
      if (member === 'name' || member === 'report') expect(read).toBeNull();
      else expect(read).toEqual({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, [member]: null });
    });

    it('not stated, never a default: no object, a missing or blank name or report, a `reportedByServer` that is no boolean; a hash that is no SHA-256 is null alone', () => {
      for (const value of [null, undefined, 'x', 7, [], {}, { name: 'x' }, { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, name: '   ' }, { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, report: '' }, { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, reportedByServer: 'no' }]) {
        expect(readTranscriptModel(value), JSON.stringify(value)).toBeNull();
      }
      expect(readTranscriptModel({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, modelSha256: 'abc' })).toEqual({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, modelSha256: null });
      expect(readTranscriptModel({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, version: 3, quantisation: ' ' })).toEqual({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, version: null, quantisation: null });
    });
  });

  describe('the reason of a transcript revision (`reason`, operations 85 and 86)', () => {
    it('reads the reason of the two registry examples; the member name is the contract\'s', () => {
      expect(REVISION_REASON_MEMBER).toBe('reason');
      const created = (CORE_API_EXAMPLES['createTranscriptRevision']?.responses[201] as Record<string, { value: unknown }> | undefined) ?? {};
      const listed = (CORE_API_EXAMPLES['listTranscriptRevisions']?.responses[200] as Record<string, { value: { items?: unknown[] } }> | undefined) ?? {};
      const revisions = [...Object.values(created).map((example) => example.value), ...Object.values(listed).flatMap((example) => example.value.items ?? [])];
      expect(revisions.length).toBeGreaterThanOrEqual(2);
      expect(revisions.map(readRevisionReason)).toEqual(revisions.map(() => TRANSCRIPT_REVISION_REASON_EXAMPLE));
      expect(readRevisionReason({ [REVISION_REASON_MEMBER]: TRANSCRIPT_REVISION_REASON_EXAMPLE })).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE);
    });

    it('ONE reading: trimmed, 1 to 500 characters after trimming; anything else is "not reported" (null)', () => {
      expect(REVISION_REASON_MAX).toBe(500);
      expect(readRevisionReason({ reason: '  Misheard name corrected \n' })).toBe('Misheard name corrected');
      expect(readRevisionReason({ reason: 'r'.repeat(500) })).toBe('r'.repeat(500));
      // The bound is on the TRIMMED text: blanks around a 500-character reason do not hide it (the web's old reading did).
      expect(readRevisionReason({ reason: ` ${'r'.repeat(500)} ` })).toBe('r'.repeat(500));
      for (const value of [{ reason: 'r'.repeat(501) }, { reason: '' }, { reason: '   ' }, { reason: 7 }, { reason: null }, {}, { note: 'x' }, null, undefined, 'reason', []]) {
        expect(readRevisionReason(value), JSON.stringify(value)).toBeNull();
      }
    });
  });
});
