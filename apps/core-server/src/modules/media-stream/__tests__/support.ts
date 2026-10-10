/**
 * Test support of the media-stream module (blueprint row 90; not a test file).
 *
 * THE APP. The real app factory with no database. `app.ts` registers the module (ruling D140), and
 * the REAL access rule (stage 6) stands in front of BOTH routes: operation 88 by its registry
 * entry, `GET /media/:token` by the guard's fixed rule (the rule of operation 88). No stage but
 * stage 4 is replaced.
 *
 * Stage 4 hands out the principal the test chose. The seam `pipeline` is a stand-in that runs a
 * unit and keeps the audit entries it was asked to append - each one checked by the REAL rules of
 * the audit writer (`auditInputOf`: the exact detail-key list of its type, no secret-shaped value).
 *
 * THE PACKAGE. Row 85's builder of real sealed v2 packages, with every fragment sealed by the
 * PRODUCT sealer (`createFragmentSealer`) under a session key of a REAL credential store in a
 * throw-away data directory. The app opens it through its own parts: `coreFragmentOpener(app)`
 * and the media-session key of the same store. What is not real: the media (random bytes, not
 * fMP4), the database (the item is a value) and the folder place (the test names it).
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createManualClock } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import type { AuditEntry } from '../../../core';
import { auditInputOf } from '../../../core/audit-writer';
import { coreCredentialStore, createFragmentSealer } from '../../../credential-store';
import { buildPackage, removeScratch, type BuildOptions, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { mediaStream, type MediaItem } from '../../../media-stream';
import type { Principal } from '../../../plugins/authenticate';
import { ANONYMOUS, FIXED_NOW, committedOf, engineDouble, scenarioState } from '../../devices/__tests__/support';

export const EVIDENCE_ID = 'EV-20261009-0001';
export const SESSION_ID = 'SES-20261009-0001';
export const WEB_ORIGIN = 'http://127.0.0.1:5173';
export const sessionsPath = (evidenceId: string = EVIDENCE_ID): string => `/api/v1/evidence/${evidenceId}/media-sessions`;

const dataDirs: string[] = [];
export function removeMediaScratch(): void {
  removeScratch();
  for (const dir of dataDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** Every file below a folder with its length: what a run may not add to. */
export function filesBelow(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else found.push(`${path.slice(root.length)} ${statSync(path).size}`);
    }
  };
  walk(root);
  return found.sort();
}

export interface MediaApp {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly dataDir: string;
  readonly built: BuiltPackage;
  /** The audit entries the routes asked a unit to append, with the label of the unit, in order. */
  readonly appended: Array<AuditEntry & { readonly unit: string }>;
  /** `seq` of every fragment the opener was asked to open, in order. */
  readonly opened: number[];
  /** The items the database stand-in knows, by evidence ID. The test edits it. */
  readonly items: Map<string, MediaItem>;
  /** The persistent error log entries. */
  readonly errors: Array<Record<string, unknown>>;
  actAs(principal: Principal): void;
  /** Operation 88. */
  open(body?: unknown, evidenceId?: string): Promise<LightMyRequestResponse>;
  /** The media route, by the URL operation 88 answered (its path is what a client uses). */
  fetch(url: string, range?: string): Promise<LightMyRequestResponse>;
}

export interface MediaAppOptions extends BuildOptions {
  /** False: the app has no data directory, so no credential store. */
  readonly store?: boolean;
}

/** The app, a sealed package and its item. Close the app with `app.close()`. */
export async function mediaApp(options: MediaAppOptions = {}): Promise<MediaApp> {
  const { store = true, ...build } = options;
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-row90-data-'));
  dataDirs.push(dataDir);
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info', ...(store ? { dataDir } : {}) }), createPool: () => fake.pool, logStream: log.stream });
  const errors: Array<Record<string, unknown>> = [];
  const persisted = app.errorLog.append.bind(app.errorLog);
  app.errorLog.append = (entry) => {
    errors.push(entry as unknown as Record<string, unknown>);
    persisted(entry);
  };

  // The package: sealed by the product sealer under a session key of the app's own store.
  let built: BuiltPackage;
  if (store) {
    const opened = coreCredentialStore(app);
    if (opened.status !== 'READY') throw new Error(`the credential store of the test app is ${opened.status}`);
    const key = opened.store.sessionKeys.create(SESSION_ID);
    const sealer = createFragmentSealer(key);
    built = await buildPackage({ evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, ...build, sealer: (position, plaintext) => sealer.seal(position, plaintext) });
    opened.store.sessionKeys.release(key);
  } else {
    built = await buildPackage({ evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, ...build });
  }

  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  app.seams.replace('engine', engineDouble(committedOf(scenarioState('idle'))).host);
  const clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', { now: () => clock.now() });

  const appended: MediaApp['appended'] = [];
  app.seams.replace('pipeline', {
    run: async (label: string, work: (unit: unknown) => unknown) =>
      work({
        label,
        audit: {
          append: async (entry: AuditEntry) => {
            // The real rules of the audit writer: the exact detail keys of the type, no secret-shaped value.
            auditInputOf(entry);
            appended.push({ ...entry, unit: label });
            return entry;
          },
        },
      }),
  } as unknown as FastifyInstance['pipeline']);

  const items = new Map<string, MediaItem>([
    [EVIDENCE_ID, { evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, investigatorId: 'OPR-001', real: true, manifestSha256: built.manifest.manifestSha256 }],
  ]);
  const opened: number[] = [];
  const own = mediaStream(app).parts();
  mediaStream(app).replaceForTest({
    packageDirOf: (sessionId) => (sessionId === SESSION_ID ? built.dir : null),
    readItem: async (_request, evidenceId) => items.get(evidenceId) ?? null,
    opener: {
      hasKey: (keyId) => own.opener.hasKey(keyId),
      open(record, stored) {
        opened.push(record.seq);
        return own.opener.open(record, stored);
      },
    },
  });

  return {
    app,
    log,
    clock,
    dataDir,
    built,
    appended,
    opened,
    items,
    errors,
    actAs: (principal) => void (current = principal),
    open: (body, evidenceId) =>
      app.inject({ method: 'POST', url: sessionsPath(evidenceId), headers: { origin: WEB_ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { payload: JSON.stringify(body) }) }),
    fetch: (url, range) => app.inject({ method: 'GET', url: new URL(url).pathname, headers: range === undefined ? {} : { range } }),
  };
}
