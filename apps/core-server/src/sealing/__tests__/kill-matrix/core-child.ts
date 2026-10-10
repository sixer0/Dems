/**
 * THE CORE IN A PROCESS OF ITS OWN, for the kill matrix (blueprint row 86). NOT A TEST FILE AND
 * NOT PRODUCT CODE: `rig.ts` starts it with `fork` (tsx), one process per "boot" of a cell, so
 * that a cell can end a Core the way a crash ends it - SIGKILL - and start the next one on the
 * same database, data directory and media root.
 *
 * WHAT RUNS HERE IS THE PRODUCT: `buildApp` with every unit, in capture mode `real` with
 * development sources, booted the way `src/index.ts` boots it (ready, boot steps, capture boot).
 * The sealing pipeline is the one `src/sealing-host` composes and mounts; RECOVERY is its boot
 * step. Nothing of the composition is copied or replaced.
 *
 * THE ONE THING ADDED: THE KILL POINT. The production ports carry no hook (note 37b section 5
 * item 4), and the product is closed for this row. The kill point is therefore placed where the
 * pipeline's hook points are, from outside the pipeline: the three points of a step are the two
 * writes of its row in `sealing_jobs` (`WRITE_SEALING_STEP`, parameters `[sessionId, step,
 * status, ...]`). The pool's `query` is wrapped IN THIS PROCESS ONLY; at the armed write the
 * process sends SIGKILL to itself and never returns:
 *
 *   BEFORE            the step's first RUNNING write arrives  -> killed, the write is not sent
 *   AFTER_WORK        the step's DONE write arrives           -> killed, the write is not sent
 *   AFTER_CHECKPOINT  the step's DONE write has been answered -> killed
 *
 * NO CREDENTIAL IN ARGV OR ENVIRONMENT: the configuration of the throw-away database arrives as
 * the first message of the IPC channel and is held in a `Secret`.
 *
 * Commands (one JSON message each, answered with the same `id`): `inject`, `signIn`,
 * `tabletLink`, `view`, `settled`, `close`.
 */
import { OPERATORS } from '@dems/shared/sim';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import { Secret } from '../../../config';
import { sealingHost } from '../../../sealing-host';
import { WRITE_SEALING_STEP } from '../../step-journal';

export interface ChildInit {
  readonly type: 'init';
  readonly database: { readonly host: string; readonly port: number; readonly database: string; readonly user: string; readonly password: string };
  readonly dataDir: string;
  readonly mediaStoreDir: string;
  readonly worker: string;
  readonly helper: string;
  /** Null: this process is never killed by itself. */
  readonly arm: { readonly step: string; readonly phase: 'BEFORE' | 'AFTER_WORK' | 'AFTER_CHECKPOINT' } | null;
}

export type ChildCommand =
  | { readonly id: number; readonly op: 'inject'; readonly method: 'GET' | 'POST'; readonly url: string; readonly cookie: string; readonly payload?: Record<string, unknown> }
  | { readonly id: number; readonly op: 'signIn' }
  | { readonly id: number; readonly op: 'tabletLink' }
  | { readonly id: number; readonly op: 'view'; readonly sessionId: string | null }
  | { readonly id: number; readonly op: 'settled' }
  | { readonly id: number; readonly op: 'close' };

export interface ChildView {
  readonly mounted: boolean;
  readonly session: { readonly id: string; readonly state: string; readonly captureDurable: boolean | null; readonly evidenceId: string | null; readonly stoppedAt: number | null; readonly precheckDone: boolean; readonly fault: string | null; readonly steps: readonly (readonly [string, string, string | null])[] } | null;
  /** The devices the selector of this database names, with their adapter kind. */
  readonly assigned: readonly (readonly [string, string])[];
  readonly items: readonly { readonly id: string; readonly status: string; readonly integritySource: string | null; readonly manifestVersion: number | null; readonly developmentSources: boolean | null; readonly verification: string | null }[];
  readonly outcome: unknown;
  /** The last coded log lines: codes and identifiers, no value. */
  readonly codes: readonly string[];
}

const send = (message: Record<string, unknown>): void => {
  process.send?.(message);
};

/** SIGKILL to this process. The kernel ends it here; the loop only keeps the statement after it from ever running. */
function dieHere(): never {
  process.kill(process.pid, 'SIGKILL');
  for (;;) {
    /* killed */
  }
}

