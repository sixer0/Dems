/**
 * Typed schema, group `capture`: T-32 `capture_devices`, T-31 `capture_config`,
 * T-33 `capture_device_credentials` (database contract dbc-3 §B.2, §B.1, §B.3).
 *
 * These three tables are part of the KEPT set of a demo reset (dbc-3 §E.1, OD-19): the device
 * registry, the selector and the camera credentials survive a reset, so real evidence can never be
 * re-pointed at wiped configuration. Their privileges (dbc-3 §D, migration `0005`) are NOT here:
 * `dems_app` gets no INSERT and no DELETE on `capture_config`, no DELETE on `capture_devices`, and
 * NO SELECT on `capture_device_credentials` at all — that table is read only through the owner's
 * `SECURITY DEFINER` reveal function, so a typed-schema row of it is never what the runtime role
 * fetches (RK-12; SEC35-01/SEC35-02/SEC35-03).
 *
 * The media profiles, transports and PoE port names are OPEN sets checked by the `CODE` format:
 * a new transport or profile needs no migration (OD-06/OD-07, MG-11). The declaration order follows
 * the dependency order of dbc-3 §A.2 (#1 registry, #2 selector, #3 credentials).
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { code, matches, oneOf } from './checks';
import { operators } from './rbac';
import { CAPTURE_DEVICE_KIND, type CaptureDeviceKindValue } from './value-sets';

/** The AES-256-GCM envelope v2 writes; the only value its CHECK admits (dbc-3 §B.3). */
const CREDENTIAL_ENCRYPTION = "'AES-256-GCM'";

/**
 * T-32. The real/fake capture-device registry — never the paired-client registry
 * (`AdminResource.DEVICES` is taken, E-04). The built-in IDs match the simulator's initial state:
 * `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`, `POE-SWITCH`.
 */
export const captureDevices = pgTable(
  'capture_devices',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<CaptureDeviceKindValue>().notNull(),
    transport: text('transport').notNull(),
    model: text('model'),
    firmware: text('firmware'),
    address: text('address'),
    mac: text('mac'),
    onvifUuid: text('onvif_uuid'),
    profiles: jsonb('profiles').notNull().default([]),
    poePort: text('poe_port'),
    enabled: boolean('enabled').notNull().default(true),
    lastSeenAt: bigint('last_seen_at', { mode: 'number' }),
  },
  (t) => [
    index('capture_devices_kind_idx').on(t.kind),
    // The id prefix is tied to the kind, so a registry row cannot claim to be a camera under a
    // `MIC-` id (dbc-3 §B.2).
    check(
      'capture_devices_id_check',
      sql`(${t.kind} = 'CAMERA' AND ${matches(t.id, '^CAM-[0-9]{2,}$')}) OR (${t.kind} = 'MIC' AND ${matches(t.id, '^MIC-[0-9]{2,}$')}) OR (${t.kind} = 'POE' AND ${matches(t.id, '^POE-[A-Z0-9_]{2,}$')})`,
    ),
    check('capture_devices_kind_check', oneOf(t.kind, CAPTURE_DEVICE_KIND)),
    check('capture_devices_transport_check', code(t.transport)),
    check(
      'capture_devices_text_check',
      sql`(${t.model} IS NULL OR char_length(${t.model}) BETWEEN 1 AND 120) AND (${t.firmware} IS NULL OR char_length(${t.firmware}) BETWEEN 1 AND 120) AND (${t.address} IS NULL OR char_length(${t.address}) BETWEEN 1 AND 120) AND (${t.onvifUuid} IS NULL OR char_length(${t.onvifUuid}) BETWEEN 1 AND 120) AND (${t.mac} IS NULL OR ${matches(t.mac, '^[0-9A-F:]{17}$')})`,
    ),
    check('capture_devices_profiles_check', sql`jsonb_typeof(${t.profiles}) = 'array'`),
    check('capture_devices_poe_port_check', sql`${t.poePort} IS NULL OR ${code(t.poePort)}`),
  ],
);

