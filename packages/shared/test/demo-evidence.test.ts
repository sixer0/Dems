/**
 * Step 93: the DEMO evidence packages (D50, D51, D61; design book §11.2–§11.4, §19.2).
 *
 * Recomputes every SHA-256 from the files on disk, verifies every Ed25519 signature and the certificate
 * with Node crypto (X509Certificate), proves that exactly one package (the TAMPERED one) fails and that it
 * fails exactly one check (its altered track), checks the §11.2 / §11.3 / §19.2 layouts and the export zip,
 * and cross-checks the pure verify helper and the typed index against the files.
 */
import { createHash, createPrivateKey, createPublicKey, verify, webcrypto, X509Certificate } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EvidenceExportAcceptedSchema, EvidenceExportRequestSchema, sessionCreateSchema } from '../src/api';
import {
  checkOrder,
  DEMO_DEVICE_CERTIFICATE_PEM,
  DEMO_EVIDENCE_DOCUMENTS,
  DEMO_EVIDENCE_INDEX,
  demoIdSuffix,
  demoVerificationTrust,
  EXPORT_MANIFEST_ITEMS,
  getDemoEvidenceDocuments,
  getDemoEvidencePackage,
  getDemoEvidencePackageBySession,
  MANIFEST_FIELDS,
  PACKAGE_ITEM_FILES,
  parseAuditExtract,
  precomputedReport,
  sha256HexOfText,
  verifyDemoPackage,
  type DemoCheckResult,
  type DemoEvidencePackage,
} from '../src/demo-data';
import { auditBody, chainHash } from '../src/sim/events';
import { DEFAULT_SEED } from '../src/sim/constants';
import { IDLE_COUNTERS, RECORDING_SCENARIO } from '../src/sim/dataset';
import { DEFAULT_TAMPER_TRACK } from '../src/sim/evidence';
import { createIdleState } from '../src/sim/initial-state';
import { DEMO_EVIDENCE_README_NOTE, DEMO_MEDIA_README_NOTE } from '../scripts/demo-readme-notes';

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(PKG_DIR, 'assets');
const EVIDENCE_DIR = join(ASSETS, 'demo-evidence');
const DEMO_DATA_DIR = join(PKG_DIR, 'src', 'demo-data');
const INDEX = DEMO_EVIDENCE_INDEX;
const PACKAGES = INDEX.packages;

const read = (assetPath: string): Buffer => readFileSync(join(ASSETS, assetPath));
const sha256 = (bytes: Uint8Array | string): Buffer => createHash('sha256').update(bytes).digest();
const sha256Hex = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const json = <T>(assetPath: string): T => JSON.parse(read(assetPath).toString('utf8')) as T;

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(root, path));
    }
  };
  walk(root);
  return out.sort();
}

interface ManifestTrack {
  trackId: string;
  file: string;
  bytes: number;
  sha256: string;
  hashAlgorithm: string;
}
interface Manifest {
  demo: boolean;
  evidenceId: string;
  sessionId: string;
  tracks: ManifestTrack[];
  finalizationStatus: string;
  signature: { algorithm: string; keyId: string; certificate: { sha256: string } };
  [key: string]: unknown;
}
interface SignatureDoc {
  demo: boolean;
  notice: string;
  algorithm: string;
  keyId: string;
  signedFile: string;
  digest: string;
  signature: string;
  certificateSha256: string;
}
interface Container {
  demo: boolean;
  payload: { tracks: { trackId: string; path: string; bytes: number }[] };
}

const certificate = new X509Certificate(DEMO_DEVICE_CERTIFICATE_PEM);

