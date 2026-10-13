/**
 * The sound cards of the Core's host and the registration of one of their inputs as a microphone:
 * operations 98 and 99 of the Core API (task 4, blueprint row 63, package WP-07b; design addendum
 * `masterplan/04_design_addendum.md` section 4.2; plan review findings P12-F05 (c) and P12-F06;
 * security addendum requirement AD-07).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 98 | `searchCaptureAudioCards` | CAPTURE_CONFIG + WEB_CONSOLE_SESSION | CAPTURE_DISCOVERY_SEARCHED with `scope: AUDIO_CARDS` |
 * | 99 | `registerCaptureAudioInput` | CAPTURE_CONFIG + WEB_CONSOLE_SESSION | CAPTURE_AUDIO_INPUT_CHANGED |
 *
 * THIS FILE IS THE CONTRACT ONLY. No Core route, no adapter and no screen exists yet (blueprint
 * rows 64, 67, 70, 72). The in-app simulator answers both (`sim/api.ts`).
 *
 * NOTHING ENUMERATES IN THE BACKGROUND AND NOTHING CHOOSES A CARD. An operator starts the listing
 * (98); it is not stored. A registration (99) names a card, a device index and an input number,
 * and the Core enumerates AGAIN itself: the channel count, the USB id and the product come from
 * that second listing, never from the body.
 *
 * DEVICE TEXT IS UNTRUSTED (AD-07 (1)). The product name of a card is text the USB device chose.
 * Every string of a card answer is held to a closed character rule and a stated length HERE, in
 * the schema: printable ASCII only for the product, four hexadecimal digits, a colon and four
 * hexadecimal digits for the USB id, the kernel's own form for the card id. The adapter replaces
 * a string that fails by a fixed word before it leaves the adapter; a client draws it as text only.
 *
 * NO DEVICE TEXT IN A REQUEST, AN AUDIT ROW OR A HELPER ARGUMENT (AD-07 (2)). The body of 99 has
 * three members: a card id of the kernel's form and two integers. The audit row of 99 holds a
 * registry id, a change code and two integers. The capture helper's device argument is built by
 * the Core from integers only; nothing a request or a descriptor says forms a part of it.
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS } from './capture';
import { CaptureDiscoveryReason } from './capture-discovery';
import { API_BASE_PATH } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiMode,
  CoreApiTag,
  WEB_CONSOLE_ONLY_REASON,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { ERROR_EXAMPLES, EXAMPLE_INSTANT_MS, apiErrorExample, deniedExamples } from './example-parts';
import type { OperationExamples } from './examples';
import { INVALID_JSON, NOT_SIGNED_IN, SIM_V2_NOTE, notPermitted } from './operation-parts';
import { HARDWARE_DEVICE_ID_PATTERN } from './patterns';
import { epochMs } from './schema-parts';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Forms and bounds (the columns of `capture_audio_inputs`, schema set A, state the same ones)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** A card id in the kernel's own form: letters, digits and the underscore. Never a product name. */
export const CAPTURE_AUDIO_CARD_ID_PATTERN = /^[A-Za-z0-9_]{1,32}$/;
/** A USB id: vendor and product, four lower-case hexadecimal digits each. */
export const CAPTURE_AUDIO_USB_ID_PATTERN = /^[0-9a-f]{4}:[0-9a-f]{4}$/;
/**
 * The serial number a USB card states (task 4 rows 199 / 200, decision C56; row V3): letters,
 * digits and `: . _ -`, 1 to 64 characters. The SAME closed rule as the column
 * `capture_audio_inputs.usb_serial` and as the listing's own rule (`CardStringKind.USB_SERIAL`): a
 * serial outside it is NO serial (null), never a cleaned or cut one. Text the device chose: it
 * tells two cards of one model apart and is drawn as text only.
 */
export const CAPTURE_AUDIO_USB_SERIAL_PATTERN = /^[A-Za-z0-9:._-]{1,64}$/;
/**
 * The port a USB card sits on, in the kernel's topological form as it is written after `usb-`
 * (e.g. `0000:00:14.0-2.1`): letters, digits and `: . _ -`, 1 to 64 characters. The rule of the
 * column `capture_audio_inputs.usb_port` and of the listing (`CardStringKind.USB_PORT`). The Core
 * reads it from the kernel, never from the device's descriptor.
 */