function armKillPoint(pool: { query: (...args: unknown[]) => Promise<unknown> }, arm: NonNullable<ChildInit['arm']>): void {
  const original = pool.query.bind(pool);
  pool.query = async (...args: unknown[]): Promise<unknown> => {
    const [text, values] = args;
    const ours = text === WRITE_SEALING_STEP && Array.isArray(values) && values[1] === arm.step;
    if (ours && arm.phase === 'BEFORE' && (values as unknown[])[2] === 'RUNNING') dieHere();
    if (ours && arm.phase === 'AFTER_WORK' && (values as unknown[])[2] === 'DONE') dieHere();
    const answer = await original(...args);
    if (ours && arm.phase === 'AFTER_CHECKPOINT' && (values as unknown[])[2] === 'DONE') dieHere();
    return answer;
  };
}

async function main(init: ChildInit): Promise<void> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: { ...init.database, password: new Secret(init.database.password) },
      dataDir: init.dataDir,
      mediaStoreDir: init.mediaStoreDir,
      logLevel: 'info',
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      captureHelperFfmpegPath: init.helper,
      captureWorkerPath: init.worker,
    }),
    logStream: log.stream,
    errorLogFile: `${init.dataDir}/error.log`,
  });
  await app.ready();
  // Before the boot steps: RECOVERY's resume is one of them, and a cell may kill inside it.
  if (init.arm !== null) armKillPoint(app.db.pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }, init.arm);
  await app.readiness.boot();
  await app.capture.boot();

  const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR');
  if (investigator === undefined) throw new Error('no seeded investigator');

  const view = (sessionId: string | null): ChildView => {
    const state = app.engine.state();
    const session = state.session;
    const assigned = [...state.captureConfig.cameras.map((camera) => camera.deviceId), ...state.captureConfig.mics.map((mic) => mic.deviceId)].sort();
    return {
      mounted: sealingHost(app).mounted,
      session:
        session === null
          ? null
          : {
              id: session.id,
              state: session.state,
              captureDurable: (session as { captureDurable?: boolean }).captureDurable ?? null,
              evidenceId: session.evidenceId ?? null,
              stoppedAt: session.stoppedAt ?? null,
              precheckDone: session.precheck.completedAt !== null,
              fault: session.fault === null || session.fault === undefined ? null : String((session.fault as { kind?: unknown }).kind ?? 'FAULT'),
              steps: session.finalization.steps.map((step) => [step.id, step.status, step.detail ?? null] as const),
            },
      assigned: assigned.map((id) => [id, state.captureDevices.devices.find((device) => device.id === id)?.adapter ?? 'FAKE'] as const),
      items: state.evidence
        .filter((item) => sessionId !== null && item.sessionId === sessionId)
        .map((item) => ({ id: item.id, status: item.status, integritySource: item.integritySource ?? null, manifestVersion: item.manifestVersion ?? null, developmentSources: item.developmentSources ?? null, verification: item.verification?.status ?? null })),
      outcome: sealingHost(app).lastOutcome(),
      codes: log
        .lines()
        .filter((line) => typeof line.code === 'string')
        .slice(-14)
        .map((line) => `${String(line.code)}${typeof line.step === 'string' ? `@${line.step}` : ''}`),
    };
  };

  process.on('message', (command: ChildCommand) => {
    void (async () => {
      switch (command.op) {
        case 'inject': {
          const answer = await app.inject({ method: command.method, url: command.url, headers: command.method === 'POST' ? { cookie: command.cookie, origin: WEB_ORIGIN } : { cookie: command.cookie }, ...(command.payload === undefined ? {} : { payload: command.payload }) });
          return { statusCode: answer.statusCode, body: answer.body };
        }
        case 'signIn': {
          const answer = await webSignIn(app, investigator.username);
          const token = cookieValue(answer, app.config.sessionCookieName);
          if (answer.statusCode !== 200 || token === null) throw new Error(`the sign-in answered ${answer.statusCode}`);
          return { cookie: `${app.config.sessionCookieName}=${token}`, investigatorId: investigator.id };
        }
        case 'tabletLink':
          await app.engine.setTabletLink('CONNECTED');
          return null;
        case 'view':
          return view(command.sessionId);
        case 'settled':
          await sealingHost(app).settled();
          return null;
        case 'close':
          await app.close();
          setImmediate(() => process.exit(0));
          return null;
      }
    })().then(
      (value) => send({ id: command.id, ok: true, value }),
      (error: unknown) => send({ id: command.id, ok: false, error: error instanceof Error ? error.message : 'the command failed' }),
    );
  });
  send({ type: 'ready', pid: process.pid });
}

process.once('message', (init: ChildInit) => {
  main(init).catch((error: unknown) => {
    // The message of a boot refusal names codes and steps, never a credential (the config holds it as a Secret).
    send({ type: 'failed', error: error instanceof Error ? `${error.name}: ${error.message}` : 'the Core did not start' });
    process.exit(1);
  });
});
