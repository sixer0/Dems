/**
 * The identity and pairing part of the bulk fixture (plan row W25; database contract §4.4 to
 * §4.11, §5, §11; BF-4): operators and their credential rows, pairing codes, paired devices and
 * their credentials, biometric tokens, auth sessions.
 *
 * These are the server-native tables: no simulator slice holds them, so the mapping module has
 * no row builder for them (except the operator's, which is used). The rows are built here in
 * the select shape of the typed schema, every column present.
 *
 * SYNTHETIC ONLY (BF-4, SR-62). A fixture operator is `fixture.operator.NNN`; no name is taken
 * from anywhere. Its credential row is made of pseudo-random bytes that are the hash of no
 * password, so no fixture operator can sign in. Every hash column holds the SHA-256 of a text
 * that says what it is (`rng.ts`); no credential of any kind exists for a fixture row.
 *
 * CONSISTENT WITH ITS OWN HISTORY. A session of a revoked device ends when the device was
 * revoked, with that reason; a disabled operator's sessions end at the disable; a token reuse
 * revokes the family and ends the biometric sessions of that device and operator (AT-C4); an
 * open session belongs to an enabled operator and, if it has a device, to a paired one.
 *
 * THE DETAILS OF AN AUDIT ROW are the ones the writing module gives that type (decisions D91, D93):
 * the closed list of the audit writer for the nine server-written types (`core/audit-details.ts`),
 * and the keys of the builders of the identity, pairing and biometric modules for the others. The
 * rows are still built here, not by those modules: the fixture replays no request. What a count in
 * a row says (`sessionsEnded`) is the number of session rows the fixture ends at that instant.
 * `__tests__/audit-details.test.ts` holds every row against the writer's list and the builders.
 *
 * THE WHOLE ROW, AND THE EVENT BESIDE IT (decision D103). Where a module has a builder for a type,
 * the severity, the message and the details of the fixture's row are that builder's, and so are
 * the type, the severity, the message and the parameters of the event the module writes beside
 * it. The three administration types have no builder: their wording is the fixture's own.
 *
 * A KNOWN LIMIT. A lock is not replayed across rows: `attemptsRemaining`, `lockedUntil` and
 * `retryInMs` have the form and the range the modules give them and agree with the instant of
 * their own row, but a failure that follows a lock within its 60 s is still written as a failure
 * (a real server would refuse it as locked, which would change the counts of the two types).
 */
import {
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_LOCKOUT_MS,
  AUTH_MAX_FAILURES,
  OperatorRole,
  PAIRING_LOCKOUT_MS,
  PAIRING_MAX_FAILURES,
  type SimOperator,
} from '@dems/shared/sim';
import { PASSWORD_HASH_ALGORITHM, PASSWORD_HASH_BYTES, PASSWORD_HASH_PARAMETERS, PASSWORD_SALT_BYTES } from '../../modules/identity/password-hash';
import { operatorToRow } from '../mapping';
import type {
  AuthMethodValue,
  AuthSessionRow,
  BioRevokeReason,
  BiometricTokenRow,
  CodeStateValue,
  DeviceCredentialRow,
  DeviceStateValue,
  NewOperatorCredentialRow,
  OperatorRow,
  PairedDeviceRow,
  PairingCodeRow,
  SessionEndReason,
} from '../schema';
import { fakeSecretHash, type FixtureRng } from './rng';
import {
  BIOMETRIC_TOKEN_TTL_MS,
  DAY_MS,
  EXPIRY_SWEEP_MS,
  HOUR_MS,
  MINUTE_MS,
  PAIRING_CODE_TTL_MS,
  SECOND_MS,
  SESSION_ABSOLUTE_MS,
  UNICODE_SAMPLE,
  padded,
  type OperatorChange,
  type World,
} from './world';

// ── Operators ──────────────────────────────────────────────────────────────────────────────────

/** An operator with the history of its account. A seeded operator has no change. */
export interface OperatorEntry {
  readonly operator: SimOperator;
  readonly seeded: boolean;
  readonly createdAt: number;
  readonly changes: readonly OperatorChange[];
}

interface FixtureOperatorSpec {
  /** The role the operator holds at `now`. */
  readonly role: OperatorRole;
  readonly changes: ReadonlyArray<{ readonly daysAgo: number; readonly kind: OperatorChange['kind']; readonly previousRole?: OperatorRole }>;
  readonly unicode?: boolean;
}

/**
 * The nine fixture operators (the contract's 12, minus the three seeded): two more enabled
 * SUPERVISOR, three disabled accounts (one of each role), one that was disabled and enabled
 * again, and two whose role was changed.
 */
const FIXTURE_OPERATORS: readonly FixtureOperatorSpec[] = [
  { role: OperatorRole.SUPERVISOR, changes: [] },
  { role: OperatorRole.SUPERVISOR, changes: [] },
  { role: OperatorRole.INVESTIGATOR, changes: [{ daysAgo: 50, kind: 'ROLE', previousRole: OperatorRole.TECHNICIAN }] },
  { role: OperatorRole.INVESTIGATOR, changes: [], unicode: true },
  { role: OperatorRole.INVESTIGATOR, changes: [{ daysAgo: 20, kind: 'DISABLED' }] },
  { role: OperatorRole.TECHNICIAN, changes: [{ daysAgo: 40, kind: 'DISABLED' }, { daysAgo: 38, kind: 'ENABLED' }] },
  { role: OperatorRole.TECHNICIAN, changes: [{ daysAgo: 12, kind: 'DISABLED' }] },
  { role: OperatorRole.SUPERVISOR, changes: [{ daysAgo: 35, kind: 'DISABLED' }] },
  { role: OperatorRole.TECHNICIAN, changes: [{ daysAgo: 28, kind: 'ROLE', previousRole: OperatorRole.INVESTIGATOR }] },
];

/** Who holds which role and who may sign in, at any instant of the fixture's history. */
export class OperatorDirectory {
  readonly entries: readonly OperatorEntry[];

  constructor(entries: readonly OperatorEntry[]) {
    this.entries = entries;
  }

  roleAt(entry: OperatorEntry, at: number): OperatorRole {
    // The role before the first role change that lies after `at`; the final role otherwise.
    const later = entry.changes.find((change) => change.kind === 'ROLE' && change.at > at);
    return later?.previousRole ?? entry.operator.role;
  }

