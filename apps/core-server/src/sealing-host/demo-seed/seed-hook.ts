/**
 * THE SEED HOOK OF THE v2 DEMO PACKAGES (integration pass E3 item 6; row 82c's request "seed hook";
 * evidence package spec F.2 - F.4; decisions D155, D167).
 *
 * `sealDemoPackages` (the generator beside this file) seals demo items into a store it is handed.
 * This file puts it to work FOR A SEED: over the data directory of ONE Core, with that Core's
 * development signing key, that Core's credential store (the session keys `KID-<sessionId>` are
 * made there) and the product cipher - and with the two rules a seed needs on top:
 *
 *   STAGED, THEN PLACED. A seed needs the digests before it writes its rows, and a reset removes
 *   the old folders only after the database was replaced. So the packages are sealed into a
 *   staging root INSIDE the store (`<store>/.demo-seed/`, a name no package and no session uses)
 *   and moved to `<store>/SESSION-<sessionId>` by `place()`, one `rename` each, when the caller
 *   says the rows are committed. Until then no reader finds them; `discard()` removes the staging
 *   root. A package is location-free: its manifest names its files relative to its own folder.
 *
 *   NEVER OVER A FOLDER. A target folder that exists is not written into and not removed here.
 *   `seal` answers SKIPPED when one exists that the caller did not name as replaceable (a reset
 *   names the folders its guard cleared); `place` leaves a target that is still there and reports
 *   it by name.
 *
 * SKIPPED IS AN ANSWER, WITH ITS REASON BY NAME (`DemoSeedSkip`): no usable signing key, a key that
 * is not the development one, a store outside the data directory or another store than the caller
 * judged, a folder in the way, a generation that failed (the generator removes what it created).
 * The seed then writes its dataset without the v2 demo items - never a half item.
 *
 * THE SESSION KEY of a demo session is made once and KEPT: a reseed seals the new package of the
 * same session ID under the key the store already holds (the sealer opens a key that exists; a key
 * is never replaced). Nothing here removes a key.
 *
 * THIS FILE STARTS NO PROCESS: `synthesise` is handed in (the seed commands run the private helper
 * program themselves, `db/seed/demo-helper.ts`; a test hands in its own).
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { packageFolderName } from '@dems/shared/evidence-package';
import type { CompleteSealInput } from '@dems/shared/sim';
import { coreFragmentOpener } from '../../evidence-verify';
import type { ErrorLog } from '../../plugins/logger';
import { isDevelopmentSigningCertificate, loadSealingSigner, type SealingPorts } from '../../sealing';
import { coreFragmentSealer, renewSessionKey } from '../session-key';
import { STAND_INS } from '../session-reader';
import { DEMO_CLIP_SECONDS } from './source-arguments';
import { DEMO_SOURCE_ROWS, DemoSealError, sealDemoPackages, type DemoSealItem, type DemoSealOptions } from './index';

/** The staging folder inside the store. Not a package name (`SESSION-*`) and not a session name. */
export const DEMO_SEED_STAGING_DIR = '.demo-seed';

export const DemoSeedSkip = {
  /** The store does not lie inside the data directory: nothing media-like is written outside it. */
  STORE_OUTSIDE_DATA_DIR: 'STORE_OUTSIDE_DATA_DIR',
  /** The caller judged another store root than this Core's. */
  STORE_ROOT_MISMATCH: 'STORE_ROOT_MISMATCH',
  /** `<dataDir>/signer` holds no usable key. */
  SIGNING_KEY_NOT_USABLE: 'SIGNING_KEY_NOT_USABLE',
  /** The key of `<dataDir>/signer` is not the development key. */
  NOT_A_DEVELOPMENT_KEY: 'NOT_A_DEVELOPMENT_KEY',
  /** A target folder exists and the caller will not remove it. */
  PACKAGE_FOLDER_IN_THE_WAY: 'PACKAGE_FOLDER_IN_THE_WAY',
  /** The generator failed; what it created is removed. */
  GENERATION_FAILED: 'GENERATION_FAILED',
} as const;
export type DemoSeedSkip = (typeof DemoSeedSkip)[keyof typeof DemoSeedSkip];

/** One demo item as a seed describes it (`SeedDemoItem` of `db/seed`, structurally). */
export interface DemoSeedItem {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly caseNumber: string;
  readonly createdAt: number;
  readonly startedAt: number;
  readonly device: DemoSealItem['device'];
  readonly operator: DemoSealItem['operator'];
  readonly subject: { readonly name: string; readonly type: DemoSealItem['subject']['type'] };
}

export interface DemoSeedSeal {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly seal: CompleteSealInput;
  readonly mediaMs: number;
  readonly tampered: boolean;
  readonly sourceRows: readonly { readonly slot: string; readonly deviceId: string; readonly adapterKind: string }[];
}

export type DemoSeedOutcome = { readonly status: 'SEALED'; readonly packages: readonly DemoSeedSeal[] } | { readonly status: 'SKIPPED'; readonly reason: DemoSeedSkip; readonly message: string };

export interface DemoSeederCore {
  /** The Core's data directory (git-ignored): signer, credential store. */
  readonly dataDir: string;
  /** The Core's evidence store (`config.mediaStoreDir`). */
  readonly mediaStoreDir: string;
}

export interface DemoSeederPorts {
  /** Writes one generated camera file (see `DemoSealOptions.synthesise`). */
  readonly synthesise: DemoSealOptions['synthesise'];
  /** The seed's one clock reading: every package of a seed is sealed at that instant. */
  readonly now: () => number;
  readonly log: ErrorLog;
  /** Seconds of media per camera file. Default `DEMO_CLIP_SECONDS`. */
  readonly seconds?: number;
}