export const CAPTURE_AUDIO_USB_PORT_PATTERN = /^[A-Za-z0-9:._-]{1,64}$/;
/** The longest product name a card answer carries (characters). */
export const CAPTURE_AUDIO_CARD_TEXT_MAX_LENGTH = 64;
/**
 * The closed character rule of a product name (AD-07 (1)): printable ASCII, U+0020 to U+007E, 1 to
 * 64 characters. No control, bidirectional or zero-width character can pass it.
 */
export const CAPTURE_AUDIO_CARD_TEXT_PATTERN = /^[ -~]{1,64}$/;
/** The device index of a card: 0 to 31. */
export const CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX = 31;
/** The inputs of a card are numbered from 1; a card has at most 64 (and an input number is at most its channel count). */
export const CAPTURE_AUDIO_CARD_MAX_CHANNELS = 64;
/** The most card entries one answer lists; `truncated` says when the host has more. */
export const CAPTURE_AUDIO_CARD_MAX_ENTRIES = 32;
/** The sample sizes a card may offer, in bits: a closed set, never a format name of the device. */
export const CAPTURE_AUDIO_SAMPLE_BITS = [16, 24, 32] as const;
export type CaptureAudioSampleBits = (typeof CAPTURE_AUDIO_SAMPLE_BITS)[number];
/** Least time between two card searches per Core (ms): the spacing of the camera search (AD-07 (3)). */
export const CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS = CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS;

/** What a registration did: the `change` of its answer and of its audit row. A closed set. */
export const CaptureAudioInputChange = { REGISTERED: 'REGISTERED', CARD_CHANGED: 'CARD_CHANGED', REENABLED: 'REENABLED' } as const;
export type CaptureAudioInputChange = (typeof CaptureAudioInputChange)[keyof typeof CaptureAudioInputChange];

/**
 * `details.reason` of the refusals of operations 98 and 99. No new error code: each is a reason on
 * an existing code. A Core that is not in production capture answers `503 NOT_READY` with
 * `CaptureDiscoveryReason.DISCOVERY_NOT_READY`, the reason of a camera search without an adapter.
 */
export const CaptureAudioCardReason = {
  // 409 INVALID_STATE
  AUDIO_CARD_SEARCH_IN_PROGRESS: 'AUDIO_CARD_SEARCH_IN_PROGRESS',
  /** The card has no input of this number. The same code as the adapter layer's named error. */
  AUDIO_INPUT_BEYOND_CARD: 'AUDIO_INPUT_BEYOND_CARD',
  /** The answerer captures from no sound card: the in-app simulator's answer to every well-formed registration. */
  AUDIO_INPUT_NOT_REGISTRABLE: 'AUDIO_INPUT_NOT_REGISTRABLE',
  // 429 RATE_LIMITED
  AUDIO_CARD_SEARCH_RATE_LIMITED: 'AUDIO_CARD_SEARCH_RATE_LIMITED',
} as const;
export type CaptureAudioCardReason = (typeof CaptureAudioCardReason)[keyof typeof CaptureAudioCardReason];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

const cardId = () => z.string().regex(CAPTURE_AUDIO_CARD_ID_PATTERN);
const deviceIndex = () => z.int().min(0).max(CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX);
const inputNumber = () => z.int().min(1).max(CAPTURE_AUDIO_CARD_MAX_CHANNELS);
const channelCount = () => z.int().min(1).max(CAPTURE_AUDIO_CARD_MAX_CHANNELS);
const sampleBits = () => z.union([z.literal(16), z.literal(24), z.literal(32)]);

