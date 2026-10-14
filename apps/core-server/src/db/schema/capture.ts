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
 *
 * Schema v8 (migration set 9, `0017` + `0018`; task 4 schema set B, contract revision `dbc-9`)
 * adds the two tables of the commissioning functions, declared last: T-46
 * `capture_network_config` (one row: which host interface is the camera port, and the settings of
 * the factory-address scan) and T-47 `host_network_aliases` (the state of the one temporary
 * address the Core may put on that interface). The same set gives T-45 two columns, the USB
 * serial number and the USB port path of a sound card, so that a card of the same product on
 * another port can be told apart (findings of task 4 rows 67 and 156).
 *
 * NO ADDRESS TYPE: the design named `cidr` and `inet` and gave `text` with a CHECK as the
 * fallback. The fallback is taken - the contract's column types are a closed list of nine
 * (TY-1; `test/db/contract-inventory.test.ts`, `catalog.db.test.ts`), and an address stays text
 * as `capture_devices.address` is. Every address column is held to a pattern written out here.
 */
import { sql, type SQL } from 'drizzle-orm';
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
  uniqueIndex,
  uuid,
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
  HOST_ALIAS_REASON,
  HOST_ALIAS_REMOVE_REASON,
  type CaptureAdapterKindValue,
  type CaptureDeviceKindValue,
  type CaptureStreamCodecValue,
  type CaptureStreamRoleValue,
  type HostAliasReasonValue,
  type HostAliasRemoveReasonValue,
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
 * What the USB serial number and the USB port path of a sound card may be (schema v8): letters,
 * digits and `: . _ -`, 1 to 64 characters - the rule the card listing already holds a port path
 * to (`capture/adapters/audio/card-listing.ts`, `USB_PORT`). A serial number is a string the
 * device chose; one that does not fit is not stored (NULL), never stored as it came (AD-07 (1)).
 */
const USB_PATH_OR_SERIAL = '^[A-Za-z0-9:._-]{1,64}$';
/**
 * The name of a host network interface: at most 15 characters, the first a letter or a digit, the
 * rest letters, digits and `_ . -`. EXACTLY the form the alias helper holds the name of its own
 * root-owned file to (`scripts/host/netalias/dems-core-netalias`, `INTERFACE_NAME`:
 * `\A[A-Za-z0-9][A-Za-z0-9_.-]{0,14}\Z`) and the Core's caller holds both names to
 * (`capture/host-alias/caller.ts`, `facts.ts`) - no wider: the stored name ends up beside a root
 * helper's argument. `$` is the end of the text here (PostgreSQL's default), as `\Z` is there.
 *
 * UPPER CASE SINCE SCHEMA V14 (`0030`; code review 120 finding F-4, decision C114). Until then
 * the form was lower case only (assumption AS-9 of the schema design), and a port the kernel
 * names with a capital - the predictable form with a PCI domain, `enP2p1s0` - could not be stored
 * on a host where the helper itself would work.
 */
const INTERFACE_NAME = '^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$';
/** One number of a dotted IPv4 address, 0 to 255, without a leading zero. */
const IPV4_OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
/** The host part of an address inside a /24, 1 to 254 (never the network or the broadcast address). */
const IPV4_HOST_PART = '(25[0-4]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)';
/** An IPv4 network as `a.b.c.d/n` with a prefix length of 16 to 30. `[.]` is a literal dot. */
const CAMERA_SUBNET = `^${IPV4_OCTET}([.]${IPV4_OCTET}){3}/(1[6-9]|2[0-9]|30)$`;
/**
 * A temporary address as the alias helper takes it: `a.b.c.d/24`, inside 10.0.0.0/8,
 * 172.16.0.0/12 or 192.168.0.0/16, host part 1 to 254 (the helper's own bound, S13-08 (2)).
 */
const PRIVATE_ALIAS_ADDRESS = `^(10[.]${IPV4_OCTET}[.]${IPV4_OCTET}|172[.](1[6-9]|2[0-9]|3[01])[.]${IPV4_OCTET}|192[.]168[.]${IPV4_OCTET})[.]${IPV4_HOST_PART}/24$`;
/**
 * The factory addresses input-av scans by default (`apps/input-av/nvr/settings.py`, member
 * `factory_default_ips`): INPUT-AV'S DEFAULTS, carried as they are and tested by nothing in this
 * task - no camera at a factory address was ever reached from the Core.
 */
