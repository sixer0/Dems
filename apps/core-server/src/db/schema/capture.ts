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
 *
 * Schema v7 (migration set 8, `0015` + `0016`; task 4 schema set A, contract revision `dbc-8`)
 * adds two side tables keyed by the device id, declared after the three above: T-44
 * `capture_device_streams` (what a profile code means on the camera) and T-45
 * `capture_audio_inputs` (which sound-card input a microphone is). Side tables, not more columns
 * on the registry: the registry row is mapped from the engine's device slice and replicated by the
 * Simulated mode, and neither is touched. The same set makes the six slot columns of the selector
 * nullable.
 *
 * NOT YET IN THE KEPT SET OF A RESET: T-44 and T-45 extend a kept table and are to be carried with
 * it (schema design 3.3), but `db/reset/kept-tables.ts` carries a table by ONE key column and T-44
 * has two. Until that file learns it, a demo reset keeps a camera and empties its stream rows -
 * nothing writes either table before the rows that register a stream or a sound-card input.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { code, matches, oneOf } from './checks';
import { operators } from './rbac';
import {
  CAPTURE_ADAPTER_KIND,
  CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND,
  CAPTURE_DEVICE_KIND,
  CAPTURE_STREAM_CODEC,
  CAPTURE_STREAM_ROLE,
  type CaptureAdapterKindValue,
  type CaptureDeviceKindValue,
  type CaptureStreamCodecValue,
  type CaptureStreamRoleValue,
} from './value-sets';

/** The AES-256-GCM envelope v2 writes; the only value its CHECK admits (dbc-3 §B.3). */
const CREDENTIAL_ENCRYPTION = "'AES-256-GCM'";
/**
 * What an ONVIF profile token or video-source token may be: the rule the connection code already
 * holds a token to before it uses one (`capture/adapters/camera/onvif-session.ts`, `PROFILE_TOKEN`).
 * A token names a profile on the camera; it is not a credential and not a locator.
 */
const ONVIF_TOKEN = '^[A-Za-z0-9_.:-]{1,64}$';

/**
 * A slot column of the selector: NULLABLE in the database since schema v7 (`0015`), and so at run
 * time here - `drizzle-kit`, the contract inventory and the catalog all read this column as
 * nullable, which is what it is.
 *
 * SEAM OF TASK 4 ROW 17, TO BE REMOVED BY WP-13a (rows 28-36 and 161-172; requirement AD-04).
 * The cast keeps the TypeScript row type at `string`, because the readers and writers of the
 * selector row are not null-safe yet and are not the migration writer's to edit: `db/store/
 * store.ts` (the load), `db/mapping/rows.ts` (`captureConfigFromRow`, `captureConfigToRow`,
 * `selectorDeviceIds`), `db/mapping/changes.ts`, and the raw-SQL reader `modules/capture-config/
 * store.ts`, which the compiler does not see at all. The type is TRUE only while nothing writes
 * an unassigned slot: no code does (operation 78 has no `unassign` member yet), the runtime role
 * cannot insert the row, and the seed assigns all four slots. The row that makes those readers
 * null-safe replaces each `slotColumn(name)` below by `text(name)` in the same change; the
 * compiler then names every reader still to fix. Until then a NULL slot written by hand is a
 * state the readers refuse by throwing, which stops the boot (decisions C18).
 */
function slotColumn<TName extends string>(name: TName) {
  const column = text(name);
  return column as unknown as ReturnType<typeof column.notNull>;
}

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
    // ── schema v3 addition (dbc-4 §N.2, D-DB-11/D-DB-12). Declared LAST: `0008_capture_sources.sql`
    //    appends it (ALTER ADD COLUMN). `DEFAULT 'FAKE'` is permanent and errs to the safe side: a
    //    writer that forgets the column creates a development device. Written at INSERT and never
    //    updated - `dems_app` holds no UPDATE on it (`0009`), like `kind` (D72(f), D83). ──
    adapterKind: text('adapter_kind').$type<CaptureAdapterKindValue>().notNull().default('FAKE'),
  },
  (t) => [
    index('capture_devices_kind_idx').on(t.kind),
    // At most one device per ONVIF endpoint reference (dbc-4 §N.5, D-DB-15): the database's
    // backstop for the "already registered" match of adoption.
    uniqueIndex('capture_devices_onvif_uuid_key')
      .on(t.onvifUuid)
      .where(sql`${t.onvifUuid} IS NOT NULL`),
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
    check('capture_devices_adapter_kind_check', oneOf(t.adapterKind, CAPTURE_ADAPTER_KIND)),
    // The adapter kind is tied to the device class, as the id prefix is (dbc-4 §N.2).
    check(
      'capture_devices_adapter_pairing_check',
      sql`(${t.kind} = 'CAMERA' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.CAMERA)}) OR (${t.kind} = 'MIC' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.MIC)}) OR (${t.kind} = 'POE' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.POE)})`,
    ),
  ],
);