/** One capture device of one sound card, as a listing found it. Not a capture device of the registry. */
export const CaptureAudioCardSchema = z
  .strictObject({
    cardId: cardId().describe('The card id in the kernel\'s own form. A request of operation 99 names a card by it.'),
    deviceIndex: deviceIndex().describe('The capture device of the card: 0 to 31.'),
    usbId: z.string().regex(CAPTURE_AUDIO_USB_ID_PATTERN).nullable().describe('Vendor and product id of a USB card, `vvvv:pppp` in lower-case hexadecimal; null for a card that is not USB.'),
    usbSerial: z
      .string()
      .regex(CAPTURE_AUDIO_USB_SERIAL_PATTERN)
      .nullable()
      .optional()
      .describe('The serial number a USB card states: letters, digits and `: . _ -`, 1 to 64 characters. Null when the card states none, or one outside this form. Untrusted device text: it tells two cards of one model apart; draw it as text only. Absent in an answer of the in-app simulator.'),
    usbPort: z
      .string()
      .regex(CAPTURE_AUDIO_USB_PORT_PATTERN)
      .nullable()
      .optional()
      .describe('The port a USB card sits on, in the kernel\'s own topological form (e.g. `0000:00:14.0-2.1`); null for a card that is not USB. Read by the Core from the kernel, never from the device. Absent in an answer of the in-app simulator.'),
    product: z
      .string()
      .regex(CAPTURE_AUDIO_CARD_TEXT_PATTERN)
      .describe('The product name the card announced. Untrusted device text: printable ASCII only, 1 to 64 characters; a name that fails the rule is replaced by a fixed word before it is answered. Draw it as text only.'),
    channelCount: channelCount().describe('The native channel count of the card: its inputs are numbered 1 to this value.'),
    sampleBits: z.array(sampleBits()).max(CAPTURE_AUDIO_SAMPLE_BITS.length).describe('The sample sizes the card offers, in bits. A closed set; never a format name of the device.'),
    registered: z
      .array(
        z.strictObject({
          inputNumber: inputNumber(),
          deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).describe('The registered microphone behind this input, e.g. `MIC-03`.'),
        }),
      )
      .max(CAPTURE_AUDIO_CARD_MAX_CHANNELS)
      .describe('The inputs of this card that are registered microphones, by input number. An input that is not listed is not registered.'),
  })
  .describe('One sound card of the Core\'s host as a listing found it (task 4, operation 98). It registers nothing and is in no slice.');
export type CaptureAudioCard = z.output<typeof CaptureAudioCardSchema>;

/** Operation 98's answer. Not stored: the next call lists again. */
export const CaptureAudioCardSearchSchema = z
  .strictObject({
    searchedAt: epochMs(),
    cards: z.array(CaptureAudioCardSchema).max(CAPTURE_AUDIO_CARD_MAX_ENTRIES).describe('One entry per capture device of a sound card. Empty when the host has none.'),
    truncated: z.boolean().describe(`True when the host has more than ${CAPTURE_AUDIO_CARD_MAX_ENTRIES} entries: a warning, not a note.`),
  })
  .describe('The sound cards of the Core\'s host as one listing found them (task 4, operation 98). Not stored.');
export type CaptureAudioCardSearch = z.output<typeof CaptureAudioCardSearchSchema>;

/**
 * Request body of operation 99: which input of which card. Three members, no text a device chose.
 * The Core reads the channel count, the USB id and the product from its own second listing.
 */
export const CaptureAudioInputRegisterRequestSchema = z
  .strictObject({
    cardId: cardId().describe('A card of the Core\'s own listing, by its card id.'),
    deviceIndex: deviceIndex().describe('The capture device of that card.'),
    inputNumber: inputNumber().describe('The input to register: 1 to the channel count of the card.'),
  })
  .describe('Request body of `POST /api/v1/capture/audio-cards/inputs` (task 4, operation 99). No product name, USB id, channel count, sample size, path or address member exists.');
export type CaptureAudioInputRegisterRequest = z.output<typeof CaptureAudioInputRegisterRequestSchema>;

/** Operation 99's answer: the microphone behind the input, and what the registration did. Ids, a code and two integers. */
export const CaptureAudioInputRegistrationSchema = z
  .strictObject({
    deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).describe('The microphone behind the input, e.g. `MIC-03`: the next free number for a new one, minted by the Core.'),
    change: z.enum(CaptureAudioInputChange).describe('REGISTERED: a new microphone. REENABLED: the input already had one; no second device was made. CARD_CHANGED: the stored input was found on a card at another place and now names that card.'),
    inputNumber: inputNumber(),
    channelCount: channelCount().describe('The native channel count the Core read from its own listing.'),
  })
  .describe('What a registration of a sound-card input did (task 4, operation 99). No device text.');
export type CaptureAudioInputRegistration = z.output<typeof CaptureAudioInputRegistrationSchema>;