/** Node-crypto verification of one package from its files, check by check (independent of the index values). */
function nodeChecks(pkg: DemoEvidencePackage): { id: string; ok: boolean }[] {
  const folder = pkg.folder;
  const manifestBytes = read(`${folder}/${PACKAGE_ITEM_FILES.manifest}`);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
  const container = json<Container>(`${folder}/${PACKAGE_ITEM_FILES.container}`);
  const signature = json<SignatureDoc>(`${folder}/${PACKAGE_ITEM_FILES.signature}`);
  const x509 = new X509Certificate(read(`${folder}/${PACKAGE_ITEM_FILES.certificate}`));
  const checks: { id: string; ok: boolean }[] = manifest.tracks.map((track) => {
    const stored = container.payload.tracks.find((entry) => entry.trackId === track.trackId);
    return { id: `track:${track.trackId}`, ok: stored !== undefined && sha256Hex(read(stored.path)) === track.sha256 };
  });
  checks.push({ id: 'manifest', ok: sha256Hex(manifestBytes) === signature.digest });
  checks.push({
    id: 'signature',
    ok: verify(null, sha256(manifestBytes), x509.publicKey, Buffer.from(signature.signature, 'base64')),
  });
  const signedAt = Date.parse(pkg.signature.signedAt);
  checks.push({
    id: 'certificate',
    ok:
      x509.verify(x509.publicKey) &&
      sha256Hex(x509.raw) === INDEX.certificate.sha256 &&
      x509.subject.includes('DEMO — NOT FOR PRODUCTION') &&
      signedAt >= x509.validFromDate.getTime() &&
      signedAt <= x509.validToDate.getTime(),
  });
  const rows = parseAuditExtract(read(`${folder}/${PACKAGE_ITEM_FILES.auditExtract}`).toString('utf8'));
  checks.push({
    id: 'auditChain',
    ok: rows.every(
      (row, index) =>
        chainHash(row.prevHash, auditBody(row)) === row.hash &&
        (index === 0 ||
          (row.seq > (rows[index - 1]?.seq ?? 0) &&
            (row.seq !== (rows[index - 1]?.seq ?? 0) + 1 || row.prevHash === rows[index - 1]?.hash))),
    ),
  });
  if (pkg.export) {
    const exportManifestBytes = read(pkg.export.manifest.path);
    const exportManifest = JSON.parse(exportManifestBytes.toString('utf8')) as { package: { sha256: string } };
    checks.push({ id: 'exportPackage', ok: sha256Hex(read(pkg.export.zip.path)) === exportManifest.package.sha256 });
    const exportSignature = json<SignatureDoc>(pkg.export.signature.path);
    checks.push({
      id: 'exportSignature',
      ok: verify(null, sha256(exportManifestBytes), x509.publicKey, Buffer.from(exportSignature.signature, 'base64')),
    });
  }
  return checks;
}

// ── Minimal zip reader (central directory, stored and deflated entries) ─────────────────────────
interface ZipEntry {
  name: string;
  method: number;
  crc: number;
  data: Buffer;
  extraLength: number;
}
function readZip(zip: Buffer): ZipEntry[] {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('No end of central directory');
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Bad central directory entry');
    const method = zip.readUInt16LE(offset + 10);
    const crc = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localName = zip.readUInt16LE(localOffset + 26);
    const localExtra = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const raw = zip.subarray(start, start + compressedSize);
    entries.push({ name, method, crc, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw), extraLength: extraLength + localExtra });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

