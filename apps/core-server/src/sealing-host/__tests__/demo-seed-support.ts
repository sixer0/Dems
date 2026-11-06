// Test support of row 82c, item 3: a throw-away Core data directory for the seed-time generator of
// the v2 demo packages. Not a test file.
//
// WHAT IS REAL. The credential store (row 84's file key store, in `<dataDir>/credential-store`), the
// product cipher over a session key made in THAT store, the DEVELOPMENT signing key provisioned as
// `npm run evidence:dev-key` provisions it (`<dataDir>/signer`), the evidence store
// `<dataDir>/media/sessions`, and the verifier of operation 41 with the Core's anchors.
//
// WHAT IS NOT. A database, an app, a seed: the generator needs none, and the seed hook is a closed
// area (request filed). Everything is under a directory of the operating system's temporary
// folder and is removed after the file.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPackageV2, type FragmentOpener, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { createCredentialStore, createFragmentSealer, openFragment, type CoreCredentialStore } from '../../credential-store';
import { corePorts, sessionPackageDir } from '../../evidence-verify';
import type { ErrorLogEntry } from '../../plugins/logger';
import { loadSealingSigner, provisionDevelopmentSigningKey, type SealingPorts, type SessionFragmentSealer } from '../../sealing';
import type { DemoSealItem, DemoSealOptions, DemoSealedPackage } from '../demo-seed';

export const SEED_NOW = 1_791_570_000_000;
const roots: string[] = [];
export function removeDemoCores(): void {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export interface DemoCore {
  readonly dataDir: string;
  readonly mediaStoreDir: string;
  readonly store: CoreCredentialStore;
  readonly sealer: SessionFragmentSealer;
  readonly opener: FragmentOpener;
  readonly signing: SealingPorts['signing'];
  readonly log: { readonly file: null; readonly entries: ErrorLogEntry[]; append(entry: ErrorLogEntry): void };
  /** The options of the generator over this Core, without the synthesiser. */
  options(): Omit<DemoSealOptions, 'synthesise'>;
  packageDir(sessionId: string): string;
  /** Operation 41's verifier over the package as it lies in the store, with the anchors of the returned seal. */
  verify(sealed: DemoSealedPackage, opener?: FragmentOpener): Promise<PackageVerifyResult>;
}

/** The session-key adapter of the composition (`session-key.ts`), over a store that has no app. */
export function sealerOver(store: CoreCredentialStore): SessionFragmentSealer {
  return {
    seal(sessionId, position, plaintext) {
      const keyId = `KID-${sessionId}`;
      const key = store.sessionKeys.has(keyId) ? store.sessionKeys.open(keyId) : store.sessionKeys.create(sessionId);
      try {
        return createFragmentSealer(key).seal(position, plaintext);
      } finally {
        store.sessionKeys.release(key);
      }
    },
  };
}
export function openerOver(store: CoreCredentialStore): FragmentOpener {
  return {
    hasKey: (keyId) => store.sessionKeys.has(keyId),
    open(record, stored) {
      const key = store.sessionKeys.open(record.keyId);
      try {
        return openFragment(key, record, stored);
      } finally {
        store.sessionKeys.release(key);
      }
    },
  };
}

export function demoCore(label = 'core'): DemoCore {
  const root = mkdtempSync(join(tmpdir(), `dems-row82c-${label}-`));
  roots.push(root);
  const dataDir = join(root, 'data');
  const mediaStoreDir = join(dataDir, 'media', 'sessions');
  const store = createCredentialStore({ root: join(dataDir, 'credential-store') });
  provisionDevelopmentSigningKey({ dataDir, now: SEED_NOW });
  const signing = loadSealingSigner({ dataDir, now: SEED_NOW + 1_000 });
  const entries: ErrorLogEntry[] = [];
  const log = { file: null, entries, append: (entry: ErrorLogEntry) => void entries.push(entry) };
  const sealer = sealerOver(store);
  const opener = openerOver(store);
  let tick = 0;
  const core: DemoCore = {
    dataDir,
    mediaStoreDir,
    store,
    sealer,
    opener,
    signing,
    log,
    options: () => ({ dataDir, mediaStoreDir, sealer, opener, signing, log, now: () => SEED_NOW + 2_000 + (tick += 1) }),
    packageDir: (sessionId) => sessionPackageDir(mediaStoreDir, sessionId),
    verify: (sealed, other) =>
      verifyPackageV2(corePorts(sessionPackageDir(mediaStoreDir, sealed.sessionId), other ?? opener), {
        plaintext: 'REQUIRED',
        expected: { evidenceId: sealed.evidenceId, sessionId: sealed.sessionId, manifestSha256: sealed.seal.manifestSha256, transcriptSha256: sealed.seal.transcriptSha256, revisionCount: 0, trustedCertificateSha256: [signing.certificate.sha256] },
      }),
  };
  return core;
}

/** A demo item of evidence sequence `sequence` (5 = the tamper demo's). */
export function demoItem(sequence: number): DemoSealItem {
  const suffix = String(sequence).padStart(4, '0');
  return {
    evidenceId: `EV-20261009-${suffix}`,
    sessionId: `SES-20261009-${suffix}`,
    caseNumber: `LP/2026/1009-${suffix}`,
    createdAt: SEED_NOW - 3_600_000 - sequence * 1_000,
    startedAt: SEED_NOW - 3_500_000 - sequence * 1_000,
    device: { deviceId: 'CORE-DEMO-01', name: 'Demo Core', serialNumber: 'DEMO-SN-0001', hardwareUuid: '00000000-0000-4000-8000-000000000001', softwareVersion: '0.2.0' },
    operator: { investigatorId: 'OP-0001', displayName: 'Demo Investigator', role: 'INVESTIGATOR' },
    subject: { name: `Demo Subject ${suffix}`, type: 'SAKSI', authorization: 'DEMO-AUTH-0001' },
  };
}