const FACTORY_ADDRESSES_DEFAULT = ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'];
/**
 * The allowed ONVIF ports an existing row gets and a first-use row starts with (schema v14): port
 * 80 alone, which is what the destination rule used before the list was stored
 * (`capture/destination-rule.ts`, `DESTINATION_DEFAULT_PORTS`).
 */
const ONVIF_PORTS_DEFAULT = [80];
/** The bound of the destination rule's port list (`capture/destination-rule.ts`, `DESTINATION_MAX_PORTS`). */
const ONVIF_PORTS_MAX = 8;
/**
 * `a -> i = a -> j` for every two places of a list of at most `ONVIF_PORTS_MAX` elements, joined
 * by OR: true when two elements are equal. A place the list does not have reads NULL, so the
 * comparison is NULL there and never true. Plain SQL and no path: a CHECK admits no sub-select,
 * and a path cannot compare an element with the ones after it without naming the places either.
 * Statement text only (the column name of this file and the numbers 0 to 7).
 */
function anyTwoEqual(column: string): SQL {
  const pairs: string[] = [];
  for (let first = 0; first < ONVIF_PORTS_MAX; first += 1) {
    for (let second = first + 1; second < ONVIF_PORTS_MAX; second += 1) pairs.push(`(${column} -> ${first}) = (${column} -> ${second})`);
  }
  return sql.raw(pairs.join(' OR '));
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
    // ── schema v15 additions (migration set 16, `0032` + `0033`; design
    //    `docs/2026-10-12_input_av_core_adapter_plan/masterplan/07_design_retire_readopt.md` section
    //    4.1, decision C147). Declared LAST: `0032` appends them. RETIREMENT: the instant (epoch ms,
    //    as `last_seen_at`) and the operator. Both NULL = in service. A retired row is kept for
    //    history - its id stays named by audit rows and sealed packages and is never minted again -
    //    and is never changed again but for `last_seen_at` and `enabled` (the guard trigger of
    //    `0033`); its credential is destroyed in the same unit (`dems_capture_credential_destroy`). ──
    retiredAt: bigint('retired_at', { mode: 'number' }),
    retiredBy: text('retired_by'),
  },
  (t) => [
    index('capture_devices_kind_idx').on(t.kind),
    // At most one device IN SERVICE per ONVIF endpoint reference (dbc-4 §N.5, D-DB-15): the
    // database's backstop for the "already registered" match of adoption. Since schema v15 a
    // retired row no longer holds its reference, so the same camera can be adopted again under a
    // NEW id (design 07 section 4.1).
    uniqueIndex('capture_devices_onvif_uuid_key')
      .on(t.onvifUuid)
      .where(sql`${t.onvifUuid} IS NOT NULL AND ${t.retiredAt} IS NULL`),
    // Schema v15: who retired the device. RESTRICT, as every operator reference of this file.
    foreignKey({
      name: 'capture_devices_retired_by_fkey',
      columns: [t.retiredBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
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
    // Schema v10 (migration set 11; requirement AD-06 (4), handed over by task 4 row 51): EVERY
    // element of the list is a code of the Core - a text of the `CODE` form, the form adoption mints
    // (`<codec>_<picture><rate>`, e.g. `HEVC_1080P`). Before row 51 adoption stored the camera's own
    // ONVIF profile tokens here; a token is text a device chose and is no member of this list.
    // CASE, not AND: the path over something that is no array is an error, and a CHECK must refuse
    // it as a rule (23514). STRICT, not the default lax mode: lax unwraps a list inside the list
    // before the filter sees it, so `[["HEVC_1080P"]]` would pass as if it were flat (measured by
    // row 51 and again by `set11.db.test.ts`). The pattern is `CODE` of `./checks`, written out
    // because it stands inside a JSON path literal.
    check(
      'capture_devices_profiles_code_check',
      sql`CASE WHEN jsonb_typeof(${t.profiles}) = 'array' THEN NOT jsonb_path_exists(${t.profiles}, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))') ELSE false END`,
    ),
    check('capture_devices_poe_port_check', sql`${t.poePort} IS NULL OR ${code(t.poePort)}`),
    check('capture_devices_adapter_kind_check', oneOf(t.adapterKind, CAPTURE_ADAPTER_KIND)),
    // The adapter kind is tied to the device class, as the id prefix is (dbc-4 §N.2).
    check(
      'capture_devices_adapter_pairing_check',
      sql`(${t.kind} = 'CAMERA' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.CAMERA)}) OR (${t.kind} = 'MIC' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.MIC)}) OR (${t.kind} = 'POE' AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.POE)})`,
    ),
    // Schema v15. Declared LAST: `0032` adds them. Retired is the instant AND the operator, or
    // neither (design 07 section 4.1).
    check('capture_devices_retired_check', sql`(${t.retiredAt} IS NULL) = (${t.retiredBy} IS NULL)`),
    // Cameras and microphones are retired; the PoE switch is not (design 07 section 4.3,
    // `CAPTURE_DEVICE_BUILT_IN`) - held by the database too.
    check('capture_devices_retired_kind_check', sql`${t.retiredAt} IS NULL OR ${t.kind} <> 'POE'`),
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
    video01DeviceId: text('video_01_device_id'),
    video01Profile: text('video_01_profile'),
    video02DeviceId: text('video_02_device_id'),
    video02Profile: text('video_02_profile'),
    micPrimaryId: text('mic_primary_id'),
    micStandbyId: text('mic_standby_id'),
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
    // ── schema v8 additions (set B of task 4; findings of rows 67 and 156). Declared LAST: `0017`
    //    appends them (ALTER ADD COLUMN). Both NULL for every row that existed and for a card that
    //    states neither: many cards carry no serial number, and a card that is not USB has no port.
    //    With them a card of the same product on another port, or another unit of it, is no longer
    //    the registered card. The runtime role updates both with the other card columns (`0018`). ──
    usbSerial: text('usb_serial'),
    usbPort: text('usb_port'),
    // ── schema v15 addition (migration set 16; design 07 section 4.1, decision C147). Declared
    //    LAST: `0032` appends it. The MIRROR of `capture_devices.retired_at` of this microphone,
    //    written in the same unit with the same value. A retired input no longer holds its card
    //    input (the partial unique index below), so the card is listed as new and registering it
    //    mints a NEW `MIC-nn`; the row itself is never changed again (the guard trigger of `0033`). ──
    retiredAt: bigint('retired_at', { mode: 'number' }),
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
    // One input IN SERVICE per card input. Until schema v15 a unique CONSTRAINT of the same name;
    // since then a partial unique index, so that a retired input no longer holds it (design 07
    // section 4.1).
    uniqueIndex('capture_audio_inputs_card_input_key')
      .on(t.cardId, t.cardDevice, t.inputNumber)
      .where(sql`${t.retiredAt} IS NULL`),
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
    // Schema v8. Declared LAST: `0017` adds them. A closed character set and a length, never the
    // descriptor string as the device wrote it.
    check('capture_audio_inputs_usb_serial_check', sql`${t.usbSerial} IS NULL OR ${matches(t.usbSerial, USB_PATH_OR_SERIAL)}`),
    check('capture_audio_inputs_usb_port_check', sql`${t.usbPort} IS NULL OR ${matches(t.usbPort, USB_PATH_OR_SERIAL)}`),
  ],
);

/**
 * T-46 (schema v8, set B of task 4; schema design 2.4). The network settings of the commissioning
 * functions, one row (N-2 singleton, the form of `capture_config`).
 *
 * `interface_name` is NULLABLE AND HAS NO DEFAULT: the Core never picks the camera interface
 * itself (decision U11, OQ-4) - a function that adds an address to a host interface must be told
 * which one, and a wrong automatic choice is the office network. No row, or a row without an
 * interface, is "not configured". `camera_subnet` NULL = derived from the interface.
 *
 * THE DEFAULTS ARE INPUT-AV'S DEFAULTS (`apps/input-av/nvr/settings.py`: the factory address
 * list, alias host 253, alias lifetime 30 minutes, first camera address 101, with its bounds).
 * They are carried as they are and are NOT TESTED by this task against any camera. input-av's
 * discovery scope and intervals are not stored: they are contract constants of the Core's search.
 *
 * `factory_addresses` is a list, never free JSON (S13-13): an array of at most 32 texts, each
 * of the dotted form of an IPv4 address. Whether an address is a private one is the module's
 * rule (it is the destination rule's too); the database holds the form and the size.
 *
 * `onvif_ports` (schema v14, `0030`; code review 120b finding S2-02, decision C116; security
 * requirement S13-11 point 3, "the port from the short stored list") is the SEVENTH SETTING: the
 * ports the destination rule admits for a camera's ONVIF service, in the order the rule reads
 * them (the FIRST is the port of an address that names none). Every bound of the rule's list is
 * held here too: a list of 1 to 8 elements, each a whole number 1 to 65535, no two equal. An
 * empty list is refused as the rule refuses it (`PORT_LIST_INVALID`). The default `[80]` is what
 * the rule used while no list was stored, so an existing row keeps today's behaviour.
 * Runtime role (`0018`, `0031`): SELECT, INSERT (the default row at first use), UPDATE on every
 * column but `singleton`, no DELETE.
 */
export const captureNetworkConfig = pgTable(
  'capture_network_config',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    interfaceName: text('interface_name'),
    cameraSubnet: text('camera_subnet'),
    factoryAddresses: jsonb('factory_addresses').$type<string[]>().notNull().default(FACTORY_ADDRESSES_DEFAULT),
    aliasHost: smallint('alias_host').notNull().default(253),
    aliasMinutes: smallint('alias_minutes').notNull().default(30),
    cameraIpStart: smallint('camera_ip_start').notNull().default(101),
    revision: bigint('revision', { mode: 'number' }).notNull().default(1),
    updatedBy: text('updated_by'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    // Schema v14. Declared LAST: `0030` adds it, so this is its place in the stored table.
    onvifPorts: jsonb('onvif_ports').$type<number[]>().notNull().default(ONVIF_PORTS_DEFAULT),
  },
  (t) => [
    foreignKey({
      name: 'capture_network_config_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('capture_network_config_singleton_check', sql`${t.singleton}`),
    check('capture_network_config_interface_name_check', sql`${t.interfaceName} IS NULL OR ${matches(t.interfaceName, INTERFACE_NAME)}`),
    check('capture_network_config_camera_subnet_check', sql`${t.cameraSubnet} IS NULL OR ${matches(t.cameraSubnet, CAMERA_SUBNET)}`),
    // CASE, not AND: the length of something that is no array is an error, and a CHECK must
    // refuse it as a rule (23514). The path finds an element that is no text or not of the form.
    // STRICT, not the default lax mode: lax unwraps a list inside the list before the filter sees
    // it, so `[["192.168.1.64"]]` would pass as if it were flat (found by `set9.db.test.ts`).
    check(
      'capture_network_config_factory_addresses_check',
      sql`CASE WHEN jsonb_typeof(${t.factoryAddresses}) = 'array' THEN jsonb_array_length(${t.factoryAddresses}) <= 32 AND NOT jsonb_path_exists(${t.factoryAddresses}, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[0-9]{1,3}([.][0-9]{1,3}){3}$"))') ELSE false END`,
    ),
    check('capture_network_config_alias_host_check', sql`${t.aliasHost} BETWEEN 2 AND 254`),
    check('capture_network_config_alias_minutes_check', sql`${t.aliasMinutes} BETWEEN 5 AND 480`),
    check('capture_network_config_camera_ip_start_check', sql`${t.cameraIpStart} BETWEEN 2 AND 250`),
    check('capture_network_config_revision_check', sql`${t.revision} >= 1`),
    // Schema v14. Declared LAST: `0030` adds them. CASE as above: what is no list is refused as a
    // rule. Three STRICT paths, one question each: an element that is no number; a number outside
    // 1..65535; a number that is not whole. The size is the rule's own, 1 to 8.
    check(
      'capture_network_config_onvif_ports_check',
      sql`CASE WHEN jsonb_typeof(${t.onvifPorts}) = 'array' THEN jsonb_array_length(${t.onvifPorts}) BETWEEN 1 AND ${sql.raw(String(ONVIF_PORTS_MAX))} AND NOT jsonb_path_exists(${t.onvifPorts}, 'strict $[*]?(@.type() != "number")') AND NOT jsonb_path_exists(${t.onvifPorts}, 'strict $[*]?(@ < 1 || @ > 65535)') AND NOT jsonb_path_exists(${t.onvifPorts}, 'strict $[*]?(@ != @.floor())') ELSE false END`,
    ),
    // No two elements equal. Where no two are, the comparison is false or NULL, and a CHECK
    // admits both; `80` and `80.0` are one number to it.
    check(
      'capture_network_config_onvif_ports_distinct_check',
      sql`CASE WHEN jsonb_typeof(${t.onvifPorts}) = 'array' THEN NOT (${anyTwoEqual('"capture_network_config"."onvif_ports"')}) ELSE false END`,
    ),
  ],
);

/**
 * T-47 (schema v8, set B of task 4; schema design 2.5). The state of a temporary address the
 * Core put on the camera interface through the alias helper; the audit entries are the trace of
 * the actions. A row is opened when the address is added and closed (`removed_at`) when it is
 * gone; it is never removed.
 *
 * ONE ALIAS AT A TIME. The helper as delivered holds one marked address
 * (`scripts/host/netalias/dems-core-netalias`, `MAX_MARKED = 1`; task 4 row 104), and the
 * database holds the same bound: `host_network_aliases_one_open_key` admits one open row, and
 * `host_network_aliases_open_address_key` (the design's rule) one open row per interface and
 * address. A second open alias is therefore refused by the database whatever the code does.
 *
 * `expires_at` is the lifetime the helper was given (5 to 480 minutes): the helper's timer is the
 * kernel's, the Core's memory dies with the process, so the row is what a start-up sweep compares
 * against. `remove_error` is the CODE of a removal that failed (the alias is then still open).
 * `address` is text in the helper's own form, `a.b.c.d/24` in a private range.
 * Runtime role (`0018`): SELECT, INSERT, UPDATE on `expires_at` and the four removal columns, no
 * DELETE.
 */
export const hostNetworkAliases = pgTable(
  'host_network_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interfaceName: text('interface_name').notNull(),
    address: text('address').notNull(),
    reason: text('reason').$type<HostAliasReasonValue>().notNull(),
    addedAt: bigint('added_at', { mode: 'number' }).notNull(),
    addedBy: text('added_by').notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    removedAt: bigint('removed_at', { mode: 'number' }),
    removeReason: text('remove_reason').$type<HostAliasRemoveReasonValue>(),
    removedBy: text('removed_by'),
    removeError: text('remove_error'),
  },
  (t) => [
    foreignKey({
      name: 'host_network_aliases_added_by_fkey',
      columns: [t.addedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'host_network_aliases_removed_by_fkey',
      columns: [t.removedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    // One alias in place per interface and address (schema design 2.5); also "which are ours".
    uniqueIndex('host_network_aliases_open_address_key')
      .on(t.interfaceName, t.address)
      .where(sql`${t.removedAt} IS NULL`),
    // One alias in place at all: every open row has the same value of the indexed expression.
    uniqueIndex('host_network_aliases_one_open_key')
      .on(sql`(${t.removedAt} IS NULL)`)
      .where(sql`${t.removedAt} IS NULL`),
    check('host_network_aliases_interface_name_check', matches(t.interfaceName, INTERFACE_NAME)),
    check('host_network_aliases_address_check', matches(t.address, PRIVATE_ALIAS_ADDRESS)),
    check('host_network_aliases_reason_check', oneOf(t.reason, HOST_ALIAS_REASON)),
    check('host_network_aliases_expires_at_check', sql`${t.expiresAt} > ${t.addedAt}`),
    check('host_network_aliases_removed_at_check', sql`${t.removedAt} IS NULL OR ${t.removedAt} >= ${t.addedAt}`),
    // The reason is set exactly when the alias is closed, and it is one of the closed set.
    check(
      'host_network_aliases_remove_reason_check',
      sql`((${t.removeReason} IS NULL) = (${t.removedAt} IS NULL)) AND (${t.removeReason} IS NULL OR ${oneOf(t.removeReason, HOST_ALIAS_REMOVE_REASON)})`,
    ),
    // Who removed it is stated only for an alias that is removed; NULL then means the system.
    check('host_network_aliases_removed_by_check', sql`${t.removedBy} IS NULL OR ${t.removedAt} IS NOT NULL`),
    check('host_network_aliases_remove_error_check', sql`${t.removeError} IS NULL OR ${code(t.removeError)}`),
  ],
);

/** The six slot members are `string | null`: an unassigned slot is NULL (schema v7; the type seam of task 4 row 17 was removed by integration pass I-6, no column changed). */
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
export type CaptureNetworkConfigRow = typeof captureNetworkConfig.$inferSelect;
export type NewCaptureNetworkConfigRow = typeof captureNetworkConfig.$inferInsert;
export type HostNetworkAliasRow = typeof hostNetworkAliases.$inferSelect;
export type NewHostNetworkAliasRow = typeof hostNetworkAliases.$inferInsert;
