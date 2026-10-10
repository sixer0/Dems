/**
 * THE DEVELOPMENT SEAL RIG OF A LANE (fix wave K, driver S1; re-gates 75 finding G75b-02 "not
 * provable live", decision D220: "a supported, reversible rig for the blocked seal"). Test support;
 * not a test file, and no file under `src/` can load it.
 *
 * WHAT IT IS FOR. The blocked-seal surfaces and the UNSEALABLE / quarantine outcome could be driven
 * on a lane only by planting a key file by hand or by changing the mode of the key folder. This rig
 * makes the product's OWN way out run instead: it stands in front of the fragment sealer of the
 * sealing host (`SealingHostSettings.developmentSealer`) and, when its switch file says so, makes
 * the seal of ONE session fail with a cause the product already has:
 *
 *   UNSEALABLE   the sealer refuses with the credential store's own `SESSION_KEY_NOT_OF_SESSION`
 *                - the NOT retriable cause of fix wave I. The pipeline fails `CLOSE_TRACKS` with
 *                `SEALER_FAILED` and that cause, retries by its own bounds, and at the third
 *                attempt ends the session UNSEALABLE: recordings MOVED to `.quarantine/`, the
 *                session INCOMPLETE, one CRITICAL alert, the Core free for the next session.
 *   BLOCKED      the sealer refuses with the store's own `STORE_UNAVAILABLE` - a RETRIABLE cause
 *                (`SESSION_KEY_STORE_UNAVAILABLE`). The pipeline retries (5 s, 30 s, 120 s), then
 *                waits with its CRITICAL "sealing blocked" alert. When the switch is released the
 *                product's own retry - the next automatic retry, the recovery action, or the next
 *                start of the Core - completes the seal. Nothing was changed on the disk.
 *
 * ONE SESSION. The switch is armed with a mode and no session; the rig BINDS it to the first session
 * whose seal it meets and that qualifies, by writing that session's ID into the switch file. From
 * then on it acts on that session only - through retries and restarts - and on no later session.
 *
 * FAKE SOURCES ONLY. A session qualifies when its START record (`session_capture_sources`) holds at
 * least one row and every row says adapter kind `FAKE`. A session that recorded from this computer's
 * camera or microphone (LOCAL_DEVICE) or from a production source is NEVER touched: the rig lets its
 * seal through, stays armed, and says so in one warn line.
 *
 * REFUSED IN PRODUCTION, TWICE. `prepareLaneSealRig` asks the capture fence before anything else
 * and throws for REAL_PRODUCTION (the launcher ends in the boot's final line, check
 * `sealing.sealRig`, code `DEV_SEAL_RIG_IN_PRODUCTION`): such a Core is not started. And the
 * sealing host itself refuses a `developmentSealer` in every operation but REAL_DEVELOPMENT.
 *
 * THE SWITCH FILE (`scripts/lane/lane.sh seal-rig <lane> ...` writes it; mode 0600):
 *     OFF                         or no file: the rig does nothing
 *     UNSEALABLE | BLOCKED        armed for the next qualifying session
 *     UNSEALABLE <sessionId>      bound (written by the rig)
 *     BLOCKED <sessionId>         bound (written by the rig)
 * Anything else reads as OFF, with one warn line. The file is read at every fragment the sealer is
 * asked for, so a release takes effect at the next attempt without a restart.
 *
 * The rig holds no key, reads no key and writes none: it throws before the real sealer is called,
 * so no session key is ever made for a rigged attempt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { CaptureOperation } from '../../src/capture/adapters';
import { captureOperationOf } from '../../src/capture/fence';
import { CredentialStoreError, CredentialStoreFailure } from '../../src/credential-store';
import { describeError } from '../../src/plugins/logger';
import type { SessionFragmentSealer } from '../../src/sealing';
import { sealingHost } from '../../src/sealing-host';
import { READ_SEAL_SOURCE_ROWS } from '../../src/sealing-host/session-reader';

const SOURCE = 'laneSealRig';
/** The boot check a refusal is named with in the launcher's final line. */
export const LANE_SEAL_RIG_CHECK = 'sealing.sealRig';
export const LANE_SEAL_RIG_IN_PRODUCTION = 'DEV_SEAL_RIG_IN_PRODUCTION';