  enabledAt(entry: OperatorEntry, at: number): boolean {
    let enabled = true;
    for (const change of entry.changes) {
      if (change.at > at) break;
      if (change.kind === 'DISABLED') enabled = false;
      if (change.kind === 'ENABLED') enabled = true;
    }
    return enabled;
  }

  /** The account exists, is enabled from `from` to `to`, and no change of it falls in between. */
  usable(entry: OperatorEntry, from: number, to: number): boolean {
    return entry.createdAt <= from && this.enabledAt(entry, from) && !entry.changes.some((change) => change.at > from && change.at <= to);
  }

  /** The operators that are usable from `from` to `to`, of `role` when one is given. Never empty: a seeded operator of every role exists. */
  candidates(from: number, to: number, role?: OperatorRole): OperatorEntry[] {
    const found = this.entries.filter((entry) => this.usable(entry, from, to) && (role === undefined || this.roleAt(entry, from) === role));
    if (found.length > 0) return found;
    return this.entries.filter((entry) => entry.seeded && (role === undefined || entry.operator.role === role));
  }

  byId(id: string): OperatorEntry {
    const found = this.entries.find((entry) => entry.operator.id === id);
    if (found === undefined) throw new RangeError(`no operator ${id} in the directory.`);
    return found;
  }
}

// ── Devices and tokens, as the other parts see them ────────────────────────────────────────────

export interface DevicePlan {
  readonly id: string;
  readonly state: DeviceStateValue;
  readonly pairedAt: number;
  /** When the device was revoked or unpaired; `null` while it is paired. */
  readonly endedAt: number | null;
}

/** A token reuse: the family is revoked and the biometric sessions of that device and operator end. */
interface ReuseIncident {
  readonly deviceId: string;
  readonly operatorId: string;
  readonly at: number;
}

/** A biometric sign-in that is still open at `now`: the use of a token of a live family. */
interface OpenBiometricSignIn {
  readonly deviceId: string;
  readonly operatorId: string;
  readonly at: number;
}

export interface IdentityRows {
  readonly directory: OperatorDirectory;
  readonly devices: readonly DevicePlan[];
  /** The fixture's new operators, as full rows. */
  readonly operators: OperatorRow[];
  /** `last_sign_in_at` of the seeded operators that have a fixture session. */
  readonly operatorSignIns: Array<{ readonly id: string; readonly lastSignInAt: number }>;
  readonly operatorCredentials: NewOperatorCredentialRow[];
  readonly pairingCodes: PairingCodeRow[];
  readonly pairedDevices: PairedDeviceRow[];
  readonly deviceCredentials: DeviceCredentialRow[];
  readonly biometricTokens: BiometricTokenRow[];
  readonly authSessions: AuthSessionRow[];
}

function operatorNumber(id: string): number {
  return Number(id.replace(/^OPR-/, ''));
}

function buildDirectory(world: World): OperatorDirectory {
  const seeded: OperatorEntry[] = world.base.slices.operators.map((operator) => ({
    operator,
    seeded: true,
    // A seeded account exists for the whole history the fixture describes.
    createdAt: world.worldStart,
    changes: [],
  }));
  const first = Math.max(0, ...seeded.map((entry) => operatorNumber(entry.operator.id))) + 1;
  const createdAt = world.dayAt(62, 8);
  const fixture: OperatorEntry[] = FIXTURE_OPERATORS.map((spec, index) => {
    const number = padded(first + index, 3);
    const name = spec.unicode === true ? `Fixture Operator ${number} (${UNICODE_SAMPLE})` : `Fixture Operator ${number}`;
    return {
      operator: {
        id: `OPR-${number}`,
        username: `fixture.operator.${number}`,
        rank: null,
        name,
        displayName: name,
        initials: `F${number}`,
        role: spec.role,
      },
      seeded: false,
      createdAt,
      changes: spec.changes
        .map((change) => ({ at: world.dayAt(change.daysAgo, 9, 30), kind: change.kind, ...(change.previousRole === undefined ? {} : { previousRole: change.previousRole }) }))
        .sort((a, b) => a.at - b.at),
    };
  });
  return new OperatorDirectory([...seeded, ...fixture]);
}

/** A supervisor who can act from `from` to `to`: the one who administers accounts and pairing. */
function supervisorAt(directory: OperatorDirectory, rng: FixtureRng, from: number, to = from): OperatorEntry {
  return rng.pick(directory.candidates(from, to, OperatorRole.SUPERVISOR));
}

// ── Pairing codes and devices ──────────────────────────────────────────────────────────────────

/** How many closed codes of each state the fixture issues; one more code is ACTIVE at `now`. */
const CODE_STATES: ReadonlyArray<readonly [CodeStateValue, number]> = [
  ['REDEEMED', 40],
  ['CANCELLED', 6],
  ['EXPIRED', 6],
  ['EXHAUSTED', 7],
];
/** The first devices stay paired: tokens older than their lifetime need a device that is that old. */
const EARLY_PAIRED_DEVICES = 6;
const DEVICE_STATES: ReadonlyArray<readonly [DeviceStateValue, number]> = [
  ['PAIRED', 20],
  ['REVOKED', 10],
  ['UNPAIRED', 10],
];
/** Devices whose credential rotation is pending (a `next_hash`), and whose rotation completed. */
const ROTATION_PENDING = 8;
const ROTATION_COMPLETED = 6;

/**
 * How many open sessions end with what ends them. The audit row of the change says this number
 * (`details.sessionsEnded`), and the part that builds the sessions ends exactly that many.
 */
const SESSIONS_ENDED_BY_DISABLE = 3;
const SESSIONS_ENDED_BY_REVOKE = 2;
const SESSIONS_ENDED_BY_REUSE = 2;
/** The first six unpaired devices had two open sessions, the others one. */
const sessionsEndedByUnpair = (position: number): number => (position < 6 ? 2 : 1);

