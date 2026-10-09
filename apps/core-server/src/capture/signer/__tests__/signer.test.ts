// The evidence signer (blueprint row 83; evidence package spec §B.10, §C; SEC35-06, SEC35-07;
// database contract §C.4, §C.5). Real Ed25519 keys and signatures, made in a throw-away directory.
import { X509Certificate, createPrivateKey, createPublicKey, generateKeyPairSync, sign as nodeSign, verify as nodeVerify, webcrypto } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { SecuritySliceSchema } from '@dems/shared/api';
import {
  EXAMPLE_SOURCE_ROWS,
  ManifestV2Schema,
  buildUnsignedManifest,
  computeManifestSha256,
  exampleManifestInput,
  manifestSignedMessage,
  parseDetachedSignature,
  serializeDetachedSignature,
  serializeManifest,
  type ManifestV2,
  type UnsignedManifestV2,
} from '@dems/shared/evidence-package';
import {
  CORE_EVIDENCE_SIGNING_KEY_ID,
  SignerError,
  buildSelfSignedCertificate,
  certificatePem,
  deviceCertificateBlock,
  fileWrapSecrets,
  loadSoftwareSigner,
  markSigningKeyCompromised,
  provisionSigningKey,
  readSigningCertificate,
  readStoredCertificate,
  signManifest,
  signatureBlock,
  signingKeyRecords,
  utcFields,
  verifyEd25519,
  verifyManifestSeal,
  type KeyWrapSecrets,
  type LoadedSigner,
  type Signer,
} from '..';

const NOW = 1_791_500_000_000;
const roots: string[] = [];
function store(): string {
  const root = mkdtempSync(join(tmpdir(), 'dems-signer-'));
  roots.push(root);
  return join(root, 'signer');
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const mode = (file: string): number => statSync(file).mode & 0o777;
const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof SignerError ? error.code : `not a SignerError: ${String(error)}`;
  }
  return 'no error';
};

function provisioned(dir: string = store()): { dir: string; loaded: LoadedSigner } {
  provisionSigningKey({ dir, now: NOW });
  return { dir, loaded: loadSoftwareSigner({ dir, now: NOW + 1_000 }) };
}

function unsignedFor(loaded: LoadedSigner): UnsignedManifestV2 {
  const input = exampleManifestInput();
  input.signature = signatureBlock(loaded.signer, loaded.certificate, NOW + 8_500);
  input.device.certificate = deviceCertificateBlock(loaded.certificate);
  return buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS);
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Every scalar (or null, or empty array) of a JSON value with a setter for it. */
function leaves(root: Json): { where: string; get: () => Json; set: (value: Json) => void }[] {
  const out: { where: string; get: () => Json; set: (value: Json) => void }[] = [];
  const walk = (holder: Json[] | { [key: string]: Json }, key: string | number, where: string): void => {
    const value = (holder as Record<string | number, Json>)[key] as Json;
    if (value !== null && typeof value === 'object' && (!Array.isArray(value) || value.length > 0)) {
      if (Array.isArray(value)) value.forEach((_entry, index) => walk(value, index, `${where}[${index}]`));
      else for (const member of Object.keys(value)) walk(value, member, `${where}.${member}`);
      return;
    }
    out.push({ where, get: () => (holder as Record<string | number, Json>)[key] as Json, set: (next) => void ((holder as Record<string | number, Json>)[key] = next) });
  };
  for (const key of Object.keys(root as object)) walk(root as { [key: string]: Json }, key, key);
  return out;
}