export const LaneSealRigMode = { UNSEALABLE: 'UNSEALABLE', BLOCKED: 'BLOCKED' } as const;
export type LaneSealRigMode = (typeof LaneSealRigMode)[keyof typeof LaneSealRigMode];

/** What each mode makes the sealer throw: the credential store's OWN failure, so the product names its own cause. */
export const LANE_SEAL_RIG_FAILURE: Readonly<Record<LaneSealRigMode, CredentialStoreFailure>> = Object.freeze({
  UNSEALABLE: CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION,
  BLOCKED: CredentialStoreFailure.STORE_UNAVAILABLE,
});

export class LaneSealRigError extends Error {
  readonly code = LANE_SEAL_RIG_IN_PRODUCTION;
  constructor() {
    super('a development seal rig is never started on a production capture configuration');
    this.name = 'LaneSealRigError';
  }
}

export interface LaneSealRigSwitch {
  readonly mode: LaneSealRigMode;
  /** Null: armed, not bound to a session yet. */
  readonly sessionId: string | null;
}

const SESSION_ID = /^SES-\d{8}-\d{4}$/;

/** The switch a file text says. Null: OFF. `unknown: true`: text that is no switch (read as OFF). */
export function laneSealRigSwitchOf(text: string): { readonly value: LaneSealRigSwitch | null; readonly unknown: boolean } {
  const words = text.trim().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0 || (words.length === 1 && words[0] === 'OFF')) return { value: null, unknown: false };
  const mode = words[0];
  if ((mode !== LaneSealRigMode.UNSEALABLE && mode !== LaneSealRigMode.BLOCKED) || words.length > 2) return { value: null, unknown: true };
  const sessionId = words[1] ?? null;
  if (sessionId !== null && !SESSION_ID.test(sessionId)) return { value: null, unknown: true };
  return { value: { mode, sessionId }, unknown: false };
}

/** Whether the START record of a session names generated (FAKE) sources only. No rows: false. */
export const fakeSourcesOnly = (rows: readonly { readonly adapter_kind: string }[]): boolean => rows.length > 0 && rows.every((row) => row.adapter_kind === 'FAKE');

export interface LaneSealRigPorts {
  /** The text of the switch file, or null when there is none. */
  readonly read: () => string | null;
  /** Writes the switch file (the binding). */
  readonly write: (text: string) => void;
  /** The adapter kinds of the START record of a session. */
  readonly sources: (sessionId: string) => Promise<readonly { readonly adapter_kind: string }[]>;
  readonly report: (level: 'warn' | 'error', code: string, message: string, context: Record<string, string | null>, error?: unknown) => void;
}

/**
 * THE RULE, without a file system or a database: what the rig does to one call of the sealer.
 * Returns the failure to throw, or null (the real sealer runs).
 */