function expand<T>(counts: ReadonlyArray<readonly [T, number]>): T[] {
  return counts.flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

export function buildIdentity(world: World): IdentityRows {
  const { now, seed } = world;
  const directory = buildDirectory(world);

  // Operators: the row builder of the mapping module, then the server-native columns.
  const operators: OperatorRow[] = directory.entries
    .filter((entry) => !entry.seeded)
    .map((entry) => {
      const lastChange = entry.changes[entry.changes.length - 1];
      const roleChange = [...entry.changes].reverse().find((change) => change.kind === 'ROLE');
      return {
        ...operatorToRow(entry.operator, { at: entry.createdAt, seededAt: world.base.seededAt, lastResetAt: null }),
        enabled: directory.enabledAt(entry, now),
        roleChangedAt: roleChange?.at ?? null,
        updatedAt: lastChange?.at ?? entry.createdAt,
      };
    });

  // BF-4: random bytes that are the Argon2id hash of no password, with the server's parameters.
  const credentialRng = world.rng('operator-credentials');
  const operatorCredentials: NewOperatorCredentialRow[] = operators.map((operator) => ({
    operatorId: operator.id,
    algorithm: PASSWORD_HASH_ALGORITHM,
    memoryKib: PASSWORD_HASH_PARAMETERS.memoryKib,
    passes: PASSWORD_HASH_PARAMETERS.passes,
    parallelism: PASSWORD_HASH_PARAMETERS.parallelism,
    salt: credentialRng.bytes(PASSWORD_SALT_BYTES),
    hash: credentialRng.bytes(PASSWORD_HASH_BYTES),
    hashedAt: operator.createdAt,
  }));

  // Account administration, by a supervisor who could act then.
  const adminRng = world.rng('administration');
  let changeNo = 0;
  for (const entry of directory.entries) {
    for (const change of entry.changes) {
      const actor = supervisorAt(directory, adminRng, change.at).operator.id;
      const target = entry.operator.id;
      changeNo += 1;
      // `reason` is optional (spec §13.1): two changes in four carry one, the first with text outside
      // ASCII. So each of the three types is there with a reason, and two of them without one too.
      const reason: Readonly<Record<string, string>> =
        changeNo % 4 >= 2 ? {} : { reason: changeNo === 1 ? `Fixture reason: account review ${changeNo} (${UNICODE_SAMPLE})` : `Fixture reason: account review ${changeNo}` };
      if (change.kind === 'ROLE') {
        world.record(change.at, {
          audit: {
            type: 'ROLE_CHANGED',
            message: `Role of ${target} changed to ${entry.operator.role}`,
            actorId: actor,
            details: { targetOperatorId: target, from: change.previousRole ?? entry.operator.role, to: entry.operator.role, ...reason },
          },
        });
      } else {
        const disabled = change.kind === 'DISABLED';
        world.record(change.at, {
          audit: {
            type: disabled ? 'USER_DISABLED' : 'USER_ENABLED',
            message: `Operator ${target} ${disabled ? 'disabled' : 'enabled'}`,
            severity: disabled ? 'WARNING' : 'INFO',
            actorId: actor,
            details: disabled ? { targetOperatorId: target, sessionsEnded: SESSIONS_ENDED_BY_DISABLE, ...reason } : { targetOperatorId: target, ...reason },
          },
        });
      }
    }
  }

  // Pairing codes in the order they were issued, and the device each redeemed code paired.
  const pairingRng = world.rng('pairing');
  const closedStates = expand(CODE_STATES);
  // The first codes are redeemed, so that the first devices are old enough for expired tokens.
  const redeemedFirst = closedStates.splice(0, EARLY_PAIRED_DEVICES + 4);
  const stateOrder: CodeStateValue[] = [...redeemedFirst, ...pairingRng.shuffle(closedStates)];
  const deviceStates = expand(DEVICE_STATES);
  const earlyDevices = deviceStates.splice(0, EARLY_PAIRED_DEVICES);
  const deviceOrder: DeviceStateValue[] = [...earlyDevices, ...pairingRng.shuffle(deviceStates)];

  const firstIssue = world.dayAt(60, 9);
  const lastIssue = now - 26 * HOUR_MS;
  const issueStep = Math.floor((lastIssue - firstIssue) / (stateOrder.length - 1));

  const pairingCodes: PairingCodeRow[] = [];
  const pairedDevices: PairedDeviceRow[] = [];
  const deviceCredentials: DeviceCredentialRow[] = [];
  const devices: DevicePlan[] = [];

  const issueCode = (state: CodeStateValue, issuedAt: number): void => {
    const number = world.counters.pairingCode;
    world.counters.pairingCode += 1;
    const id = `PCD-${padded(number, 6)}`;
    const expiresAt = issuedAt + PAIRING_CODE_TTL_MS;
    const issuer = supervisorAt(directory, pairingRng, issuedAt, expiresAt + EXPIRY_SWEEP_MS).operator.id;
    let failedAttempts = 0;
    let closedAt: number | null = null;
    let closedBy: string | null = null;
    if (state === 'REDEEMED') {
      failedAttempts = pairingRng.pick([0, 0, 0, 1, 2]);
      closedAt = issuedAt + pairingRng.int(15, 240) * SECOND_MS;
    } else if (state === 'CANCELLED') {
      failedAttempts = pairingRng.int(0, 2);
      closedAt = issuedAt + pairingRng.int(10, 200) * SECOND_MS;
      closedBy = issuer;
    } else if (state === 'EXPIRED') {
      failedAttempts = pairingRng.int(0, 4);
      closedAt = expiresAt + pairingRng.int(0, EXPIRY_SWEEP_MS);
    } else if (state === 'EXHAUSTED') {
      failedAttempts = 5;
      closedAt = issuedAt + pairingRng.int(30, 280) * SECOND_MS;
    } else {
      failedAttempts = 1;
    }
    pairingCodes.push({
      id,
      codeHash: fakeSecretHash('pairing-code', number, seed),
      state,
      issuedByOperatorId: issuer,
      issuedAt,
      expiresAt,
      failedAttempts,
      closedAt,
      closedByOperatorId: closedBy,
    });

    world.record(issuedAt, {
      audit: {
        type: 'PAIRING_CODE_ISSUED',
        message: `Pairing code ${id} issued`,
        actorId: issuer,
        details: { codeId: id, expiresAt },
      },
    });
    // Each failed redeem, spread over the time before the code closed (or before `now`). The
    // details are the pairing module's: the failures left before redeeming locks (three in a
    // row lock it for 60 s), never anything about the code. The lock itself is not replayed.
    const lastAttempt = closedAt ?? now;
    let lastFailedAt = issuedAt;
    for (let attempt = 1; attempt <= failedAttempts; attempt += 1) {
      const at = issuedAt + Math.floor(((lastAttempt - issuedAt) * attempt) / (failedAttempts + 1));
      const attemptsRemaining = Math.max(0, PAIRING_MAX_FAILURES - attempt);
      const locks = attemptsRemaining === 0;
      lastFailedAt = at;
      world.record(at, {
        audit: {
          type: 'PAIRING_FAILED',
          message: locks ? 'Pairing failed; locked for 60 s' : 'Pairing failed: invalid code',
          severity: 'WARNING',
          details: { attemptsRemaining, lockedUntil: locks ? at + PAIRING_LOCKOUT_MS : null },
        },
        event: { type: 'PAIRING_FAILED', message: locks ? 'Pairing failed — locked for 60 s' : 'Pairing failed', severity: 'WARNING', params: { attemptsRemaining } },
      });
    }
    if (closedAt === null) return;
    if (state === 'EXHAUSTED') {
      // A redeem that arrived while redeeming was locked by the failures before it.
      const lockedUntil = lastFailedAt + PAIRING_LOCKOUT_MS;
      world.record(closedAt, {
        audit: {
          type: 'PAIRING_LOCKED',
          message: 'Pairing rejected: locked after repeated failures',
          severity: 'WARNING',
          details: { retryInMs: Math.max(0, lockedUntil - closedAt), lockedUntil },
        },
      });
    }
    if (state !== 'REDEEMED') {
      world.record(closedAt, {
        audit: {
          type: 'PAIRING_CODE_CLOSED',
          message:
            state === 'EXHAUSTED' ? `Pairing code ${id} closed after ${failedAttempts} failed attempts` : `Pairing code ${id} ${state === 'CANCELLED' ? 'cancelled' : 'expired'}`,
          // A code that was closed by failed attempts deserves a look.
          ...(state === 'EXHAUSTED' ? { severity: 'WARNING' as const } : {}),
          actorId: closedBy,
          // CANCELLED, EXPIRED or EXHAUSTED: the three ways a code closes without pairing a device.
          details: { codeId: id, reason: state },
        },
      });
      return;
    }

    // A redeemed code pairs one device.
    const deviceNumber = world.counters.device;
    world.counters.device += 1;
    const deviceId = `DEV-${padded(deviceNumber, 4)}`;
    const deviceState = deviceOrder[devices.length] ?? 'PAIRED';
    const pairedAt = closedAt;
    let endedAt: number | null = null;
    if (deviceState !== 'PAIRED') {
      // At least two hours after the pairing, at most fifteen days, and an hour before `now`.
      const latest = now - HOUR_MS;
      endedAt = Math.min(latest, pairedAt + pairingRng.int(2 * HOUR_MS, 15 * DAY_MS));
    }
    const lastSeenAt =
      endedAt === null ? pairingRng.int(Math.max(pairedAt, now - 2 * DAY_MS), now) : pairingRng.int(Math.max(pairedAt, endedAt - HOUR_MS), endedAt);
    const revoker = deviceState === 'REVOKED' && endedAt !== null ? supervisorAt(directory, pairingRng, endedAt).operator.id : null;
    const label = padded(deviceNumber, 3);
    const unicodeName = devices.length % 13 === 5;
    // What the supervisor typed for the revoke. The first revoked device, and every third after it, carries text outside ASCII.
    const revokeReason =
      deviceState !== 'REVOKED'
        ? null
        : devices.filter((device) => device.state === 'REVOKED').length % 3 === 0
          ? `Fixture reason: device ${label} retired (${UNICODE_SAMPLE})`
          : `Fixture reason: device ${label} retired from the interview room`;
    const unpairedBefore = devices.filter((device) => device.state === 'UNPAIRED').length;
    pairedDevices.push({
      id: deviceId,
      name: unicodeName ? `Fixture Tablet ${label} 取調室 \u{1f6f0}` : `Fixture Tablet ${label}`,
      platform: 'android',
      appVersion: devices.length % 4 === 0 ? '0.1.0' : '0.2.0',
      state: deviceState,
      pairedAt,
      pairedWithCodeId: id,
      lastSeenAt,
      revokedAt: deviceState === 'REVOKED' ? endedAt : null,
      revokedByOperatorId: revoker,
      revokeReason,
      unpairedAt: deviceState === 'UNPAIRED' ? endedAt : null,
      updatedAt: Math.max(lastSeenAt, endedAt ?? pairedAt),
    });
    devices.push({ id: deviceId, state: deviceState, pairedAt, endedAt });

    world.record(pairedAt, {
      audit: {
        type: 'PAIRING_SUCCESS',
        message: `Device ${deviceId} paired with ${world.base.slices.device.id}`,
        deviceId,
        details: { coreDeviceId: world.base.slices.device.id, certificateFingerprint: world.base.certificateFingerprint, codeId: id },
      },
      event: { type: 'PAIRED', message: `Device paired · ${world.base.slices.device.name}`, severity: 'SUCCESS', deviceId },
    });
    if (deviceState === 'REVOKED' && endedAt !== null && revokeReason !== null) {
      world.record(endedAt, {
        audit: {
          type: 'DEVICE_REVOKED',
          message: `Device ${deviceId} revoked`,
          severity: 'WARNING',
          actorId: revoker,
          deviceId,
          details: { reason: revokeReason, sessionsEnded: SESSIONS_ENDED_BY_REVOKE },
        },
        event: { type: 'UNPAIRED', message: 'Device revoked', severity: 'WARNING', deviceId },
      });
    }
    if (deviceState === 'UNPAIRED' && endedAt !== null) {
      world.record(endedAt, {
        audit: { type: 'UNPAIRED', message: `Device ${deviceId} unpaired`, deviceId, details: { sessionsEnded: sessionsEndedByUnpair(unpairedBefore) } },
        event: { type: 'UNPAIRED', message: 'Device unpaired', severity: 'WARNING', deviceId },
      });
    }
  };

  stateOrder.forEach((state, index) => issueCode(state, firstIssue + index * issueStep + pairingRng.int(0, 30 * MINUTE_MS)));
  // At most one code is ACTIVE: issued a minute ago, four minutes of its life left.
  issueCode('ACTIVE', now - MINUTE_MS);

  // Device credentials: one per device; some rotations pending, some completed.
  const pairedNow = devices.filter((device) => device.endedAt === null);
  devices.forEach((device, index) => {
    const position = pairedNow.indexOf(device);
    const pending = position >= 0 && position < ROTATION_PENDING;
    const completed = position >= ROTATION_PENDING && position < ROTATION_PENDING + ROTATION_COMPLETED;
    const number = index + 1;
    const rotatedAt = pending || completed ? pairingRng.int(Math.max(device.pairedAt + HOUR_MS, now - 10 * DAY_MS), now - 10 * MINUTE_MS) : null;
    deviceCredentials.push({
      deviceId: device.id,
      currentHash: fakeSecretHash('device-credential', number, seed),
      nextHash: pending ? fakeSecretHash('device-credential-next', number, seed) : null,
      rotatedAt,
    });
    if (rotatedAt !== null) {
      world.record(rotatedAt, {
        audit: {
          type: 'DEVICE_CREDENTIAL_ROTATED',
          message: `Device ${device.id} asked for a new credential`,
          // No client of this release asks for a rotation, so the pairing module writes the row at WARNING.
          severity: 'WARNING',
          deviceId: device.id,
          // The row carries the device (spec §13.1); the writer's list allows no other detail.
          details: {},
        },
      });
    }
  });

  // ── Biometric tokens ─────────────────────────────────────────────────────────────────────────
  const tokenRng = world.rng('biometric-tokens');
  const biometricTokens: BiometricTokenRow[] = [];
  const reuseIncidents: ReuseIncident[] = [];
  const openBiometric: OpenBiometricSignIn[] = [];
  const usedPairs = new Set<string>();
  let tokenNumber = 0;

  const addToken = (fields: Omit<BiometricTokenRow, 'id' | 'tokenHash' | 'expiresAt'>): void => {
    tokenNumber += 1;
    biometricTokens.push({
      id: tokenRng.uuid(),
      tokenHash: fakeSecretHash('biometric-token', tokenNumber, seed),
      expiresAt: fields.issuedAt + BIOMETRIC_TOKEN_TTL_MS,
      ...fields,
    });
  };
  const enrolment = (at: number, deviceId: string, operatorId: string, enabled: boolean): void => {
    world.record(at, {
      audit: {
        type: 'BIOMETRIC_ENROLLMENT_CHANGED',
        message: enabled ? `Biometric sign-in turned on (${deviceId})` : `Biometric sign-in turned off (${deviceId})`,
        actorId: operatorId,
        deviceId,
        details: { enabled, deviceId },
      },
    });
  };
  /** A device and operator that have no token yet, the device paired by `latestPairing`. */
  const freshPair = (pool: readonly DevicePlan[], latestPairing: number, operatorsFrom: number): { device: DevicePlan; operatorId: string } => {
    const eligible = pool.filter((device) => device.pairedAt <= latestPairing);
    for (const device of tokenRng.shuffle(eligible)) {
      for (const entry of tokenRng.shuffle(directory.candidates(operatorsFrom, now))) {
        const key = `${device.id}|${entry.operator.id}`;
        if (!usedPairs.has(key)) {
          usedPairs.add(key);
          return { device, operatorId: entry.operator.id };
        }
      }
    }
    throw new RangeError('the fixture ran out of device and operator pairs for biometric tokens.');
  };

  // A. Twenty live families on paired devices: zero to three used tokens, then the live one.
  const usesPerFamily = [3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0];
  usesPerFamily.forEach((uses, familyIndex) => {
    const { device, operatorId } = freshPair(pairedNow, now - 2 * DAY_MS, now - 25 * DAY_MS);
    const familyId = tokenRng.uuid();
    // The five first families were used for a sign-in that is still open.
    const openNow = familyIndex < 5;
    const earliest = device.pairedAt + HOUR_MS;
    const drawn = openNow ? now - tokenRng.int(20 * MINUTE_MS, 6 * HOUR_MS) : now - tokenRng.int(8 * HOUR_MS, 12 * DAY_MS);
    // Never before the device was paired: every use leaves at least an hour to the one before it.
    const lastUse = Math.max(drawn, earliest + (uses + 1) * HOUR_MS);
    const start = Math.max(earliest, lastUse - (uses + 1) * tokenRng.int(DAY_MS, 3 * DAY_MS));
    const enrolledAt = uses === 0 ? Math.max(earliest, now - tokenRng.int(DAY_MS, 12 * DAY_MS)) : start;
    enrolment(enrolledAt, device.id, operatorId, true);
    let issuedAt = enrolledAt;
    for (let use = 1; use <= uses; use += 1) {
      const usedAt = use === uses ? lastUse : issuedAt + Math.floor((lastUse - issuedAt) / (uses - use + 1));
      addToken({ familyId, deviceId: device.id, operatorId, issuedAt, usedAt, revokedAt: null, revokeReason: null });
      issuedAt = usedAt;
    }
    addToken({ familyId, deviceId: device.id, operatorId, issuedAt, usedAt: null, revokedAt: null, revokeReason: null });
    if (openNow && uses > 0) openBiometric.push({ deviceId: device.id, operatorId, at: lastUse });
  });

  // B. Revoked tokens, every reason.
  const revoke = (device: DevicePlan, operatorId: string, issuedAt: number, revokedAt: number, reason: BioRevokeReason): void => {
    addToken({ familyId: tokenRng.uuid(), deviceId: device.id, operatorId, issuedAt, usedAt: null, revokedAt, revokeReason: reason });
  };
  // Token reuse: the used token and its successor are revoked, and the sessions end (AT-C4).
  for (let incident = 0; incident < 6; incident += 1) {
    const { device, operatorId } = freshPair(pairedNow, now - 6 * DAY_MS, now - 25 * DAY_MS);
    const familyId = tokenRng.uuid();
    const at = now - tokenRng.int(DAY_MS, 5 * DAY_MS);
    const issuedAt = Math.max(device.pairedAt + HOUR_MS, at - tokenRng.int(2 * DAY_MS, 6 * DAY_MS));
    const usedAt = at - tokenRng.int(3 * HOUR_MS, 20 * HOUR_MS);
    enrolment(issuedAt, device.id, operatorId, true);
    addToken({ familyId, deviceId: device.id, operatorId, issuedAt, usedAt: Math.max(issuedAt, usedAt), revokedAt: at, revokeReason: 'TOKEN_REUSE' });
    addToken({ familyId, deviceId: device.id, operatorId, issuedAt: Math.max(issuedAt, usedAt), usedAt: null, revokedAt: at, revokeReason: 'TOKEN_REUSE' });
    reuseIncidents.push({ deviceId: device.id, operatorId, at });
    world.record(at, {
      audit: {
        type: 'AUTH_FAILED',
        message: 'Sign-in failed: invalid credentials',
        severity: 'WARNING',
        // The biometric module's refusal of a reused token: a failed attempt that names the operator
        // of the token that was used before, with why it was refused and what it ended.
        actorId: operatorId,
        deviceId: device.id,
        details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: AUTH_MAX_FAILURES - 1, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded: SESSIONS_ENDED_BY_REUSE },
      },
      event: { type: 'AUTH_FAILED', message: 'Sign-in failed', severity: 'WARNING', deviceId: device.id, params: { attemptsRemaining: AUTH_MAX_FAILURES - 1 } },
    });
  }
  // The user switched biometric sign-in off, or enrolled again.
  for (const reason of ['DISABLED', 'DISABLED', 'REENROLLED', 'REENROLLED'] as const) {
    const { device, operatorId } = freshPair(pairedNow, now - 8 * DAY_MS, now - 25 * DAY_MS);
    const revokedAt = now - tokenRng.int(DAY_MS, 6 * DAY_MS);
    const issuedAt = Math.max(device.pairedAt + HOUR_MS, revokedAt - tokenRng.int(DAY_MS, 6 * DAY_MS));
    enrolment(issuedAt, device.id, operatorId, true);
    revoke(device, operatorId, issuedAt, Math.max(issuedAt, revokedAt), reason);
    enrolment(Math.max(issuedAt, revokedAt), device.id, operatorId, reason === 'REENROLLED');
  }
  // The device was revoked or unpaired, or the operator was disabled.
  const ended = (state: DeviceStateValue): DevicePlan[] => devices.filter((device) => device.state === state && device.endedAt !== null);
  const byEnd: ReadonlyArray<readonly [DevicePlan[], BioRevokeReason, number]> = [
    [ended('REVOKED'), 'DEVICE_REVOKED', 3],
    [ended('UNPAIRED'), 'DEVICE_UNPAIRED', 2],
  ];
  for (const [pool, reason, count] of byEnd) {
    pool.slice(0, count).forEach((device) => {
      const endedAt = device.endedAt ?? now;
      const operatorId = tokenRng.pick(directory.candidates(device.pairedAt, endedAt)).operator.id;
      usedPairs.add(`${device.id}|${operatorId}`);
      const issuedAt = device.pairedAt + Math.floor((endedAt - device.pairedAt) / 2);
      enrolment(issuedAt, device.id, operatorId, true);
      revoke(device, operatorId, issuedAt, endedAt, reason);
    });
  }
  const disabledNow = directory.entries.filter((entry) => !directory.enabledAt(entry, now));
  disabledNow.slice(0, 2).forEach((entry) => {
    const disabledAt = [...entry.changes].reverse().find((change) => change.kind === 'DISABLED')?.at ?? now;
    const device = tokenRng.pick(devices.filter((candidate) => candidate.pairedAt + HOUR_MS < disabledAt && (candidate.endedAt === null || candidate.endedAt > disabledAt)));
    usedPairs.add(`${device.id}|${entry.operator.id}`);
    const issuedAt = Math.max(device.pairedAt + HOUR_MS, disabledAt - tokenRng.int(DAY_MS, 4 * DAY_MS));
    enrolment(issuedAt, device.id, entry.operator.id, true);
    revoke(device, entry.operator.id, issuedAt, disabledAt, 'USER_DISABLED');
  });

  // C. Ten tokens that nobody used and that are past their lifetime.
  for (let index = 0; index < 10; index += 1) {
    const issuedLatest = now - BIOMETRIC_TOKEN_TTL_MS - 2 * HOUR_MS;
    const { device, operatorId } = freshPair(pairedNow, issuedLatest - HOUR_MS, world.worldStart + DAY_MS);
    const issuedAt = tokenRng.int(device.pairedAt + HOUR_MS, issuedLatest);
    enrolment(issuedAt, device.id, operatorId, true);
    addToken({ familyId: tokenRng.uuid(), deviceId: device.id, operatorId, issuedAt, usedAt: null, revokedAt: null, revokeReason: null });
  }

  // ── Auth sessions ────────────────────────────────────────────────────────────────────────────
  const sessionRng = world.rng('auth-sessions');
  interface Draft {
    readonly operatorId: string;
    readonly deviceId: string | null;
    readonly method: AuthMethodValue;
    readonly issuedAt: number;
    readonly lastSeenAt: number;
    readonly endedAt: number | null;
    readonly endReason: SessionEndReason | null;
  }
  const drafts: Draft[] = [];
  const firstPairing = Math.min(...devices.map((device) => device.pairedAt));
  const historyStart = world.worldStart + DAY_MS;
  const historyEnd = now - SESSION_ABSOLUTE_MS - HOUR_MS;

  /** A device that is paired from `from` to `to`. */
  const deviceDuring = (from: number, to: number): DevicePlan =>
    sessionRng.pick(devices.filter((device) => device.pairedAt + MINUTE_MS <= from && (device.endedAt === null || device.endedAt > to)));

  const general = (reason: 'SIGNED_OUT' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' | 'ROTATED', onDevice: boolean, method: AuthMethodValue): void => {
    const issuedAt = sessionRng.int(onDevice ? Math.max(historyStart, firstPairing + HOUR_MS) : historyStart, historyEnd);
    const absolute = issuedAt + SESSION_ABSOLUTE_MS;
    let lastSeenAt: number;
    let endedAt: number;
    if (reason === 'IDLE_EXPIRED') {
      lastSeenAt = issuedAt + sessionRng.int(5 * MINUTE_MS, 2 * HOUR_MS);
      endedAt = lastSeenAt + AUTH_IDLE_TIMEOUT_MS + sessionRng.int(0, EXPIRY_SWEEP_MS);
    } else if (reason === 'ABSOLUTE_EXPIRED') {
      endedAt = absolute + sessionRng.int(0, EXPIRY_SWEEP_MS);
      lastSeenAt = absolute - sessionRng.int(0, 10 * MINUTE_MS);
    } else {
      endedAt = issuedAt + sessionRng.int(5 * MINUTE_MS, reason === 'ROTATED' ? 3 * HOUR_MS : 4 * HOUR_MS);
      lastSeenAt = endedAt - sessionRng.int(0, MINUTE_MS);
    }
    const device = onDevice ? deviceDuring(issuedAt, endedAt) : null;
    const operatorId = sessionRng.pick(directory.candidates(issuedAt, endedAt)).operator.id;
    drafts.push({ operatorId, deviceId: device?.id ?? null, method, issuedAt, lastSeenAt, endedAt, endReason: reason });
  };
  const repeat = (count: number, add: () => void): void => {
    for (let index = 0; index < count; index += 1) add();
  };
  repeat(70, () => general('SIGNED_OUT', false, 'PASSWORD'));
  repeat(16, () => general('SIGNED_OUT', true, 'PASSWORD'));
  repeat(10, () => general('SIGNED_OUT', true, 'BIOMETRIC'));
  repeat(45, () => general('IDLE_EXPIRED', false, 'PASSWORD'));
  repeat(10, () => general('IDLE_EXPIRED', true, 'PASSWORD'));
  repeat(5, () => general('IDLE_EXPIRED', true, 'BIOMETRIC'));
  repeat(18, () => general('ABSOLUTE_EXPIRED', false, 'PASSWORD'));
  repeat(6, () => general('ABSOLUTE_EXPIRED', true, 'PASSWORD'));
  repeat(16, () => general('ROTATED', false, 'PASSWORD'));
  repeat(8, () => general('ROTATED', true, 'PASSWORD'));

  /** A session that was cut short at `endedAt`, issued at most `span` earlier. */
  const cutShort = (operatorId: string, deviceId: string | null, method: AuthMethodValue, earliest: number, endedAt: number, reason: SessionEndReason): void => {
    const issuedAt = Math.max(earliest, endedAt - sessionRng.int(10 * MINUTE_MS, 5 * HOUR_MS));
    drafts.push({ operatorId, deviceId, method, issuedAt, lastSeenAt: sessionRng.int(issuedAt, endedAt), endedAt, endReason: reason });
  };

  // A disabled operator: three sessions end at each disable (SESSIONS_ENDED_BY_DISABLE), one of them on a device.
  for (const entry of directory.entries) {
    for (const change of entry.changes.filter((candidate) => candidate.kind === 'DISABLED')) {
      const earliest = Math.max(entry.createdAt, change.at - 6 * HOUR_MS);
      cutShort(entry.operator.id, null, 'PASSWORD', earliest, change.at, 'USER_DISABLED');
      cutShort(entry.operator.id, null, 'PASSWORD', earliest, change.at, 'USER_DISABLED');
      const onDevice = devices.filter((device) => device.pairedAt + HOUR_MS < change.at - 6 * HOUR_MS && (device.endedAt === null || device.endedAt > change.at));
      const device = onDevice.length > 0 ? sessionRng.pick(onDevice) : null;
      cutShort(entry.operator.id, device?.id ?? null, 'PASSWORD', earliest, change.at, 'USER_DISABLED');
    }
  }
  // A revoked device: two sessions end with it. An unpaired device: two, or one.
  ended('REVOKED').forEach((device) => {
    const endedAt = device.endedAt ?? now;
    repeat(SESSIONS_ENDED_BY_REVOKE, () => cutShort(sessionRng.pick(directory.candidates(device.pairedAt, endedAt)).operator.id, device.id, 'PASSWORD', device.pairedAt + MINUTE_MS, endedAt, 'DEVICE_REVOKED'));
  });
  ended('UNPAIRED').forEach((device, index) => {
    const endedAt = device.endedAt ?? now;
    repeat(sessionsEndedByUnpair(index), () =>
      cutShort(sessionRng.pick(directory.candidates(device.pairedAt, endedAt)).operator.id, device.id, 'PASSWORD', device.pairedAt + MINUTE_MS, endedAt, 'DEVICE_UNPAIRED'),
    );
  });
  // A token reuse ends the two biometric sessions of that device and operator.
  for (const incident of reuseIncidents) {
    const paired = devices.find((device) => device.id === incident.deviceId)?.pairedAt ?? historyStart;
    repeat(SESSIONS_ENDED_BY_REUSE, () => cutShort(incident.operatorId, incident.deviceId, 'BIOMETRIC', paired + MINUTE_MS, incident.at, 'TOKEN_REUSE'));
  }

  // Open sessions: issued within the absolute limit, seen within the idle limit.
  const open = (operatorId: string, deviceId: string | null, method: AuthMethodValue, issuedAt: number): void => {
    const lastSeenAt = sessionRng.int(Math.max(issuedAt, now - AUTH_IDLE_TIMEOUT_MS + 3 * MINUTE_MS), now);
    drafts.push({ operatorId, deviceId, method, issuedAt, lastSeenAt, endedAt: null, endReason: null });
  };
  const openIssue = (): number => now - sessionRng.int(12 * MINUTE_MS, SESSION_ABSOLUTE_MS - HOUR_MS);
  repeat(24, () => {
    const issuedAt = openIssue();
    open(sessionRng.pick(directory.candidates(issuedAt, now)).operator.id, null, 'PASSWORD', issuedAt);
  });
  repeat(7, () => {
    const issuedAt = openIssue();
    const device = sessionRng.pick(pairedNow.filter((candidate) => candidate.pairedAt + MINUTE_MS <= issuedAt));
    open(sessionRng.pick(directory.candidates(issuedAt, now)).operator.id, device.id, 'PASSWORD', issuedAt);
  });
  for (const signIn of openBiometric) open(signIn.operatorId, signIn.deviceId, 'BIOMETRIC', signIn.at);

  // In the order they were issued; the identifier and the token hash follow that order.
  drafts.sort((a, b) => a.issuedAt - b.issuedAt || (a.operatorId < b.operatorId ? -1 : a.operatorId > b.operatorId ? 1 : 0));
  const authSessions: AuthSessionRow[] = drafts.map((draft, index) => ({
    id: sessionRng.uuid(),
    tokenHash: fakeSecretHash('session-token', index + 1, seed),
    operatorId: draft.operatorId,
    deviceId: draft.deviceId,
    method: draft.method,
    issuedAt: draft.issuedAt,
    lastSeenAt: draft.lastSeenAt,
    absoluteExpiresAt: draft.issuedAt + SESSION_ABSOLUTE_MS,
    endedAt: draft.endedAt,
    endReason: draft.endReason,
  }));

  // A device was seen at least as late as its sessions were.
  const seenOnDevice = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.deviceId !== null) seenOnDevice.set(draft.deviceId, Math.max(seenOnDevice.get(draft.deviceId) ?? 0, draft.lastSeenAt));
  }
  const devicesSeen = pairedDevices.map((device) => {
    const lastSeenAt = Math.max(device.lastSeenAt, seenOnDevice.get(device.id) ?? 0);
    return { ...device, lastSeenAt, updatedAt: Math.max(device.updatedAt, lastSeenAt) };
  });

  const lastSignIn = new Map<string, number>();
  for (const draft of drafts) {
    const name = directory.byId(draft.operatorId).operator.displayName;
    lastSignIn.set(draft.operatorId, Math.max(lastSignIn.get(draft.operatorId) ?? 0, draft.issuedAt));
    world.record(draft.issuedAt, {
      audit: {
        type: 'AUTH_SUCCESS',
        message: `Operator signed in (${name}) via ${draft.method === 'BIOMETRIC' ? 'biometric' : 'password'}`,
        actorId: draft.operatorId,
        deviceId: draft.deviceId,
        details: { method: draft.method },
      },
      event: { type: 'AUTH_LOGIN', message: `${name} signed in`, severity: 'SUCCESS', deviceId: draft.deviceId, params: { operatorId: draft.operatorId, method: draft.method } },
    });
    if (draft.endedAt === null) continue;
    if (draft.endReason === 'SIGNED_OUT') {
      world.record(draft.endedAt, {
        audit: { type: 'AUTH_SIGNED_OUT', message: 'Operator signed out', actorId: draft.operatorId, deviceId: draft.deviceId, details: { reason: 'USER' } },
        event: { type: 'AUTH_LOGOUT', message: 'Operator signed out', deviceId: draft.deviceId, params: { operatorId: draft.operatorId, reason: 'USER' } },
      });
    } else if (draft.endReason === 'IDLE_EXPIRED' || draft.endReason === 'ABSOLUTE_EXPIRED') {
      const idle = draft.endReason === 'IDLE_EXPIRED';
      world.record(draft.endedAt, {
        audit: {
          type: 'AUTH_EXPIRED',
          message: idle ? 'Operator session expired after 15 min idle' : 'Operator session expired 8 h after sign-in',
          actorId: draft.operatorId,
          deviceId: draft.deviceId,
          details: { reason: idle ? 'IDLE' : 'ABSOLUTE' },
        },
        event: { type: 'AUTH_EXPIRED', message: 'Session expired — sign in again', severity: 'WARNING', deviceId: draft.deviceId, params: { operatorId: draft.operatorId } },
      });
    }
  }

  // Refused sign-ins and lockouts: no actor (a typed name is never stored), no device. The
  // details are the identity module's: the failures left before the console locks (five lock
  // it for 60 s), and for an attempt during a lock how long it still lasts.
  const refusedRng = world.rng('refused-sign-ins');
  for (let index = 0; index < 66; index += 1) {
    const at = refusedRng.int(historyStart, now - MINUTE_MS);
    const position = index % 11;
    const locked = position === 10;
    const attemptsRemaining = AUTH_MAX_FAILURES - 1 - (position % AUTH_MAX_FAILURES);
    const retryInMs = AUTH_LOCKOUT_MS - ((index * 7) % 50) * SECOND_MS;
    // The failure that uses the last attempt locks the console.
    const locks = attemptsRemaining === 0;
    world.record(at, {
      audit: {
        type: locked ? 'AUTH_LOCKED' : 'AUTH_FAILED',
        message: locked ? 'Sign-in rejected: console locked after repeated failures' : locks ? 'Sign-in failed; console locked for 60 s' : 'Sign-in failed: invalid credentials',
        severity: 'WARNING',
        details: locked
          ? { method: 'PASSWORD', retryInMs, lockedUntil: at + retryInMs }
          : { method: 'PASSWORD', knownOperator: false, attemptsRemaining, lockedUntil: locks ? at + AUTH_LOCKOUT_MS : null },
      },
      event: {
        type: locked ? 'AUTH_LOCKED' : 'AUTH_FAILED',
        message: locked ? 'Sign-in rejected — console locked' : locks ? 'Sign-in failed — console locked for 60 s' : 'Sign-in failed',
        severity: 'WARNING',
        params: locked ? { retryInMs } : { attemptsRemaining },
      },
    });
  }

  // The newest sign-in of each operator, for `last_sign_in_at`.
  const signedIn = (id: string): number | null => lastSignIn.get(id) ?? null;
  const withSignIn = operators.map((operator) => {
    const at = signedIn(operator.id);
    return { ...operator, lastSignInAt: at, updatedAt: Math.max(operator.updatedAt, at ?? 0) };
  });
  const operatorSignIns = directory.entries
    .filter((entry) => entry.seeded)
    .flatMap((entry) => {
      const at = signedIn(entry.operator.id);
      return at === null ? [] : [{ id: entry.operator.id, lastSignInAt: at }];
    });

  return {
    directory,
    devices,
    operators: withSignIn,
    operatorSignIns,
    operatorCredentials,
    pairingCodes,
    pairedDevices: devicesSeen,
    deviceCredentials,
    biometricTokens,
    authSessions,
  };
}
