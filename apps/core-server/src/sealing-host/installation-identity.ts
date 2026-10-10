/**
 * THE INSTALLATION IDENTITY OF THE CORE (task 3 fix wave H, closing pass Z1; driver A decision 2;
 * decision D207): what the signed manifest of a sealed recording states as its device - manifest
 * fields 20 (`device.deviceId`) and 21 (`device.name`).
 *
 * WHY CONFIGURATION. Until this pass the two fields were the Core's stored device record, whose
 * values are the SEED's (`DEMS-IR-01`, `Interview Room 1`): every installation signed the same
 * dataset name into its evidence. No installation step sets that record, so it cannot say which
 * Core recorded. The identity is now two settings, read once at the start of the Core:
 *
 *     DEMS_INSTALLATION_DEVICE_ID   a device id of the contract's form, e.g. `DEMS-JKT-07`
 *     DEMS_INSTALLATION_NAME        a display name, e.g. `Ruang Pemeriksaan 3`
 *
 * `installationIdentityOf` IS THE ONLY READER of the two configuration members. A member that is
 * not configured is stated as `NOT_CONFIGURED` in the manifest - as the serial number and the
 * hardware UUID already are (fields 22, 23; `session-reader.ts`) - never as a value of the dataset.
 *
 *   operation          identity            the start
 *   REAL_PRODUCTION    both configured     goes on
 *   REAL_PRODUCTION    one or both absent  REFUSED: `INSTALLATION_IDENTITY_NOT_CONFIGURED` (a
 *                                          production Core never signs evidence that does not say
 *                                          which installation recorded it)
 *   REAL_DEVELOPMENT   one or both absent  goes on with ONE warning (log and error log); the
 *                                          manifest says `NOT_CONFIGURED`
 *   SIMULATED          any                 not asked: nothing is sealed by this host
 *
 * NOT TOUCHED: the stored device record itself. It stays the id the audit rows, the realtime state
 * and the clients name this Core by (`device.id`); renaming it is a migration of rows, not a
 * setting. Pure: no file, no clock, no environment is read here.
 */
/**
 * The three capture operations, by value (`CaptureOperation` of the capture unit: a value of that
 * type is one of these). Named here as literals so that this file imports no unit: the adapter
 * layer is reached by the units that wire it only (static rule A-5).
 */
export type InstallationOperation = 'SIMULATED' | 'REAL_DEVELOPMENT' | 'REAL_PRODUCTION';

/** What a manifest field says when no setting gives the Core that fact (the word `session-reader.ts` uses for fields 22, 23). */
export const INSTALLATION_NOT_CONFIGURED = 'NOT_CONFIGURED';

/** The two configuration members the identity is read from (`CoreServerConfig` satisfies it). */
export interface InstallationIdentityInput {
  readonly installationDeviceId?: string | null;
  readonly installationName?: string | null;
}

export interface InstallationIdentity {
  /** The configured device id, or null. */
  readonly deviceId: string | null;
  /** The configured display name, or null. */
  readonly name: string | null;
  /** True when both are configured. */
  readonly configured: boolean;
  /** The environment keys of the members that are not configured, in a fixed order. */
  readonly missing: readonly string[];
}

/** The names of the two settings (the same strings as `ENV_INSTALLATION_*` of `config.ts`; a test holds them together). */
export const INSTALLATION_IDENTITY_KEYS = Object.freeze({ deviceId: 'DEMS_INSTALLATION_DEVICE_ID', name: 'DEMS_INSTALLATION_NAME' });

const set = (value: string | null | undefined): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/** THE one reader of the two configuration members. */
export function installationIdentityOf(config: InstallationIdentityInput): InstallationIdentity {
  const deviceId = set(config.installationDeviceId);
  const name = set(config.installationName);
  const missing = [...(deviceId === null ? [INSTALLATION_IDENTITY_KEYS.deviceId] : []), ...(name === null ? [INSTALLATION_IDENTITY_KEYS.name] : [])];
  return Object.freeze({ deviceId, name, configured: missing.length === 0, missing: Object.freeze(missing) });
}

/** Manifest fields 20 and 21 as the identity gives them. */
export function manifestDeviceIdentityOf(identity: Pick<InstallationIdentity, 'deviceId' | 'name'>): { readonly deviceId: string; readonly name: string } {
  return { deviceId: identity.deviceId ?? INSTALLATION_NOT_CONFIGURED, name: identity.name ?? INSTALLATION_NOT_CONFIGURED };
}

export const INSTALLATION_IDENTITY_NOT_CONFIGURED = 'INSTALLATION_IDENTITY_NOT_CONFIGURED';

const REFUSED = 'the installation identity of this Core is not configured: a production Core does not start without it, because the signed manifest of every recording would not say which installation recorded it';
const WARNED = 'the installation identity of this Core is not configured: the signed manifest of a recording sealed here says NOT_CONFIGURED for the device id and the name (development capture; a production Core refuses to start)';

/** The start of a production Core without its installation identity. `message` names the settings, never a value. */
export class InstallationIdentityError extends Error {
  readonly code = INSTALLATION_IDENTITY_NOT_CONFIGURED;
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`${REFUSED}. Set ${missing.join(' and ')}.`);
    this.name = 'InstallationIdentityError';
    this.missing = Object.freeze([...missing]);
  }
}

export type InstallationIdentityVerdict =
  | { readonly action: 'PASS' }
  | { readonly action: 'WARN'; readonly code: typeof INSTALLATION_IDENTITY_NOT_CONFIGURED; readonly message: string; readonly missing: readonly string[] }
  | { readonly action: 'REFUSE'; readonly error: InstallationIdentityError };

/** The table of the header. */
export function installationIdentityVerdictOf(identity: InstallationIdentity, operation: InstallationOperation): InstallationIdentityVerdict {
  if (operation === 'SIMULATED' || identity.configured) return { action: 'PASS' };
  if (operation === 'REAL_PRODUCTION') return { action: 'REFUSE', error: new InstallationIdentityError(identity.missing) };
  return { action: 'WARN', code: INSTALLATION_IDENTITY_NOT_CONFIGURED, message: WARNED, missing: identity.missing };
}

export interface InstallationIdentitySinks {
  persist(level: 'error' | 'warn', code: string, message: string, context: Record<string, string>): void;
}

/**
 * The boot step of the identity: says the verdict to the log and the error log, and THROWS the
 * refusal - the readiness runner stops the start as it does for any boot step.
 */
export function runInstallationIdentityBoot(identity: InstallationIdentity, operation: InstallationOperation, sinks: InstallationIdentitySinks): void {
  const verdict = installationIdentityVerdictOf(identity, operation);
  if (verdict.action === 'PASS') return;
  const context = { operation, missing: (verdict.action === 'REFUSE' ? verdict.error.missing : verdict.missing).join(',') };
  if (verdict.action === 'WARN') {
    sinks.persist('warn', verdict.code, verdict.message, context);
    return;
  }
  sinks.persist('error', verdict.error.code, verdict.error.message, context);
  throw verdict.error;
}