export function createLaneSealRig(ports: LaneSealRigPorts): { decide(sessionId: string): Promise<CredentialStoreFailure | null> } {
  const qualified = new Map<string, boolean>();
  const said = new Set<string>();
  const once = (key: string, tell: () => void): void => {
    if (said.has(key)) return;
    said.add(key);
    tell();
  };
  return {
    async decide(sessionId) {
      let text: string | null;
      try {
        text = ports.read();
      } catch (error) {
        once('unreadable', () => ports.report('error', 'LANE_SEAL_RIG_UNREADABLE', 'the switch file of the seal rig could not be read: the rig does nothing', {}, error));
        return null;
      }
      if (text === null) return null;
      const parsed = laneSealRigSwitchOf(text);
      if (parsed.unknown) once(`unknown:${text}`, () => ports.report('warn', 'LANE_SEAL_RIG_SWITCH_UNKNOWN', 'the switch file of the seal rig names no switch: the rig does nothing (OFF, UNSEALABLE, BLOCKED)', {}));
      const active = parsed.value;
      if (active === null) return null;
      if (active.sessionId !== null && active.sessionId !== sessionId) return null;

      // FAKE sources only - asked once per session, whoever wrote the session into the file.
      let fake = qualified.get(sessionId);
      if (fake === undefined) {
        fake = fakeSourcesOnly(await ports.sources(sessionId));
        qualified.set(sessionId, fake);
      }
      if (!fake) {
        once(`not-fake:${sessionId}`, () => ports.report('warn', 'LANE_SEAL_RIG_NOT_A_FAKE_SESSION', 'the seal rig is armed, and this session did not record from generated (FAKE) sources only: its seal is NOT touched', { sessionId, mode: active.mode }));
        return null;
      }
      if (active.sessionId === null) {
        ports.write(`${active.mode} ${sessionId}\n`);
        ports.report('warn', 'LANE_SEAL_RIG_BOUND', 'the seal rig is bound to this session: its seal is made to fail on purpose, with a cause the product already has', { sessionId, mode: active.mode });
      }
      return LANE_SEAL_RIG_FAILURE[active.mode];
    },
  };
}

/** The sealer behind the rig. The rig decides BEFORE the real sealer is called: no key is made for a rigged attempt. */
export function riggedSealer(base: SessionFragmentSealer, rig: { decide(sessionId: string): Promise<CredentialStoreFailure | null> }): SessionFragmentSealer {
  return {
    async seal(sessionId, position, plaintext) {
      const failure = await rig.decide(sessionId);
      if (failure !== null) throw new CredentialStoreError(failure);
      return base.seal(sessionId, position, plaintext);
    },
  };
}

export interface LaneSealRig {
  /** The operation the fence answered. */
  readonly operation: string;
  /** False on a SIMULATED lane (nothing is sealed by a pipeline there) and without a switch file path. */
  readonly admitted: boolean;
  /** Puts the rig in front of the sealer. AFTER `app.ready()`, BEFORE the boot (the host takes settings before its first seal only). */
  install(): void;
}

/**
 * Asks the fence. REAL_PRODUCTION: throws `LaneSealRigError` - call it BEFORE `app.ready()` so that
 * such a Core is not started at all. SIMULATED, or no file: an inert rig and one line that says so.
 */
export function prepareLaneSealRig(app: FastifyInstance, switchFile: string | null): LaneSealRig {
  const operation = captureOperationOf(app.config);
  if (operation === CaptureOperation.REAL_PRODUCTION) throw new LaneSealRigError();
  if (switchFile === null) return { operation, admitted: false, install: () => undefined };
  if (operation !== CaptureOperation.REAL_DEVELOPMENT) {
    return { operation, admitted: false, install: () => app.log.warn({ code: 'LANE_SEAL_RIG_IGNORED', source: SOURCE, operation }, 'the seal rig was asked for a Core that seals nothing by a pipeline (simulated capture): it is not installed') };
  }
  return {
    operation,
    admitted: true,
    install() {
      const rig = createLaneSealRig({
        read: () => {
          try {
            return readFileSync(switchFile, 'utf8');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
          }
        },
        write: (text) => writeFileSync(switchFile, text, { mode: 0o600 }),
        sources: async (sessionId) => (await app.db.pool.query<{ adapter_kind: string }>(READ_SEAL_SOURCE_ROWS, [sessionId])).rows,
        report: (level, code, message, context, error) => {
          if (level === 'error') app.log.error({ err: error, code, source: SOURCE, ...context }, message);
          else app.log.warn({ code, source: SOURCE, ...context }, message);
          app.errorLog.append({ level, source: SOURCE, message, ...(error === undefined ? {} : describeError(error)), code, context });
        },
      });
      sealingHost(app).replace({ developmentSealer: (base) => riggedSealer(base, rig) });
      app.log.info({ code: 'LANE_SEAL_RIG_INSTALLED', source: SOURCE, operation }, 'the development seal rig is installed and OFF until its switch file says otherwise');
    },
  };
}