describe('demo evidence index (step 93)', () => {
  it('covers EV 0001–0013 of the dataset plus the recording scenario item, joined by evidence suffix', () => {
    const now = Date.parse(INDEX.datasetNow);
    const sim = createIdleState({ now, seed: DEFAULT_SEED });
    expect(sim.evidence).toHaveLength(13);
    for (const item of sim.evidence) {
      const pkg = getDemoEvidencePackage(item.id);
      expect(pkg, item.id).not.toBeNull();
      expect(pkg?.evidenceId).toBe(item.id);
      expect(pkg?.sessionId).toBe(item.sessionId);
      expect(pkg?.caseNumber).toBe(item.caseNumber);
      expect(pkg?.subjectName).toBe(item.subjectName);
      expect(pkg?.status).toBe(item.status);
      expect(pkg?.origin).toBe('DATASET');
    }
    const liveSuffix = String(IDLE_COUNTERS.evidence).padStart(4, '0');
    const live = getDemoEvidencePackage(liveSuffix);
    expect(live?.origin).toBe('RECORDING_SCENARIO');
    expect(live?.sessionSuffix).toBe(String(RECORDING_SCENARIO.sessionSeq).padStart(4, '0'));
    expect(INDEX.liveSession).toEqual({ sessionSuffix: live?.sessionSuffix, evidenceSuffixWhenSealed: liveSuffix });
    expect(PACKAGES.map((pkg) => pkg.evidenceSuffix)).toEqual(
      Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(4, '0')),
    );
  });

  it('keeps evidence and session suffixes in separate namespaces', () => {
    expect(demoIdSuffix('EV-20260930-0004', 'EV')).toBe('0004');
    expect(demoIdSuffix('SES-20260930-0014', 'EV')).toBeNull();
    expect(demoIdSuffix(4, 'EV')).toBe('0004');
    expect(getDemoEvidencePackageBySession('0014')?.evidenceSuffix).toBe('0004');
    expect(getDemoEvidencePackage('0014')?.sessionSuffix).toBe('0024');
    expect(getDemoEvidencePackage('SES-20260930-0014')).toBeNull();
    expect(getDemoEvidencePackage('9999')).toBeNull();
  });

  it('labels everything DEMO and derives the key from the published seed phrase', () => {
    expect(INDEX.demo).toBe(true);
    expect(INDEX.notice).toMatch(/^DEMO/);
    expect(INDEX.key.keyId).toMatch(/DEMO/);
    expect(INDEX.certificate.subject).toContain('DEMO — NOT FOR PRODUCTION');
    const seed = sha256(Buffer.from(INDEX.key.seedPhrase, 'utf8'));
    const privateKey = createPrivateKey({
      key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
      format: 'der',
      type: 'pkcs8',
    });
    const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
    expect(spki.subarray(spki.length - 32).toString('hex')).toBe(INDEX.key.publicKeyHex);
    for (const pkg of PACKAGES) {
      expect(pkg.verification.label).toMatch(/^DEMO/);
      expect(pkg.verification.demo).toBe(true);
      const signature = json<SignatureDoc>(pkg.files.signature.path);
      expect(signature.demo).toBe(true);
      expect(signature.notice).toMatch(/^DEMO SIGNATURE/);
      expect(signature.keyId).toBe(INDEX.key.keyId);
    }
  });

  it('writes no private-key file anywhere and keeps Node built-ins out of src/demo-data', () => {
    // Every output of the generator: the packages and the generated modules (the key lives only in memory).
    const scanned = [
      ...listFiles(EVIDENCE_DIR).map((path) => join(EVIDENCE_DIR, path)),
      ...listFiles(DEMO_DATA_DIR).map((path) => join(DEMO_DATA_DIR, path)),
    ];
    expect(scanned.length).toBeGreaterThan(PACKAGES.length * 6);
    for (const path of scanned) {
      const text = readFileSync(path).toString('latin1');
      expect(text.includes('PRIVATE KEY'), path).toBe(false);
      expect(/\.(key|p8|pk8|der)$/i.test(path), path).toBe(false);
    }
    for (const path of listFiles(DEMO_DATA_DIR)) {
      expect(readFileSync(join(DEMO_DATA_DIR, path), 'utf8').includes('node:'), path).toBe(false);
    }
  });
});