/** The smallest change of a value: one character of a string, one unit of a number, the other boolean. */
function oneStep(value: Json): Json {
  if (value === null) return 0;
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'string') return `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
  return ['X'];
}

describe('the key at rest (spec §C.3; SEC35-07)', () => {
  it('provisioning writes a private directory, an encrypted private key, its secret and a public certificate', () => {
    const dir = store();
    const certificate = provisionSigningKey({ dir, now: NOW });
    expect(readdirSync(dir).sort()).toEqual(['CORE-KEY-EVSIGN-01.crt', 'CORE-KEY-EVSIGN-01.p8', 'CORE-KEY-EVSIGN-01.wrap']);
    expect(mode(dir)).toBe(0o700);
    expect(mode(join(dir, 'CORE-KEY-EVSIGN-01.p8'))).toBe(0o600);
    expect(mode(join(dir, 'CORE-KEY-EVSIGN-01.wrap'))).toBe(0o600);
    expect(certificate.keyId).toBe(CORE_EVIDENCE_SIGNING_KEY_ID);

    // Encrypted at rest: the file is no plain PKCS#8 key, and opens only with the secret.
    const stored = readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.p8'));
    expect(() => createPrivateKey({ key: stored, format: 'der', type: 'pkcs8' })).toThrow();
    expect(() => createPrivateKey({ key: stored, format: 'der', type: 'pkcs8', passphrase: Buffer.alloc(32) })).toThrow();
    const opened = createPrivateKey({ key: stored, format: 'der', type: 'pkcs8', passphrase: readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.wrap')) });
    expect(opened.asymmetricKeyType).toBe('ed25519');
    // A plain Ed25519 PKCS#8 file is 48 bytes; the wrapped one is larger and has another header.
    expect(stored.length).toBeGreaterThan(48);
    expect(stored.subarray(0, 16).toString('hex')).not.toBe('302e020100300506032b657004220420');
  });

  it('never replaces a key', () => {
    const dir = store();
    provisionSigningKey({ dir, now: NOW });
    const before = readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.p8')).toString('hex');
    expect(codeOf(() => provisionSigningKey({ dir, now: NOW + 5 }))).toBe('KEY_EXISTS');
    expect(readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.p8')).toString('hex')).toBe(before);
    // A second key id (rotation) lives beside the first.
    provisionSigningKey({ dir, now: NOW, keyId: 'CORE-KEY-EVSIGN-02' });
    expect(loadSoftwareSigner({ dir, keyId: 'CORE-KEY-EVSIGN-02' }).signer.keyId).toBe('CORE-KEY-EVSIGN-02');
    expect(loadSoftwareSigner({ dir }).signer.keyId).toBe('CORE-KEY-EVSIGN-01');
  });

  it('loading fails closed and creates nothing', () => {
    const empty = store();
    expect(codeOf(() => loadSoftwareSigner({ dir: empty }))).toBe('KEY_ABSENT');
    expect(() => readdirSync(empty)).toThrow();

    const reachable = provisioned().dir;
    chmodSync(join(reachable, 'CORE-KEY-EVSIGN-01.p8'), 0o640);
    expect(codeOf(() => loadSoftwareSigner({ dir: reachable }))).toBe('KEY_MODE');
    chmodSync(join(reachable, 'CORE-KEY-EVSIGN-01.p8'), 0o600);
    chmodSync(join(reachable, 'CORE-KEY-EVSIGN-01.wrap'), 0o604);
    expect(codeOf(() => loadSoftwareSigner({ dir: reachable }))).toBe('KEY_MODE');
    chmodSync(join(reachable, 'CORE-KEY-EVSIGN-01.wrap'), 0o600);
    expect(codeOf(() => loadSoftwareSigner({ dir: reachable }))).toBe('no error');

    const noSecret = provisioned().dir;
    rmSync(join(noSecret, 'CORE-KEY-EVSIGN-01.wrap'));
    expect(codeOf(() => loadSoftwareSigner({ dir: noSecret }))).toBe('KEY_ABSENT');

    const wrongSecret = provisioned().dir;
    const other: KeyWrapSecrets = { get: () => new Uint8Array(32).fill(7), put: () => undefined };
    expect(codeOf(() => loadSoftwareSigner({ dir: wrongSecret, wrapSecrets: other }))).toBe('KEY_UNREADABLE');

    const damaged = provisioned().dir;
    writeFileSync(join(damaged, 'CORE-KEY-EVSIGN-01.p8'), Buffer.from('not a key'), { mode: 0o600 });
    expect(codeOf(() => loadSoftwareSigner({ dir: damaged }))).toBe('KEY_UNREADABLE');

    const noCertificate = provisioned().dir;
    rmSync(join(noCertificate, 'CORE-KEY-EVSIGN-01.crt'));
    expect(codeOf(() => loadSoftwareSigner({ dir: noCertificate }))).toBe('CERTIFICATE_INVALID');

    // The certificate of ANOTHER key beside this key.
    const swapped = provisioned().dir;
    const stranger = provisioned().dir;
    writeFileSync(join(swapped, 'CORE-KEY-EVSIGN-01.crt'), readFileSync(join(stranger, 'CORE-KEY-EVSIGN-01.crt')));
    expect(codeOf(() => loadSoftwareSigner({ dir: swapped }))).toBe('CERTIFICATE_INVALID');

    const dated = provisioned().dir;
    expect(codeOf(() => loadSoftwareSigner({ dir: dated, now: NOW - 1_000 }))).toBe('CERTIFICATE_NOT_VALID_NOW');
    expect(codeOf(() => loadSoftwareSigner({ dir: dated, now: NOW + 1_826 * 86_400_000 }))).toBe('CERTIFICATE_NOT_VALID_NOW');
    expect(codeOf(() => loadSoftwareSigner({ dir: dated, keyId: '../x' }))).toBe('KEY_ID_INVALID');
  });

  it('the wrap secret can live elsewhere: with another source no secret file is written', () => {
    const dir = store();
    const held = new Map<string, Uint8Array>();
    const elsewhere: KeyWrapSecrets = {
      get: (keyId) => held.get(keyId) ?? null,
      put: (keyId, secret) => {
        if (held.has(keyId)) throw new Error('exists');
        held.set(keyId, Uint8Array.from(secret));
      },
    };
    provisionSigningKey({ dir, now: NOW, wrapSecrets: elsewhere });
    expect(readdirSync(dir).sort()).toEqual(['CORE-KEY-EVSIGN-01.crt', 'CORE-KEY-EVSIGN-01.p8']);
    expect(held.get('CORE-KEY-EVSIGN-01')).toHaveLength(32);
    expect(loadSoftwareSigner({ dir, wrapSecrets: elsewhere }).signer.keyId).toBe('CORE-KEY-EVSIGN-01');
    expect(codeOf(() => loadSoftwareSigner({ dir }))).toBe('KEY_ABSENT');
    expect(fileWrapSecrets(dir).get('CORE-KEY-EVSIGN-01')).toBeNull();
  });

  it('a compromised key signs nothing; its certificate stays readable for re-verification (runbook b, d)', () => {
    const { dir, loaded } = provisioned();
    markSigningKeyCompromised({ dir, at: NOW + 60_000 });
    markSigningKeyCompromised({ dir, at: NOW + 90_000 });
    expect(codeOf(() => loadSoftwareSigner({ dir }))).toBe('KEY_COMPROMISED');
    expect(readStoredCertificate({ dir }).sha256).toBe(loaded.certificate.sha256);
    expect(JSON.parse(readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.compromised'), 'utf8'))).toEqual({ keyId: 'CORE-KEY-EVSIGN-01', compromisedAt: NOW + 60_000 });
    expect(codeOf(() => provisionSigningKey({ dir, now: NOW }))).toBe('KEY_EXISTS');
  });

  it('nothing of the key can be printed, serialised or found in an error', () => {
    const { dir, loaded } = provisioned();
    const secret = readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.wrap'));
    const privateRaw = createPrivateKey({ key: readFileSync(join(dir, 'CORE-KEY-EVSIGN-01.p8')), format: 'der', type: 'pkcs8', passphrase: secret })
      .export({ format: 'der', type: 'pkcs8' })
      .subarray(16);
    expect(privateRaw).toHaveLength(32);
    const shown = [inspect(loaded, { depth: 8, showHidden: true }), JSON.stringify(loaded), String(loaded.signer), inspect(loaded.signer.sign)].join('\n');
    for (const needle of [secret.toString('hex'), secret.toString('base64'), privateRaw.toString('hex'), privateRaw.toString('base64'), 'PrivateKeyObject']) {
      expect(shown).not.toContain(needle);
    }
    expect(Object.keys(loaded.signer).sort()).toEqual(['algorithm', 'keyId', 'publicKey', 'sign']);

    chmodSync(join(dir, 'CORE-KEY-EVSIGN-01.p8'), 0o644);
    const errors: unknown[] = [];
    for (const run of [() => loadSoftwareSigner({ dir }), () => loadSoftwareSigner({ dir: join(dir, 'absent') }), () => provisionSigningKey({ dir, now: NOW })]) {
      try {
        run();
      } catch (error) {
        errors.push(error);
      }
    }
    expect(errors).toHaveLength(3);
    for (const error of errors) {
      expect(error).toBeInstanceOf(SignerError);
      const text = `${(error as Error).message}\n${inspect(error, { depth: 6 })}\n${JSON.stringify(error)}`;
      expect(text).not.toContain(tmpdir());
      expect(text).not.toContain(secret.toString('hex'));
      expect((error as Error).cause).toBeUndefined();
    }
  });
});

describe('the certificate (spec §A.1, §C.1; verify V-13)', () => {
  it('is a self-signed X.509 certificate of the key, valid from the provisioning instant', () => {
    const { loaded } = provisioned();
    const { certificate, signer } = loaded;
    const parsed = new X509Certificate(certificate.pemText);
    expect(parsed.verify(parsed.publicKey)).toBe(true);
    expect(parsed.ca).toBe(false);
    expect(certificate.subject).toBe('CN=CORE-KEY-EVSIGN-01,OU=Evidence signing,O=DEMS Core');
    expect(certificate.serialNumber).toMatch(/^[0-9A-F]{32}$/);
    expect(certificate.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(certificate.notBefore).toBe(NOW);
    expect(certificate.notAfter).toBe(NOW + 1_825 * 86_400_000);
    expect([...certificate.publicKey]).toEqual([...signer.publicKey()]);
    expect(certificate.pemText).not.toMatch(/PRIVATE/);
    expect(deviceCertificateBlock(certificate)).toEqual({ subject: certificate.subject, serialNumber: certificate.serialNumber, sha256: certificate.sha256 });
  });

  it('a certificate whose bytes were changed, or that another key signed, is refused', () => {
    const { loaded } = provisioned();
    const lines = loaded.certificate.pemText.split('\n');
    const body = Buffer.from(lines.slice(1, -2).join(''), 'base64');
    body[body.length - 1] = (body[body.length - 1] ?? 0) ^ 1;
    expect(codeOf(() => readSigningCertificate(certificatePem(body), 'X'))).toBe('CERTIFICATE_INVALID');
    expect(codeOf(() => readSigningCertificate('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n', 'X'))).toBe('CERTIFICATE_INVALID');
    expect(codeOf(() => readSigningCertificate('nothing', 'X'))).toBe('CERTIFICATE_INVALID');

    // The public key of one pair under the signature of another.
    const subjectKey = generateKeyPairSync('ed25519');
    const issuerKey = generateKeyPairSync('ed25519');
    const raw = subjectKey.publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
    const forged = buildSelfSignedCertificate(
      { subject: { organization: 'O', organizationalUnit: 'U', commonName: 'C' }, serial: new Uint8Array(16).fill(1), notBefore: NOW, notAfter: NOW + 1_000, publicKey: raw, keyIdentifier: new Uint8Array(20) },
      (tbs) => nodeSign(null, tbs, issuerKey.privateKey),
    );
    expect(codeOf(() => readSigningCertificate(certificatePem(forged), 'X'))).toBe('CERTIFICATE_INVALID');
  });

  it('calendar fields are computed without the system clock and agree with it', () => {
    for (const instant of [0, 951_782_400_000, 1_709_164_800_000, NOW, 2_524_607_999_000, 2_524_608_000_000, 4_102_444_800_000]) {
      const date = new Date(instant);
      expect(utcFields(instant), String(instant)).toEqual({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      });
    }
    // A validity that ends after 2049 (GeneralizedTime) still parses to the instant asked for.
    const dir = store();
    const far = provisionSigningKey({ dir, now: 2_500_000_000_000, validityDays: 3_650 });
    expect(far.notAfter).toBe(2_500_000_000_000 + 3_650 * 86_400_000);
  });
});

describe('real signatures over manifestSha256 (spec §B.10, §C.1, §C.2; database contract §C.4, §C.5)', () => {
  const { loaded } = provisioned();
  const unsigned = unsignedFor(loaded);

  it('seals a manifest with a real, non-simulated Ed25519 signature that verifies with the certificate alone', async () => {
    const { manifest, detached } = await signManifest(loaded.signer, unsigned, verifyEd25519);
    expect(ManifestV2Schema.safeParse(manifest).success).toBe(true);
    expect(manifest.signature).toMatchObject({ algorithm: 'Ed25519', keyId: 'CORE-KEY-EVSIGN-01', simulated: false });
    // Database contract §C.5: 64 bytes as lowercase hex.
    expect(manifest.signature.value).toMatch(/^([0-9a-f]{2}){64}$/);
    expect(manifest.manifestSha256).toBe(unsigned.manifestSha256);
    expect(manifest.developmentSources).toBe(true);
    expect(manifest.tracks.map((track) => track.sourceClass)).toEqual(['FAKE', 'FAKE']);

    // A receiver: the certificate file and the manifest bytes, nothing of the Core.
    const received = JSON.parse(new TextDecoder().decode(serializeManifest(manifest))) as ManifestV2;
    const certificate = readSigningCertificate(loaded.certificate.pemText, received.signature.keyId);
    expect(certificate.sha256).toBe(received.signature.certificate.sha256);
    expect(verifyManifestSeal(received, certificate.publicKey, verifyEd25519)).toEqual({ hashOk: true, signatureOk: true });

    // Independently of this unit's own verify function: Node directly, and WebCrypto (the v1 clients' path).
    const digest = manifestSignedMessage(computeManifestSha256(received));
    const signature = Buffer.from(received.signature.value, 'hex');
    const publicKey = new X509Certificate(loaded.certificate.pemText).publicKey;
    expect(nodeVerify(null, digest, publicKey, signature)).toBe(true);
    const webKey = await webcrypto.subtle.importKey('raw', new Uint8Array(certificate.publicKey), { name: 'Ed25519' }, false, ['verify']);
    expect(await webcrypto.subtle.verify({ name: 'Ed25519' }, webKey, signature, new Uint8Array(digest))).toBe(true);
    // It is not the stand-in of the simulator (a hash of the manifest hash and the key id).
    expect(nodeVerify(null, Buffer.from('another message'), publicKey, signature)).toBe(false);

    // signature.sig says the same three things.
    const sig = parseDetachedSignature(new TextDecoder().decode(serializeDetachedSignature(detached)));
    expect(sig).toMatchObject({ signedDigest: manifest.manifestSha256, signature: manifest.signature.value, certificateSha256: certificate.sha256, keyId: 'CORE-KEY-EVSIGN-01' });
  });

  it('signing the same digest again gives the same bytes (resume rule of SIGN_MANIFEST)', async () => {
    const first = await signManifest(loaded.signer, unsigned, verifyEd25519);
    const again = await signManifest(loadSoftwareSigner({ dir: provisionedDirOf(loaded) }).signer, unsigned, verifyEd25519);
    expect(again.manifest.signature.value).toBe(first.manifest.signature.value);
    expect(new TextDecoder().decode(serializeManifest(again.manifest))).toBe(new TextDecoder().decode(serializeManifest(first.manifest)));
  });

  it('a one-step change of ANY member but the two excluded ones breaks the hash; hiding it breaks the signature', async () => {
    const { manifest } = await signManifest(loaded.signer, unsigned, verifyEd25519);
    const publicKey = loaded.certificate.publicKey;
    const all = leaves(clone(manifest) as unknown as Json).map((leaf) => leaf.where);
    expect(all.length).toBeGreaterThan(190);
    expect(all).toContain('tracks[0].sourceClass');
    expect(all).toContain('audio.sourceIntervals[1].sourceClass');
    expect(all).toContain('developmentSources');
    expect(all).toContain('tracks[1].firstVideoSamplePts');
    const passing: string[] = [];
    const hidden: string[] = [];
    for (const where of all) {
      const tampered = clone(manifest) as unknown as Json;
      const leaf = leaves(tampered).find((candidate) => candidate.where === where);
      if (leaf === undefined) throw new Error(where);
      leaf.set(oneStep(leaf.get()));
      const result = verifyManifestSeal(tampered, publicKey, verifyEd25519);
      if (result.hashOk && result.signatureOk) passing.push(where);
      if (where === 'manifestSha256' || where === 'signature.value') continue;
      expect(result, where).toEqual({ hashOk: false, signatureOk: true });
      // The attacker recomputes the hash: now the signature is over another digest.
      (tampered as { manifestSha256: string }).manifestSha256 = computeManifestSha256(tampered);
      const recomputed = verifyManifestSeal(tampered, publicKey, verifyEd25519);
      expect(recomputed, where).toEqual({ hashOk: true, signatureOk: false });
      hidden.push(where);
    }
    // No change of any member passes both checks.
    expect(passing).toEqual([]);
    expect(hidden).toHaveLength(all.length - 2);

    // The two excluded members: outside the digest, and still not free to change.
    const otherValue = clone(manifest);
    otherValue.signature.value = `${manifest.signature.value.slice(0, -1)}${manifest.signature.value.endsWith('0') ? '1' : '0'}`;
    expect(verifyManifestSeal(otherValue, publicKey, verifyEd25519)).toEqual({ hashOk: true, signatureOk: false });
    const otherHash = clone(manifest);
    otherHash.manifestSha256 = 'f'.repeat(64);
    expect(verifyManifestSeal(otherHash, publicKey, verifyEd25519)).toEqual({ hashOk: false, signatureOk: false });
  });

  it('removing a source class, or adding a member, breaks the hash', async () => {
    const { manifest } = await signManifest(loaded.signer, unsigned, verifyEd25519);
    const removed = clone(manifest) as unknown as { tracks: Record<string, unknown>[] };
    delete (removed.tracks[0] as Record<string, unknown>).sourceClass;
    expect(verifyManifestSeal(removed, loaded.certificate.publicKey, verifyEd25519).hashOk).toBe(false);
    const { developmentSources: _flag, ...noFlag } = manifest;
    expect(verifyManifestSeal(noFlag, loaded.certificate.publicKey, verifyEd25519).hashOk).toBe(false);
    expect(verifyManifestSeal({ ...manifest, added: 1 }, loaded.certificate.publicKey, verifyEd25519).hashOk).toBe(false);
  });

  it('another key does not verify, and a signer that does not match or does not work seals nothing', async () => {
    const { manifest } = await signManifest(loaded.signer, unsigned, verifyEd25519);
    const stranger = provisioned().loaded;
    expect(verifyManifestSeal(manifest, stranger.certificate.publicKey, verifyEd25519)).toEqual({ hashOk: true, signatureOk: false });
    await expect(signManifest(stranger.signer, { ...unsigned, signature: { ...unsigned.signature, keyId: 'CORE-KEY-EVSIGN-02' } }, verifyEd25519)).rejects.toMatchObject({ code: 'SIGNER_MISMATCH' });
    const broken: Signer = { algorithm: 'Ed25519', keyId: loaded.signer.keyId, sign: () => new Uint8Array(64), publicKey: () => loaded.signer.publicKey() };
    await expect(signManifest(broken, unsigned, verifyEd25519)).rejects.toMatchObject({ code: 'SIGNATURE_FAILED' });
    const throwing: Signer = { ...broken, sign: () => { throw new Error('device gone'); } };
    await expect(signManifest(throwing, unsigned, verifyEd25519)).rejects.toMatchObject({ code: 'SIGNATURE_FAILED' });
    // The stranger's signature under this key's name: refused by the self-check.
    const impostor: Signer = { ...broken, sign: (message) => stranger.signer.sign(message) };
    await expect(signManifest(impostor, unsigned, verifyEd25519)).rejects.toMatchObject({ code: 'SIGNATURE_FAILED' });
    expect(() => signatureBlock(loaded.signer, { ...stranger.certificate, keyId: 'OTHER-KEY' }, NOW)).toThrow(SignerError);
  });

  it('the interface is enough: a second implementation signs through it (the TPM seam, class C-8)', async () => {
    // Not a TPM: another software key behind the same four members, to show nothing else is used.
    const pair = generateKeyPairSync('ed25519');
    const raw = new Uint8Array(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(12));
    const other: Signer = { algorithm: 'Ed25519', keyId: 'TEST-KEY-01', sign: async (message) => new Uint8Array(nodeSign(null, message, pair.privateKey)), publicKey: () => raw };
    const input = exampleManifestInput();
    input.signature = { ...input.signature, keyId: 'TEST-KEY-01' };
    const sealed = await signManifest(other, buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS), verifyEd25519);
    expect(verifyManifestSeal(sealed.manifest, raw, verifyEd25519)).toEqual({ hashOk: true, signatureOk: true });
    expect(createPublicKey(pair.privateKey).equals(pair.publicKey)).toBe(true);
  });
});

describe('CS-13: the real key record', () => {
  it('fits the security slice, is not simulated and not demo, and shows public fingerprints only', () => {
    const { loaded } = provisioned();
    const records = signingKeyRecords(loaded.certificate);
    const element = SecuritySliceSchema.shape.keys.element;
    for (const record of records) expect(element.safeParse(record).success).toBe(true);
    expect(records.map((record) => [record.id, record.simulated, 'demo' in record])).toEqual([
      ['DEVICE_CERT', false, false],
      ['EVIDENCE_SIGNING_KEY', false, false],
    ]);
    expect(records[1].keyId).toBe('CORE-KEY-EVSIGN-01');
    expect(records[1].label).toBe('Evidence signing key (CORE-KEY-EVSIGN-01)');
    expect(records[0].fingerprint.replace(/:/g, '').toLowerCase()).toBe(loaded.certificate.sha256);
    expect(records[1].fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(records[1].fingerprint).not.toBe(records[0].fingerprint);
    expect(records[1].expiresAt).toBe(loaded.certificate.notAfter);
  });
});

/** The directory a loaded signer of this file came from (the last store that was provisioned for it). */
function provisionedDirOf(loaded: LoadedSigner): string {
  for (const root of roots) {
    const dir = join(root, 'signer');
    try {
      if (readStoredCertificate({ dir }).sha256 === loaded.certificate.sha256) return dir;
    } catch {
      // not that one
    }
  }
  throw new Error('store not found');
}