/**
 * T-31. The persistent device selector, one row (N-2 singleton). Snapshotted into
 * `active_session.capture_config` at session start (SH-06); `revision` is the optimistic lock of
 * operation 77 (`REVISION_CONFLICT`).
 *
 * SCHEMA v7 (set A of task 4; design addendum 1.4 #1, decisions C14): the six slot columns are
 * NULLABLE - a slot may be unassigned, which is the state the capture fence's own remedy names. A
 * video slot is a pair: `capture_config_slot_pair_check` refuses a device without a profile and a
 * profile without a device. The three older CHECKs keep their text; a comparison with NULL does
 * not fail a CHECK, so an unassigned slot passes them. No grant changed: the runtime role already
 * updates these columns (`0005`) and still neither inserts nor deletes the row.
 */
export const captureConfig = pgTable(
  'capture_config',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    video01DeviceId: slotColumn('video_01_device_id'),
    video01Profile: slotColumn('video_01_profile'),
    video02DeviceId: slotColumn('video_02_device_id'),
    video02Profile: slotColumn('video_02_profile'),
    micPrimaryId: slotColumn('mic_primary_id'),
    micStandbyId: slotColumn('mic_standby_id'),
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
    // Schema v7. Declared LAST: `0015` adds it. A video slot is assigned as a pair or not at all.
    check(
      'capture_config_slot_pair_check',
      sql`((${t.video01DeviceId} IS NULL) = (${t.video01Profile} IS NULL)) AND ((${t.video02DeviceId} IS NULL) = (${t.video02Profile} IS NULL))`,
    ),
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

/**
 * T-44 (schema v7, set A of task 4; schema design 2.1 with addendum 7.2). One row per stream
 * statement of an adopted camera. `profile` is the Core code that `capture_devices.profiles` lists
 * and `capture_config.video_0n_profile` selects; this table holds what that code means on the
 * camera: the ONVIF profile token, the video source, the lens, main or sub, and what the stream
 * test read (codec, picture size).
 *
 * `(device_id, lens, stream_role)` is a PLAIN index, not a unique one (addendum 7.2, erratum
 * E-A3): after the ruled H.264 fallback the same lens and role gets a second statement, and a key
 * column cannot be updated. "Usable now" stays the list in `capture_devices.profiles`.
 *
 * No secret and no locator: a token names a profile, it is not a credential; no address and no
 * URL is stored here. `codec` is one of a closed set decided by the Core's own parse (AD-06 (1)).
 * Runtime role (`0016`): SELECT, INSERT, UPDATE on every column but the two key columns, no
 * DELETE - a stream a camera no longer offers stays as a row and is ignored.
 */
export const captureDeviceStreams = pgTable(
  'capture_device_streams',
  {
    deviceId: text('device_id').notNull(),
    profile: text('profile').notNull(),
    onvifProfileToken: text('onvif_profile_token').notNull(),
    videoSourceToken: text('video_source_token'),
    lens: smallint('lens').notNull().default(1),
    streamRole: text('stream_role').$type<CaptureStreamRoleValue>().notNull(),
    codec: text('codec').$type<CaptureStreamCodecValue>(),
    width: integer('width'),
    height: integer('height'),
    readAt: bigint('read_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'capture_device_streams_pkey', columns: [t.deviceId, t.profile] }),
    foreignKey({
      name: 'capture_device_streams_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('capture_device_streams_device_lens_role_idx').on(t.deviceId, t.lens, t.streamRole),
    // Cameras only: the id prefix states the device kind (`capture_devices_id_check`).
    check('capture_device_streams_device_id_check', matches(t.deviceId, '^CAM-[0-9]{2,}$')),
    check('capture_device_streams_profile_check', code(t.profile)),
    check(
      'capture_device_streams_token_check',
      sql`${matches(t.onvifProfileToken, ONVIF_TOKEN)} AND (${t.videoSourceToken} IS NULL OR ${matches(t.videoSourceToken, ONVIF_TOKEN)})`,
    ),
    check('capture_device_streams_lens_check', sql`${t.lens} BETWEEN 1 AND 4`),
    check('capture_device_streams_stream_role_check', oneOf(t.streamRole, CAPTURE_STREAM_ROLE)),
    check('capture_device_streams_codec_check', sql`${t.codec} IS NULL OR ${oneOf(t.codec, CAPTURE_STREAM_CODEC)}`),
    // Unknown until a stream test ran; then both, each inside a stated bound (AD-06 (2)). The
    // second branch names IS NOT NULL: a comparison with NULL is unknown, and a CHECK that is
    // unknown passes, so "a width without a height" would otherwise be accepted.
    check(
      'capture_device_streams_size_check',
      sql`(${t.width} IS NULL AND ${t.height} IS NULL) OR (${t.width} IS NOT NULL AND ${t.height} IS NOT NULL AND ${t.width} BETWEEN 1 AND 16384 AND ${t.height} BETWEEN 1 AND 16384)`,
    ),
  ],
);

/**
 * T-45 (schema v7, set A of task 4; schema design 2.2, addendum 4.2). One row per registered
 * sound-card input, one-to-one with a `MIC-nn` registry row of adapter kind `USB_AUDIO`. Fake and
 * local-device microphones have no row.
 *
 * An input is allocated once: `(card_id, card_device, input_number)` is unique, enforced by the
 * database as the ONVIF endpoint is for cameras. Not here: the product name (it is
 * `capture_devices.model`) and the role (it is `capture_config.mic_primary_id` / `mic_standby_id`).
 * The Core's audio contract is ONE rate, so `sample_rate` is a one-value CHECK and the runtime role
 * holds no UPDATE on it (`0016`). Every text column is held to a pattern: no descriptor string a
 * USB device chose is stored here (AD-07 (1)).
 * Runtime role (`0016`): SELECT, INSERT, UPDATE on every column but the key and the rate, no DELETE.
 */
export const captureAudioInputs = pgTable(
  'capture_audio_inputs',
  {
    deviceId: text('device_id').primaryKey(),
    usbId: text('usb_id'),
    cardId: text('card_id').notNull(),
    cardDevice: smallint('card_device').notNull().default(0),
    inputNumber: smallint('input_number').notNull(),
    nativeChannels: smallint('native_channels').notNull(),
    sampleRate: integer('sample_rate').notNull().default(48000),
    sampleBits: smallint('sample_bits').notNull().default(24),
    updatedBy: text('updated_by'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    foreignKey({
      name: 'capture_audio_inputs_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'capture_audio_inputs_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    unique('capture_audio_inputs_card_input_key').on(t.cardId, t.cardDevice, t.inputNumber),
    // Microphones only: the id prefix states the device kind (`capture_devices_id_check`).
    check('capture_audio_inputs_device_id_check', matches(t.deviceId, '^MIC-[0-9]{2,}$')),
    check('capture_audio_inputs_usb_id_check', sql`${t.usbId} IS NULL OR ${matches(t.usbId, '^[0-9a-f]{4}:[0-9a-f]{4}$')}`),
    check(
      'capture_audio_inputs_card_check',
      sql`${matches(t.cardId, '^[A-Za-z0-9_]{1,32}$')} AND ${t.cardDevice} BETWEEN 0 AND 31`,
    ),
    // The input exists on the card: the refusal of an input beyond the card, held by the database too.
    check(
      'capture_audio_inputs_input_check',
      sql`${t.inputNumber} BETWEEN 1 AND 64 AND ${t.nativeChannels} BETWEEN 1 AND 64 AND ${t.inputNumber} <= ${t.nativeChannels}`,
    ),
    check('capture_audio_inputs_sample_rate_check', sql`${t.sampleRate} = 48000`),
    check('capture_audio_inputs_sample_bits_check', sql`${t.sampleBits} IN (16, 24, 32)`),
  ],
);

/** Under the seam `slotColumn` (above) the six slot members still read as text; WP-13a makes them `string | null`. */
export type CaptureConfigRow = typeof captureConfig.$inferSelect;
export type NewCaptureConfigRow = typeof captureConfig.$inferInsert;
export type CaptureDeviceRow = typeof captureDevices.$inferSelect;
export type NewCaptureDeviceRow = typeof captureDevices.$inferInsert;
export type CaptureDeviceCredentialRow = typeof captureDeviceCredentials.$inferSelect;
export type NewCaptureDeviceCredentialRow = typeof captureDeviceCredentials.$inferInsert;
export type CaptureDeviceStreamRow = typeof captureDeviceStreams.$inferSelect;
export type NewCaptureDeviceStreamRow = typeof captureDeviceStreams.$inferInsert;
export type CaptureAudioInputRow = typeof captureAudioInputs.$inferSelect;
export type NewCaptureAudioInputRow = typeof captureAudioInputs.$inferInsert;