/** The schemas operations 98 and 99 add (merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_AUDIO_CARD_SCHEMAS = {
  CaptureAudioCard: CaptureAudioCardSchema,
  CaptureAudioCardSearch: CaptureAudioCardSearchSchema,
  CaptureAudioInputRegisterRequest: CaptureAudioInputRegisterRequestSchema,
  CaptureAudioInputRegistration: CaptureAudioInputRegistrationSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Audit details: one builder, so the Core server and any other writer use the same keys.
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface CaptureAudioInputChangedFacts {
  deviceId: string;
  change: CaptureAudioInputChange;
  inputNumber: number;
  channelCount: number;
  permission?: string | null;
}

/**
 * `details` of CAPTURE_AUDIO_INPUT_CHANGED: four required keys and two optional ones (the closed
 * list of the Core server's `core/audit-details.ts`). A registry id, a code and two integers:
 * never a product name, a USB id or a card id.
 */
export function captureAudioInputChangedDetails(facts: CaptureAudioInputChangedFacts): Record<string, string | number | boolean> {
  return {
    deviceId: facts.deviceId,
    change: facts.change,
    inputNumber: facts.inputNumber,
    channelCount: facts.channelCount,
    operationId: 'registerCaptureAudioInput',
    ...(facts.permission ? { permission: facts.permission } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CAPTURE_AUDIO_CARD_SEARCH_PATH = `${API_BASE_PATH}/capture/audio-cards/search`;
export const CAPTURE_AUDIO_INPUT_REGISTER_PATH = `${API_BASE_PATH}/capture/audio-cards/inputs`;

/** Operations 98 and 99: CAPTURE_CONFIG on a web console session only (design addendum 4.2, "Role"). */
export const CAPTURE_AUDIO_CARD_ACCESS = { ...permissionAccess(Permission.CAPTURE_CONFIG), conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION] } as const;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;

const WEB_ONLY_REFUSED = `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`;
const WEB_AND_IDLE =
  '**Web console only, idle only.** Needs CAPTURE_CONFIG (SUPERVISOR, TECHNICIAN) and a web console session (`WEB_CONSOLE_SESSION`): a session of a tablet or a phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row. With a session open it answers `409 CAPTURE_CONFIG_LOCKED` and writes no audit row.';
const PRODUCTION_ONLY =
  `**Production capture only.** A Core whose capture is simulated, or that runs with development sources, has no sound-card adapter: it answers \`503 NOT_READY\` with \`details.reason: ${CaptureDiscoveryReason.DISCOVERY_NOT_READY}\`, the answer of a camera search without an adapter. Nothing is listed, nothing is stored and no audit row is written. That is an envelope-level answer of the contract.`;

export const CAPTURE_AUDIO_CARD_OPERATIONS = [
  {
    operationId: 'searchCaptureAudioCards',
    method: 'post',
    path: CAPTURE_AUDIO_CARD_SEARCH_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'List the sound cards',
    description: [
      'Lists the sound cards of the host the Core runs on, once, now. **No body.** No card, path, address or filter can be sent. Nothing lists in the background and nothing chooses a card: the listing happens because an operator asked for it, and it is not stored. It opens no card for capture, changes no level and registers nothing.',
      WEB_AND_IDLE,
      'Per capture device of a card the answer holds the card id, the device index, the USB id, the product name, the native channel count, the sample sizes, and the inputs that are registered microphones with their registry ids. The product name is **untrusted device text**: printable ASCII, at most 64 characters, a name that fails the rule replaced by a fixed word; a client draws it as text and trusts none of it.',
      'Writes one CAPTURE_DISCOVERY_SEARCHED row with `scope: AUDIO_CARDS`: a search id and counts, never a product name, a USB id or a card id.',
      `One listing at a time per Core: a second call while one runs answers \`409 INVALID_STATE\` with \`details.reason: ${CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS}\`. Over the spacing bound the Core answers \`429 RATE_LIMITED\` with \`retry-after\` and \`details.reason: ${CaptureAudioCardReason.AUDIO_CARD_SEARCH_RATE_LIMITED}\`: nothing is listed and no audit row is written.`,
      PRODUCTION_ONLY,
      `${SIM_V2_NOTE} The simulator reads no host: it answers a fixed list of two cards that are named as test cards, with no registered input. On a tablet or phone the simulator refuses with the same \`403\`.`,
    ].join('\n\n'),
    source: 'Task 4, blueprint row 63 (WP-07b); design addendum 4.2, operation 98; plan review P12-F05 (c), P12-F06; security addendum AD-07 (not in the design book)',
    responses: {
      200: { description: 'The sound cards as this listing found them. Not stored.', schema: 'CaptureAudioCardSearch' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG, WEB_ONLY_REFUSED),
      409: {
        description: `A session is open (CAPTURE_CONFIG_LOCKED; no audit row), or another listing is running (INVALID_STATE, \`details.reason: ${CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS}\`). Nothing is listed.`,
        schema: 'ApiError',
      },
    },
    access: CAPTURE_AUDIO_CARD_ACCESS,
    audit: { success: AuditType.CAPTURE_DISCOVERY_SEARCHED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'registerCaptureAudioInput',
    method: 'post',
    path: CAPTURE_AUDIO_INPUT_REGISTER_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Register a sound-card input as a microphone',
    description: [
      'Registers one input of one sound card as a microphone of the capture devices. The body names the card id, the device index and the input number, and nothing else. **The Core lists the cards again itself** and takes the channel count, the USB id and the product from that listing, never from the body. In one unit it writes the capture device (the next free `MIC-nn`) and its input row; a failure leaves nothing behind.',
      WEB_AND_IDLE,
      'An input that already has a microphone is **re-enabled, not duplicated**: the answer is `200` with `change: REENABLED` and the existing id. A stored input found on a card at another place answers `200` with `change: CARD_CHANGED`: it is said, never matched silently. **`CARD_CHANGED` stores the card\'s new identity and does not enable the microphone again**: the same call again answers `REENABLED`. A USB card is the stored one by its serial number where it states one (it is then found on any port) and by its port otherwise; a serial that appears or disappears is another card. A new microphone answers `201` with `change: REGISTERED`. The registration decides no role: making the microphone primary or standby is operation 80.',
      `Refusals, each storing nothing: \`404 NOT_FOUND\` when the Core's own listing has no such card and device; \`409 INVALID_STATE\` with \`details.reason: ${CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD}\` when the card has no input of that number, or \`${CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS}\` while a listing runs. The refusal never quotes the input and carries no device text.`,
      'Writes one CAPTURE_AUDIO_INPUT_CHANGED row: the device id, the change code, the input number and the channel count. No product name, no USB id and no card id. Publishes the `captureDevices` slice; `captureConfig` is not changed. The new microphone is assignable at once, without a restart.',
      PRODUCTION_ONLY,
      `${SIM_V2_NOTE} The simulator captures from no sound card and registers nothing: for a card of its fixed list it answers \`409 INVALID_STATE\` with \`details.reason: ${CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE}\` (or \`${CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD}\` for an input the test card does not have), and \`404\` for any other card. It writes no audit row and changes no state.`,
    ].join('\n\n'),
    source: 'Task 4, blueprint row 63 (WP-07b); design addendum 4.2, operation 99; plan review P12-F05 (c), P12-F06; security addendum AD-07 (not in the design book)',
    requestBody: { schema: 'CaptureAudioInputRegisterRequest', required: true },
    responses: {
      200: { description: 'The input already had a microphone: re-enabled, or found on a card at another place. No second device was made.', schema: 'CaptureAudioInputRegistration', services: CORE_SERVER_ONLY },
      201: { description: 'A new microphone was registered for the input.', schema: 'CaptureAudioInputRegistration', services: CORE_SERVER_ONLY },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG, WEB_ONLY_REFUSED),
      404: { description: 'The listing has no card of this id with this device index (NOT_FOUND). Nothing is stored.', schema: 'ApiError' },
      409: {
        description: `A session is open (CAPTURE_CONFIG_LOCKED; no audit row), or the input cannot be registered (INVALID_STATE, \`details.reason\`: ${CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD}, ${CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS}, or ${CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE} from an answerer that captures from no sound card - also for a USB card that states neither a serial number nor a port: it could not be found again). Nothing is stored.`,
        schema: 'ApiError',
      },
      422: { description: 'The body does not match its schema (INVALID_INPUT). The refusal never quotes the input. Nothing is stored.', schema: 'ApiError' },
    },
    access: CAPTURE_AUDIO_CARD_ACCESS,
    audit: { success: AuditType.CAPTURE_AUDIO_INPUT_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// The simulator's fixed listing: two cards that say what they are. The examples are its answers.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The card ids of the in-app simulator's two test cards. */
export const SIM_CAPTURE_AUDIO_CARD_IDS = { four: 'DEMS_TEST_A', two: 'DEMS_TEST_B' } as const;

/** The simulator's listing: fixed, synthetic, no USB id, no registered input. It reads no host. */
export function simCaptureAudioCards(): CaptureAudioCard[] {
  return [
    {
      cardId: SIM_CAPTURE_AUDIO_CARD_IDS.four,
      deviceIndex: 0,
      usbId: null,
      product: 'DEMS test sound card A (simulated)',
      channelCount: 4,
      sampleBits: [16, 24],
      registered: [],
    },
    {
      cardId: SIM_CAPTURE_AUDIO_CARD_IDS.two,
      deviceIndex: 0,
      usbId: null,
      product: 'DEMS test sound card B (simulated)',
      channelCount: 2,
      sampleBits: [16],
      registered: [],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const refusal = (summary: string, code: string, message: string, details?: Record<string, string>) => ({ summary, value: apiErrorExample(code, message, details) });
const LOCKED = refusal('A session is open', 'CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.', { simCode: 'CAPTURE_CONFIG_LOCKED' });
const webConsoleOnly = (operationId: string) => ({
  summary: 'A tablet or phone session on a web-console-only operation',
  description: 'The caller holds CAPTURE_CONFIG, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
  value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
    operationId,
    permission: Permission.CAPTURE_CONFIG,
    role: 'TECHNICIAN',
    reason: WEB_CONSOLE_ONLY_REASON,
  }),
});
const EXAMPLE_REGISTER_REQUEST = { cardId: SIM_CAPTURE_AUDIO_CARD_IDS.four, deviceIndex: 0, inputNumber: 1 } as const satisfies CaptureAudioInputRegisterRequest;

export const CAPTURE_AUDIO_CARD_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  searchCaptureAudioCards: {
    responses: {
      200: {
        simulated: {
          summary: 'The simulator\'s fixed listing: two test cards, no registered input',
          value: { searchedAt: EXAMPLE_INSTANT_MS, cards: simCaptureAudioCards(), truncated: false } satisfies CaptureAudioCardSearch,
        },
        registered: {
          summary: 'A USB card whose first input is a registered microphone',
          value: {
            searchedAt: EXAMPLE_INSTANT_MS,
            cards: [
              {
                cardId: 'EXAMPLE_CARD',
                deviceIndex: 0,
                usbId: '0000:0000',
                product: 'Example USB audio interface',
                channelCount: 8,
                sampleBits: [16, 24],
                registered: [{ inputNumber: 1, deviceId: 'MIC-03' }],
              },
            ],
            truncated: false,
          } satisfies CaptureAudioCardSearch,
        },
      },
      401: SIGNED_OUT,
      403: { ...deniedExamples('searchCaptureAudioCards', 'CAPTURE_CONFIG', 'INVESTIGATOR'), webConsoleOnly: webConsoleOnly('searchCaptureAudioCards') },
      409: {
        locked: LOCKED,
        inProgress: refusal('Another listing is running', 'INVALID_STATE', 'The sound cards are being listed. Try again shortly.', {
          reason: CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS,
        }),
      },
    },
  },
  registerCaptureAudioInput: {
    request: {
      firstInput: { summary: 'The first input of a card of the listing', value: EXAMPLE_REGISTER_REQUEST },
    },
    responses: {
      200: {
        reenabled: {
          summary: 'The input already had a microphone: no second device',
          value: { deviceId: 'MIC-03', change: CaptureAudioInputChange.REENABLED, inputNumber: 1, channelCount: 8 } satisfies CaptureAudioInputRegistration,
        },
      },
      201: {
        registered: {
          summary: 'A new microphone',
          value: { deviceId: 'MIC-03', change: CaptureAudioInputChange.REGISTERED, inputNumber: 1, channelCount: 8 } satisfies CaptureAudioInputRegistration,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: { ...deniedExamples('registerCaptureAudioInput', 'CAPTURE_CONFIG', 'INVESTIGATOR'), webConsoleOnly: webConsoleOnly('registerCaptureAudioInput') },
      404: { notFound: refusal('No such card in the listing', 'NOT_FOUND', 'No sound card has this ID.', { simCode: 'NOT_FOUND' }) },
      409: {
        locked: LOCKED,
        beyondCard: refusal('The card has no input of this number', 'INVALID_STATE', 'The sound card has no such input.', {
          reason: CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD,
        }),
        notRegistrable: refusal('The simulator registers no sound-card input', 'INVALID_STATE', 'A sound-card input can be registered on a production Core only.', {
          reason: CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE,
        }),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