export interface DemoPackageSeeder {
  seal(items: readonly DemoSeedItem[], context: { readonly replaceable: readonly string[]; readonly storeRoot?: string | undefined }): Promise<DemoSeedOutcome>;
  place(): Promise<{ readonly placed: readonly string[]; readonly notPlaced: readonly { readonly directory: string; readonly reason: string }[] }>;
  discard(): Promise<void>;
}

/** The seeder over one Core's data directory. Builds nothing and reads nothing until `seal` is called. */
export function createDemoPackageSeeder(core: DemoSeederCore, ports: DemoSeederPorts): DemoPackageSeeder {
  const dataDir = resolve(core.dataDir);
  const store = resolve(core.mediaStoreDir);
  const staging = join(store, DEMO_SEED_STAGING_DIR);
  /** Session IDs whose package lies in the staging root, in seal order. */
  let staged: string[] = [];
  const skipped = (reason: DemoSeedSkip, message: string): DemoSeedOutcome => ({ status: 'SKIPPED', reason, message });
  const clear = (): void => {
    staged = [];
    rmSync(staging, { recursive: true, force: true });
  };

  return {
    async seal(items, context) {
      const inside = relative(dataDir, store);
      if (!isAbsolute(core.dataDir) || !isAbsolute(core.mediaStoreDir) || inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
        return skipped(DemoSeedSkip.STORE_OUTSIDE_DATA_DIR, 'the evidence store of this Core does not lie inside its data directory: a demo package is written nowhere else');
      }
      if (context.storeRoot !== undefined && resolve(context.storeRoot) !== store) {
        return skipped(DemoSeedSkip.STORE_ROOT_MISMATCH, 'the evidence store of this environment is not the store root the reset judged: set the same media directory for the command and the Core');
      }
      let signing: SealingPorts['signing'];
      try {
        signing = loadSealingSigner({ dataDir, now: ports.now() });
      } catch {
        return skipped(DemoSeedSkip.SIGNING_KEY_NOT_USABLE, 'this data directory holds no usable signing key under signer/ (provision the development key: npm run evidence:dev-key)');
      }
      if (!isDevelopmentSigningCertificate(signing.certificate)) {
        return skipped(DemoSeedSkip.NOT_A_DEVELOPMENT_KEY, 'the signing key of this data directory is not the development key: a demo package is sealed with the development key only');
      }
      const inTheWay = items.map((item) => packageFolderName(item.sessionId)).filter((directory) => existsSync(join(store, directory)) && !context.replaceable.includes(directory));
      if (inTheWay.length > 0) {
        return skipped(DemoSeedSkip.PACKAGE_FOLDER_IN_THE_WAY, `the evidence store already holds ${inTheWay.join(', ')}, and this run does not remove ${inTheWay.length === 1 ? 'it' : 'them'}: nothing is written over a folder`);
      }

      // The credential store of THIS data directory: the cipher's two doors take a host, not an app.
      // D180 (fix pass F-M7c): the session keys are those of the STORE the packages are placed in - never of the staging folder.
      const host = { stages: {}, config: { dataDir, mediaStoreDir: store } };
      const seconds = ports.seconds ?? DEMO_CLIP_SECONDS;
      clear();
      try {
        // A FRESH KEY PER RESEED (fix pass F-M7c, R88-13): the key an earlier generation sealed these sessions with is destroyed
        // before the first fragment - the packages it sealed are the ones this run replaces (or that the caller refused above).
        for (const item of items) renewSessionKey(host, item.sessionId);
        const sealed = await sealDemoPackages(
          { dataDir, mediaStoreDir: staging, synthesise: ports.synthesise, sealer: coreFragmentSealer(host), opener: coreFragmentOpener(host), signing, log: ports.log, now: ports.now, seconds },
          items.map((item): DemoSealItem => ({ ...item, subject: { ...item.subject, authorization: STAND_INS.subjectAuthorization } })),
        );
        staged = sealed.map((entry) => entry.sessionId);
        return {
          status: 'SEALED',
          packages: sealed.map((entry) => ({ evidenceId: entry.evidenceId, sessionId: entry.sessionId, seal: entry.seal, mediaMs: seconds * 1000, tampered: entry.tampered !== null, sourceRows: DEMO_SOURCE_ROWS.map((row) => ({ ...row })) })),
        };
      } catch (error) {
        clear();
        const code = error instanceof DemoSealError ? error.code : 'UNEXPECTED';
        return skipped(DemoSeedSkip.GENERATION_FAILED, `the v2 demo packages could not be generated (${code}); what the attempt created was removed`);
      }
    },

    async place() {
      const placed: string[] = [];
      const notPlaced: { directory: string; reason: string }[] = [];
      for (const sessionId of staged) {
        const directory = packageFolderName(sessionId);
        const target = join(store, directory);
        if (existsSync(target)) {
          notPlaced.push({ directory, reason: 'FOLDER_IN_THE_WAY' });
          continue;
        }
        try {
          // Owner-only when this call makes it (F-M7c, item 2): the store holds plaintext recordings until they are sealed.
          mkdirSync(store, { recursive: true, mode: 0o700 });
          renameSync(join(staging, directory), target);
          placed.push(directory);
        } catch {
          notPlaced.push({ directory, reason: 'MOVE_FAILED' });
        }
      }
      clear();
      return { placed, notPlaced };
    },

    async discard() {
      try {
        clear();
      } catch {
        // A staging root that cannot be removed holds no package a reader looks for.
      }
    },
  };
}