/**
 * T-31. The persistent device selector, one row (N-2 singleton). Snapshotted into
 * `active_session.capture_config` at session start (SH-06); `revision` is the optimistic lock of
 * operation 77 (`REVISION_CONFLICT`).
 */
export const captureConfig = pgTable(
  'capture_config',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    video01DeviceId: text('video_01_device_id').notNull(),
    video01Profile: text('video_01_profile').notNull(),
    video02DeviceId: text('video_02_device_id').notNull(),
    video02Profile: text('video_02_profile').notNull(),
    micPrimaryId: text('mic_primary_id').notNull(),
    micStandbyId: text('mic_standby_id').notNull(),
    revision: bigint('revision', { mode: 'number' }).notNull().default(1),
    updatedBy: text('updated_by'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('capture_config_singleton_check', sql`${t.singleton}`),
    foreignKey({
      name: 'capture_config_video_01_device_id_fkey',
      columns: [t.video01DeviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'capture_config_video_02_device_id_fkey',
      columns: [t.video02DeviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'capture_config_mic_primary_id_fkey',
      columns: [t.micPrimaryId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'capture_config_mic_standby_id_fkey',
      columns: [t.micStandbyId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'capture_config_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('capture_config_profile_check', sql`${code(t.video01Profile)} AND ${code(t.video02Profile)}`),
    // The two mic slots are two different inputs (OD-09).
    check('capture_config_mic_check', sql`${t.micStandbyId} <> ${t.micPrimaryId}`),
    // A dual-lens single camera is legal only with two distinct profiles (OD-05, D-DB-10).
    check(
      'capture_config_selector_check',
      sql`(${t.video01DeviceId} <> ${t.video02DeviceId}) OR (${t.video01Profile} <> ${t.video02Profile})`,
    ),
    check('capture_config_revision_check', sql`${t.revision} >= 1`),
  ],
);

/**
 * T-33. Write-only camera secrets (RK-12). One row per camera; written only through operation 89
 * and read only through the owner-owned reveal function. `secret_ciphertext` and `nonce` are the
 * GCM envelope, `key_ref` is a `CODE` reference into the Core credential store and NEVER key
 * material (SEC35-03). Nothing of this table may reach a slice, a log or an audit row (NL-1): the
 * two audit details carry the device ID and a reason code alone (E-30).
 */
export const captureDeviceCredentials = pgTable(
  'capture_device_credentials',
  {
    deviceId: text('device_id').primaryKey(),
    username: text('username').notNull(),
    encryption: text('encryption').notNull().default('AES-256-GCM'),
    secretCiphertext: bytea('secret_ciphertext').notNull(),
    nonce: bytea('nonce').notNull(),
    keyRef: text('key_ref').notNull(),
    rotatedAt: bigint('rotated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    foreignKey({
      name: 'capture_device_credentials_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('capture_device_credentials_username_check', sql`char_length(${t.username}) BETWEEN 1 AND 120`),
    check('capture_device_credentials_encryption_check', sql`${t.encryption} = ${sql.raw(CREDENTIAL_ENCRYPTION)}`),
    // 16-byte minimum plaintext plus the 16-byte GCM tag; the nonce is the 96-bit standard size.
    check('capture_device_credentials_secret_check', sql`octet_length(${t.secretCiphertext}) >= 33`),
    check('capture_device_credentials_nonce_check', sql`octet_length(${t.nonce}) = 12`),
    check('capture_device_credentials_key_ref_check', code(t.keyRef)),
  ],
);

export type CaptureConfigRow = typeof captureConfig.$inferSelect;
export type NewCaptureConfigRow = typeof captureConfig.$inferInsert;
export type CaptureDeviceRow = typeof captureDevices.$inferSelect;
export type NewCaptureDeviceRow = typeof captureDevices.$inferInsert;
export type CaptureDeviceCredentialRow = typeof captureDeviceCredentials.$inferSelect;
export type NewCaptureDeviceCredentialRow = typeof captureDeviceCredentials.$inferInsert;
