// Row 82, ruling D138: ONE location of the evidence signing key, and the development key command.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadSoftwareSigner, verifyEd25519 } from '../../capture';
import { runDevKeyCommand } from '../dev-key-cli';
import { DEVELOPMENT_KEY_UNIT, SEALING_SIGNER_SUBPATH, isDevelopmentSigningCertificate, loadSealingSigner, sealingSignerDir } from '../signing';
import { throwAwaySigner } from './package-support';

const NOW = 1_791_529_000_000;
const made: string[] = [];
const dataDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dems-row82-key-'));
  made.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

describe('one key location (D138)', () => {
  it('the pipeline reads the directory the capture boot check reads: the two names are equal', () => {
    // The boot check's constant is read from ITS source (the capture unit does not export it):
    // this fails when either side is moved.
    const source = readFileSync(join(__dirname, '..', '..', 'capture', 'boot', 'checks.ts'), 'utf8');
    const declared = /export const SIGNING_STORE_SUBPATH = '([^']+)';/.exec(source);
    expect(declared?.[1]).toBe(SEALING_SIGNER_SUBPATH);
    const wiring = readFileSync(join(__dirname, '..', '..', 'capture', 'boot', 'index.ts'), 'utf8');
    expect(wiring).toContain('`${dataDir}/${SIGNING_STORE_SUBPATH}`');
    expect(sealingSignerDir('/x/data')).toBe('/x/data/signer');
  });

  it('the key the boot check would load is the key the pipeline signs with; without a key the pipeline has no signer (KEY_ABSENT)', () => {
    const dir = dataDir();
    expect(() => loadSealingSigner({ dataDir: dir, now: NOW })).toThrow(/KEY_ABSENT/);
    expect(runDevKeyCommand(['--data-dir', dir], NOW).code).toBe(0);
    const sealing = loadSealingSigner({ dataDir: dir, now: NOW + 1_000 });
    const boot = loadSoftwareSigner({ dir: join(dir, 'signer'), now: NOW + 1_000 });
    expect(sealing.certificate.sha256).toBe(boot.certificate.sha256);
    const message = new Uint8Array(32).fill(7);
    expect(verifyEd25519(boot.signer.publicKey(), message, sealing.signer.sign(message) as Uint8Array)).toBe(true);
  });
});

describe('evidence:dev-key', () => {
  it('provisions a key that says DEVELOPMENT in its certificate subject, owner-only, and prints no key material', () => {
    const dir = dataDir();
    const run = runDevKeyCommand(['--data-dir', dir], NOW);
    expect(run.code).toBe(0);
    const loaded = loadSealingSigner({ dataDir: dir, now: NOW + 1 });
    expect(loaded.certificate.subject).toContain(`OU=${DEVELOPMENT_KEY_UNIT}`);
    expect(isDevelopmentSigningCertificate(loaded.certificate)).toBe(true);
    // CONTROL: a key provisioned without the mark does not read as a development key.
    expect(isDevelopmentSigningCertificate(throwAwaySigner().certificate)).toBe(false);
    const store = sealingSignerDir(dir);
    expect(statSync(store).mode & 0o777).toBe(0o700);
    const printed = run.lines.join('\n');
    for (const name of readdirSync(store)) {
      const mode = statSync(join(store, name)).mode & 0o777;
      if (name.endsWith('.pem') || name.endsWith('.crt')) continue;
      // Every file but the public certificate is owner-only, and none of its bytes is printed.
      expect(mode & 0o077, name).toBe(0);
      const bytes = readFileSync(join(store, name));
      expect(printed.includes(bytes.toString('base64')) || printed.includes(bytes.toString('hex')), name).toBe(false);
    }
    expect(printed).toContain('DEVELOPMENT');
    expect(printed).not.toMatch(/PRIVATE KEY/);
  });

  it('never replaces a key: a second run fails KEY_EXISTS and the certificate is the first one', () => {
    const dir = dataDir();
    runDevKeyCommand(['--data-dir', dir], NOW);
    const first = loadSealingSigner({ dataDir: dir, now: NOW + 1 }).certificate.sha256;
    const second = runDevKeyCommand(['--data-dir', dir], NOW + 5_000);
    expect(second.code).toBe(1);
    expect(second.lines.join(' ')).toContain('KEY_EXISTS');
    expect(loadSealingSigner({ dataDir: dir, now: NOW + 6_000 }).certificate.sha256).toBe(first);
  });

  it('refuses an argument it does not know', () => {
    expect(runDevKeyCommand(['--force'], NOW).code).toBe(1);
  });
});