describe('demo evidence packages: layout (§11.2, §11.3)', () => {
  it('every package folder holds the §11.2 items and nothing unexpected', () => {
    const folders = readdirSync(EVIDENCE_DIR).filter((name) => name.startsWith('SESSION-')).sort();
    expect(folders).toEqual(PACKAGES.map((pkg) => pkg.folder.split('/')[1]).sort());
    for (const pkg of PACKAGES) {
      const files = listFiles(join(ASSETS, pkg.folder));
      const expected = [
        ...Object.values(PACKAGE_ITEM_FILES),
        ...(pkg.tampered ? [`media/${pkg.tamperedTrackId ?? ''}.m4a`] : []),
        ...(pkg.export ? [`export/${pkg.export.exportId}.zip`, 'export/export-manifest.json', 'export/export-manifest.sig'] : []),
      ].sort();
      expect(files, pkg.folder).toEqual(expected);
      expect(pkg.folder).toBe(`demo-evidence/SESSION-${pkg.sessionId}`);
    }
  });

  it('every manifest holds the 13 §11.3 fields with four SHA-256 track hashes', () => {
    expect(MANIFEST_FIELDS).toHaveLength(13);
    for (const pkg of PACKAGES) {
      const manifest = json<Manifest>(pkg.files.manifest.path);
      for (const field of MANIFEST_FIELDS) {
        expect(manifest[field.key], `${pkg.evidenceId} §11.3 field ${field.n} ${field.key}`).toBeDefined();
        expect(manifest[field.key], `${pkg.evidenceId} ${field.key}`).not.toBeNull();
      }
      expect(manifest.demo).toBe(true);
      expect(manifest.sessionId).toBe(pkg.sessionId);
      expect(manifest.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
      for (const track of manifest.tracks) {
        expect(track.hashAlgorithm).toBe('SHA-256');
        expect(track.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(manifest.signature.algorithm).toBe('Ed25519');
      expect(manifest.signature.certificate.sha256).toBe(INDEX.certificate.sha256);
      expect(manifest.finalizationStatus).toBe(pkg.finalizationStatus);
      expect(manifest.finalizationStatus).toBe(pkg.status === 'RECORDED' ? 'INCOMPLETE' : 'SEALED');
    }
  });

  it('the index file refs match the files on disk', () => {
    for (const pkg of PACKAGES) {
      for (const ref of Object.values(pkg.files)) {
        const bytes = read(ref.path);
        expect(bytes.length, ref.path).toBe(ref.bytes);
        expect(sha256Hex(bytes), ref.path).toBe(ref.sha256);
      }
      for (const track of pkg.tracks) {
        const bytes = read(track.stored.path);
        expect(sha256Hex(bytes), track.stored.path).toBe(track.stored.sha256);
        expect(bytes.length).toBe(track.stored.bytes);
        for (const asset of [track.poster, track.thumbnail, track.mobile?.media, track.mobile?.poster]) {
          if (asset) expect(existsSync(join(ASSETS, asset.path)), asset.path).toBe(true);
        }
      }
      expect(pkg.signature.signedDigest).toBe(sha256Hex(read(pkg.files.manifest.path)));
    }
  });

  it('the documents module is byte-identical to the package files', () => {
    for (const pkg of PACKAGES) {
      const docs = getDemoEvidenceDocuments(pkg.evidenceId);
      expect(docs, pkg.evidenceId).not.toBeNull();
      expect(docs?.manifestJson).toBe(read(pkg.files.manifest.path).toString('utf8'));
      expect(docs?.metadataJson).toBe(read(pkg.files.metadata.path).toString('utf8'));
      expect(docs?.signatureSig).toBe(read(pkg.files.signature.path).toString('utf8'));
      expect(sha256HexOfText(docs?.manifestJson ?? '')).toBe(pkg.signature.signedDigest);
      expect(docs?.exportManifestJson ?? null).toBe(pkg.export ? read(pkg.export.manifest.path).toString('utf8') : null);
      expect(read(pkg.files.certificate.path).toString('utf8')).toBe(DEMO_DEVICE_CERTIFICATE_PEM);
    }
    expect(Object.keys(DEMO_EVIDENCE_DOCUMENTS)).toHaveLength(PACKAGES.length);
  });
});

describe('demo evidence packages: hashes, signatures and the certificate (Node crypto)', () => {
  it('the certificate is self-signed, labelled DEMO, valid, and carries the DEMO public key', () => {
    expect(certificate.verify(certificate.publicKey)).toBe(true);
    expect(certificate.subject).toContain('CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION)');
    expect(certificate.subject).toContain('OU=DEMO — NOT FOR PRODUCTION');
    expect(certificate.issuer).toBe(certificate.subject);
    expect(certificate.publicKey.asymmetricKeyType).toBe('ed25519');
    expect(certificate.ca).toBe(false);
    const jwk = certificate.publicKey.export({ format: 'jwk' }) as { x: string };
    expect(Buffer.from(jwk.x, 'base64url').toString('hex')).toBe(INDEX.key.publicKeyHex);
    expect(sha256Hex(certificate.raw)).toBe(INDEX.certificate.sha256);
    expect(certificate.serialNumber.toUpperCase()).toBe(INDEX.certificate.serialNumber);
  });

  it('recomputes every track SHA-256 and verifies every Ed25519 signature', () => {
    let tracksHashed = 0;
    let signaturesVerified = 0;
    for (const pkg of PACKAGES) {
      const manifestBytes = read(pkg.files.manifest.path);
      const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
      const signature = json<SignatureDoc>(pkg.files.signature.path);
      expect(signature.signedFile).toBe('manifest.json');
      expect(signature.digest).toBe(sha256Hex(manifestBytes));
      expect(verify(null, sha256(manifestBytes), certificate.publicKey, Buffer.from(signature.signature, 'base64'))).toBe(true);
      expect(Buffer.from(signature.signature, 'base64').toString('hex')).toBe(pkg.signature.signatureHex);
      signaturesVerified += 1;
      for (const track of manifest.tracks) {
        const entry = pkg.tracks.find((item) => item.trackId === track.trackId);
        expect(entry?.sealedSha256).toBe(track.sha256);
        const actual = sha256Hex(read(entry?.stored.path ?? ''));
        tracksHashed += 1;
        if (entry?.altered) expect(actual).not.toBe(track.sha256);
        else expect(actual, `${pkg.evidenceId} ${track.trackId}`).toBe(track.sha256);
      }
      if (pkg.export) {
        const exportManifestBytes = read(pkg.export.manifest.path);
        const exportSignature = json<SignatureDoc>(pkg.export.signature.path);
        expect(exportSignature.digest).toBe(sha256Hex(exportManifestBytes));
        expect(verify(null, sha256(exportManifestBytes), certificate.publicKey, Buffer.from(exportSignature.signature, 'base64'))).toBe(true);
        signaturesVerified += 1;
      }
    }
    expect(tracksHashed).toBe(PACKAGES.length * 4);
    expect(signaturesVerified).toBe(PACKAGES.length + INDEX.exportedEvidenceSuffixes.length);
  });

  it('each audit extract recomputes with the simulator chain rule', () => {
    for (const pkg of PACKAGES) {
      const rows = parseAuditExtract(read(pkg.files.auditExtract.path).toString('utf8'));
      expect(rows).toHaveLength(pkg.audit.rows);
      for (const row of rows) expect(chainHash(row.prevHash, auditBody(row)), `${pkg.evidenceId} seq ${row.seq}`).toBe(row.hash);
      expect(rows.every((row) => row.sessionId === pkg.sessionId || row.evidenceId === pkg.evidenceId || row.type === 'AUTH_SUCCESS')).toBe(true);
      expect(rows[rows.length - 1]?.hash).toBe(pkg.audit.lastHash);
    }
  });
});

describe('demo evidence packages: verification outcomes', () => {
  it('exactly one package is TAMPERED, and it fails exactly one check: its altered track', () => {
    const tampered = PACKAGES.filter((pkg) => pkg.tampered);
    expect(tampered).toHaveLength(1);
    const [pkg] = tampered;
    expect(pkg?.evidenceSuffix).toBe(INDEX.tamperedEvidenceSuffix);
    expect(pkg?.tamperedTrackId).toBe(DEFAULT_TAMPER_TRACK);
    expect(pkg?.tracks.filter((track) => track.altered).map((track) => track.trackId)).toEqual([DEFAULT_TAMPER_TRACK]);
    for (const item of PACKAGES) {
      const failed = nodeChecks(item).filter((check) => !check.ok).map((check) => check.id);
      expect(failed, item.evidenceId).toEqual(item.tampered ? [`track:${DEFAULT_TAMPER_TRACK}`] : []);
    }
  });

  it('the precomputed results in the index agree with a fresh Node-crypto verification', () => {
    for (const pkg of PACKAGES) {
      const fresh = nodeChecks(pkg);
      expect(pkg.verification.checks.map((check) => [check.id, check.ok]), pkg.evidenceId).toEqual(fresh.map((check) => [check.id, check.ok]));
      expect(pkg.verification.result).toBe(pkg.tampered ? 'FAIL' : 'PASS');
      expect(checkOrder(pkg)).toEqual(fresh.map((check) => check.id));
      expect(precomputedReport(pkg).checks.every((check) => check.source === 'precomputed')).toBe(true);
    }
  });

  it('the pure helper re-verifies from the files (noble hashes + WebCrypto Ed25519)', async () => {
    const load = async (assetPath: string): Promise<Uint8Array> => new Uint8Array(read(assetPath));
    for (const pkg of PACKAGES) {
      const seen: DemoCheckResult[] = [];
      const report = await verifyDemoPackage(pkg, load, {
        subtle: webcrypto.subtle,
        trust: demoVerificationTrust(),
        onCheck: (check) => seen.push(check),
      });
      expect(report.checks.every((check) => check.source === 'computed'), pkg.evidenceId).toBe(true);
      expect(report.failed).toEqual(pkg.tampered ? [`track:${DEFAULT_TAMPER_TRACK}`] : []);
      expect(report.checks.map((check) => [check.id, check.ok])).toEqual(pkg.verification.checks.map((check) => [check.id, check.ok]));
      expect(seen).toHaveLength(report.checks.length);
      const altered = report.checks.find((check) => !check.ok);
      if (pkg.tampered) expect(altered?.actual).toBe(pkg.tracks.find((track) => track.altered)?.stored.sha256);
    }
  });

  it('without WebCrypto the helper still recomputes hashes and marks the Ed25519 checks as precomputed', async () => {
    const load = async (assetPath: string): Promise<Uint8Array> => new Uint8Array(read(assetPath));
    const pkg = getDemoEvidencePackage(INDEX.exportedEvidenceSuffixes[0] ?? '') as DemoEvidencePackage;
    const report = await verifyDemoPackage(pkg, load, { subtle: null, trust: demoVerificationTrust() });
    const sources = Object.fromEntries(report.checks.map((check) => [check.id, check.source]));
    expect(sources).toMatchObject({
      'track:VIDEO-01': 'computed',
      manifest: 'computed',
      signature: 'precomputed',
      certificate: 'precomputed',
      auditChain: 'computed',
      exportPackage: 'computed',
      exportSignature: 'precomputed',
    });
    expect(report.result).toBe('PASS');
    expect(report.label).toMatch(/precomputed/);
  });

  it('detects an altered manifest (manifest and signature fail) and a tampered audit row', async () => {
    const pkg = getDemoEvidencePackage('0001') as DemoEvidencePackage;
    const manifestPath = pkg.files.manifest.path;
    const auditPath = pkg.files.auditExtract.path;
    const load = async (assetPath: string): Promise<Uint8Array> => {
      if (assetPath === manifestPath) return new Uint8Array(Buffer.from(read(assetPath).toString('utf8').replace('"SEALED"', '"TAMPERED"')));
      if (assetPath === auditPath) return new Uint8Array(Buffer.from(read(assetPath).toString('utf8').replace('Pre-recording checks passed', 'Pre-recording checks skipped')));
      return new Uint8Array(read(assetPath));
    };
    const report = await verifyDemoPackage(pkg, load, { subtle: webcrypto.subtle, trust: demoVerificationTrust() });
    expect(report.failed).toEqual(['manifest', 'signature', 'auditChain']);
  });
});

describe('demo evidence packages: export (§19.2)', () => {
  it('exports only the exported items, with the 8 §19.2 items and a zip whose SHA-256 matches its export manifest', () => {
    const exported = PACKAGES.filter((pkg) => pkg.export !== null);
    expect(exported.map((pkg) => pkg.evidenceSuffix)).toEqual(INDEX.exportedEvidenceSuffixes);
    expect(exported.every((pkg) => pkg.status === 'EXPORTED')).toBe(true);
    expect(PACKAGES.filter((pkg) => pkg.status === 'EXPORTED')).toHaveLength(exported.length);
    expect(exported.length).toBeGreaterThan(0);
    expect(EXPORT_MANIFEST_ITEMS).toHaveLength(8);
    for (const pkg of exported) {
      const entry = pkg.export;
      if (!entry) continue;
      const exportManifest = json<Record<string, unknown> & { package: { sha256: string; bytes: number; entries: number } }>(entry.manifest.path);
      for (const item of EXPORT_MANIFEST_ITEMS) expect(exportManifest[item.key], `§19.2 item ${item.n} ${item.key}`).toBeDefined();
      const zip = read(entry.zip.path);
      expect(sha256Hex(zip)).toBe(exportManifest.package.sha256);
      expect(zip.length).toBe(exportManifest.package.bytes);
      expect(entry.exportId).toMatch(/^EXP-\d{6}$/);
      expect(entry.reason.length).toBeGreaterThanOrEqual(5);

      const entries = readZip(zip);
      expect(entries).toHaveLength(entry.entries);
      expect(entries.map((item) => item.name)).toEqual(entries.map((item) => item.name).sort());
      expect(entries.every((item) => item.extraLength === 0)).toBe(true);
      const record = JSON.parse(entries.find((item) => item.name.endsWith('/export-record.json'))?.data.toString('utf8') ?? '{}') as {
        entries: { path: string; sha256: string; bytes: number }[];
      };
      expect(record.entries.length).toBe(entries.length - 1);
      for (const listed of record.entries) {
        const found = entries.find((item) => item.name === listed.path);
        expect(found, listed.path).toBeDefined();
        expect(sha256Hex(found?.data ?? Buffer.alloc(0)), listed.path).toBe(listed.sha256);
      }
      const inner = (name: string): Buffer => entries.find((item) => item.name.endsWith(name))?.data ?? Buffer.alloc(0);
      expect(inner('/evidence/manifest.json').equals(read(pkg.files.manifest.path))).toBe(true);
      for (const track of pkg.tracks) expect(sha256Hex(inner(`/payload/${track.file}`))).toBe(track.sealedSha256);
      expect(verify(null, sha256(inner('/evidence/manifest.json')), certificate.publicKey, Buffer.from(pkg.signature.signatureHex, 'hex'))).toBe(true);
    }
  });
});

describe('demo API example payloads (for step 53)', () => {
  it('validate against the Core API schemas', () => {
    const { sessionCreate, evidenceExport } = INDEX.apiExamples;
    expect(sessionCreateSchema.safeParse(sessionCreate.request).success).toBe(true);
    expect(EvidenceExportRequestSchema.safeParse(evidenceExport.request).success).toBe(true);
    expect(EvidenceExportAcceptedSchema.safeParse(evidenceExport.response).success).toBe(true);
    expect(getDemoEvidencePackage(evidenceExport.evidenceId)?.export?.exportId).toBe(evidenceExport.response.exportId);
  });
});

// Finding R96-1 (task 3 rows 96 and 97): the two asset READMEs are generator outputs, and the notes
// on version-2 packages were appended to them by hand. The notes are now the generators' own text
// (`scripts/demo-readme-notes.ts`), so a regeneration keeps them. The generators need FFmpeg and
// write the assets, so they are not run here: each committed README is held to the note, and each
// generator's source to the line that appends it after its last own line.
describe('the asset READMEs end with the notes their generators append (R96-1)', () => {
  it.each([
    ['demo-evidence', 'gen-demo-evidence.ts', 'DEMO_EVIDENCE_README_NOTE', DEMO_EVIDENCE_README_NOTE, '- The output is deterministic: the same `--as-of` gives the same bytes.\n'],
    ['demo-media', 'gen-demo-media.ts', 'DEMO_MEDIA_README_NOTE', DEMO_MEDIA_README_NOTE, ' MiB.\n'],
  ] as const)('%s: README = the generator\'s text up to its last line + the note; %s appends the note there', (folder, generator, name, note, lastOwnLine) => {
    const readme = readFileSync(join(ASSETS, folder, 'README.md'), 'utf8');
    expect(note.startsWith('\n## Note on ')).toBe(true);
    expect(note).not.toMatch(/by hand|NOT written/);
    expect(readme.endsWith(note)).toBe(true);
    expect(readme.slice(0, -note.length).endsWith(lastOwnLine)).toBe(true);
    // One heading of the note in the file: it is not there twice (once typed, once appended).
    expect(readme.split('\n## Note on ')).toHaveLength(2);
    const source = readFileSync(join(PKG_DIR, 'scripts', generator), 'utf8');
    expect(source).toContain(`import { ${name} } from './demo-readme-notes';`);
    const appended = source.split('${' + name + '}`;\n}');
    expect(appended).toHaveLength(2);
    // What stands before the appended note in `readmeText` is the README's last own line.
    expect((appended[0] ?? '').replaceAll('\\`', '`').endsWith(lastOwnLine.startsWith(' MiB') ? '.toFixed(2)} MiB.\n' : lastOwnLine)).toBe(true);
  });
});
