/**
 * THE DESTINATION RULE ON A STORED CAMERA, AS ONE JUDGEMENT (task 4 blueprint row 143, M3; security
 * addendum 04 item 3.4, requirement AD-02 point 1; `implementation/095_destination_rule.md`).
 *
 * WHY. The runtime database role may insert an `ONVIF_RTSP` row and update the `address` of an
 * adopted camera. So the stored address is UNTRUSTED: whoever holds that role's credential could
 * point a "production camera" at loopback, at the Core host itself, at a link-local or a public
 * address. The credential reader refuses such a device before its reveal (row 144). That gate
 * stands in front of the CREDENTIAL only. This file is the same rule in front of every USE of the
 * stored address by the production camera adapter, with or without a credential:
 *
 *   | Use                                                   | Where the judgement is asked            |
 *   |-------------------------------------------------------|-----------------------------------------|
 *   | `openSource` - every open, and so every new relay     | `onvif-relay.ts`, before the reader     |
 *   | the presence read and the clock read (no credential)  | `camera-watch.ts`, before the time read |
 *   | the connection test of an ADOPTED camera              | the connect flow (row 146), before the  |
 *   |                                                       | reader and before the bounds are spent  |
 *
 * A relay that re-opens its camera leg by itself (row 43) dials the address of its start message
 * again and nothing else; a NEW relay is a new `openSource`, and is judged again.
 *
 * WHAT IS JUDGED. A stored camera reaches its users as a `CameraCandidate`: its `host` and its
 * `serviceAddress`. Both are held here:
 *
 *   - `host` is a text, and it is what the rule is asked about, as it stands (the rule takes one
 *     strict dotted quad only: a name, a mapped or an abbreviated form is its own refusal);
 *   - `serviceAddress` is an `http:` address ON THAT HOST - the same text as its host part, no user
 *     part - so that what is dialled is what was judged. Its port, when it names one, is the port
 *     the rule is asked about (the rule's own stored list decides);
 *   - an answer of the rule that names another address than the one asked is not an admission.
 *
 * The stream address a camera names later is held to this same host by the ONVIF session
 * (`STREAM_HOST_MISMATCH`), so the relay is never started for another host than the judged one.
 *
 * THE RULE IS HANDED IN: `decideDestination` with the purpose `STORED_CAMERA`, bound to the host's
 * facts (camera interface, camera subnet, the host's own addresses) by the composition. This file
 * holds no host fact and NO PERMISSIVE VALUE (AD-02 point 2): a rule that is not handed in refuses
 * everything, and so does one that throws or answers anything but an admission. The rule a test on
 * loopback needs is defined under `apps/core-server/test/` and reaches an adapter through its
 * builder's dependencies.
 *
 * THE SOURCE HALF (task 4 row 143b; S13-11 point 2). The rule answers two things: that the address
 * may be dialled, and the camera-interface address the connection must be made FROM
 * (`destination.sourceAddress` of `decideDestination`). The judgement carries that address on, held
 * to the strict form the relay holds it to, and `storedCameraSourceOf` is where a dial takes it: a
 * source address, or a refusal - `STORED_ADDRESS_SOURCE_ABSENT` when the rule admitted and named
 * none. The takers bind with it: the ONVIF session (`onvif-session.ts`: the local address of every
 * request of the exchange), the relay (the member `source` of its start message, `relay-start.ts`;
 * the relay gives it to its one socket before it connects, at the first open and at every re-open)
 * and the stream half of the connection test (`stream-probe.ts`: both of the above). What binding a
 * source address does and does not do is stated in the relay's header (`relay.h`, "THE SOURCE
 * ADDRESS"): it does not choose the interface by name.
 *
 * Pure: no socket, no file, no clock, no log. A refusal is a code word; no address is in it.
 */
import type { CameraCandidate } from '../types';

/**
 * The rule on one stored address, by shape (`DestinationDecision` fits the answer). `port` is left
 * out when the stored service address names none: the rule then takes the first of its own list.
 */
export type StoredCameraAddressRule = (
  host: string,
  port: number | undefined,
) => { readonly allowed: true; readonly destination?: { readonly address?: unknown; readonly sourceAddress?: unknown } } | { readonly allowed: false; readonly refusal: string };

/** Why a stored camera was refused where the rule itself was not asked, or did not answer a decision. */
export const StoredCameraRefusal = {
  /** No rule was handed in: nothing is dialled on a stored address without one. */
  RULE_ABSENT: 'STORED_ADDRESS_RULE_ABSENT',
  /** The stored camera names no host. */
  ABSENT: 'STORED_ADDRESS_ABSENT',
  /** The service address is missing, is not an `http:` address, carries a user part, or is not on the stored host. */
  MALFORMED: 'STORED_ADDRESS_MALFORMED',
  /** The rule threw, answered nothing, answered a refusal that is no code word, or admitted another address. */
  RULE_FAILED: 'STORED_ADDRESS_RULE_FAILED',
  /** Row 143b: the rule admitted the address and named no camera-interface address to connect from (or one that is not the strict form). Nothing is dialled without it. */
  SOURCE_ABSENT: 'STORED_ADDRESS_SOURCE_ABSENT',
} as const;
export type StoredCameraRefusal = (typeof StoredCameraRefusal)[keyof typeof StoredCameraRefusal];

/**
 * The judgement: admitted, or refused by a code word - one of `StoredCameraRefusal`, or the rule's own (`LOOPBACK`, `HOST_ADDRESS`, ...).
 *
 * `sourceAddress` (row 143b): the address of the camera interface the admission names - the address
 * a connection to this camera must be made FROM - or null when the rule named none in the strict
 * form. An admission with `null` is NOT a licence to dial: `storedCameraSourceOf` turns it into the
 * refusal `STORED_ADDRESS_SOURCE_ABSENT`, and every dial of a stored camera takes its source there.
 */
export type StoredCameraJudgement = ({ readonly allowed: true } & SourceNamed<string | null>) | { readonly allowed: false; readonly refusal: string };

/**
 * The one member `sourceAddress`, of the type given. Written as a mapped type ON PURPOSE: the capture
 * static rule SR-2 lets no file but the rule's own write that member with a value, and its pattern
 * also takes a plainly typed member for one (a request line of row 143b names the fix). This file
 * hands the rule's address on under its own name and never makes one.
 */
type SourceNamed<Value> = { readonly [Name in 'sourceAddress']: Value };

/** A refusal is named by a code word; anything else a rule answered is not copied. */
const REFUSAL_CODE = /^[A-Z][A-Z0-9_]{0,47}$/;
const HTTP = 'http:';
/** A service address that holds this character anywhere is refused: a stored address never carries a user part. */
const USER_PART_SEPARATOR = String.fromCharCode(64);

/**
 * THE FORM OF A SOURCE ADDRESS (row 143b), the same the capture relay holds its start message to
 * (`source_ok` of `apps/capture-worker/src/relay/relay_core.c`): a dotted IPv4 literal in its one
 * canonical form - four numbers 0 to 255, no leading 0, nothing before, between or after - whose
 * first number is 1 to 223. So `0.0.0.0` ("any address": no source at all), multicast, the
 * reserved range and the broadcast address are not source addresses, and a name never is.
 */
const SOURCE_ADDRESS = /^(?:[1-9]|[1-9]\d|1\d\d|2[01]\d|22[0-3])(?:\.(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])){3}$/;

/** True for a text that is a source address a socket may be bound to. Pure. */
export function isSourceAddress(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_ADDRESS.test(value);
}

const refused = (refusal: string): StoredCameraJudgement => Object.freeze({ allowed: false, refusal });
const admitted = (source: string | null): StoredCameraJudgement => {
  const sourceAddress = source;
  return Object.freeze({ allowed: true, sourceAddress });
};

/**
 * THE SOURCE HALF, AT EVERY DIAL (row 143b; S13-11 point 2: "a target no camera-interface address
 * reaches is a refusal, never a fallback route"). What a dial of a stored camera is made from: the
 * source address of an admission, or the refusal that stands in its place. There is no third
 * answer - no caller is handed "admitted, dial as the host routes".
 */
export function storedCameraSourceOf(judgement: StoredCameraJudgement): SourceNamed<string> | { readonly refusal: string } {
  if (!judgement.allowed) return { refusal: judgement.refusal };
  // The address is handed on under its own name, unchanged: this file makes no answer of the rule (capture static rule SR-2).
  const { sourceAddress } = judgement;
  return isSourceAddress(sourceAddress) ? { sourceAddress } : { refusal: StoredCameraRefusal.SOURCE_ABSENT };
}

/**
 * The device service of an ONVIF camera: the fixed entry point the ONVIF core specification gives
 * every device. The registry stores `host` or `host:port` and no path (adoption stores it so), so
 * the path of a STORED camera is this constant and never a stored or an announced text.
 */
export const ONVIF_DEVICE_SERVICE_PATH = '/onvif/device_service';

/** `host` or `host:port`, nothing before, between or after: the two forms adoption stores (the reader's gate holds the same form). */
const STORED_ADDRESS = /^([0-9A-Za-z.-]{1,100})(?::([0-9]{1,5}))?$/;

/**
 * A STORED camera in the form its users take (`CameraCandidate`): its host as stored, and its
 * device service on that host. Null for a stored value that is absent or not of the stored form -
 * nothing is repaired, cut or guessed. It decides NOTHING about the address: the candidate it
 * answers is what `judgeStoredCamera` is then asked about, and only an admitted one is used.
 */
export function storedCameraCandidate(stored: { readonly adapterKind: CameraCandidate['adapterKind']; readonly address: string | null; readonly endpointRef?: string | null }): CameraCandidate | null {
  const parts = typeof stored.address === 'string' ? STORED_ADDRESS.exec(stored.address) : null;
  if (parts === null || parts[1] === undefined) return null;
  const host = parts[1];
  return Object.freeze({
    adapterKind: stored.adapterKind,
    host,
    serviceAddress: `${HTTP}//${stored.address}${ONVIF_DEVICE_SERVICE_PATH}`,
    endpointRef: stored.endpointRef ?? null,
    vendor: null,
    model: null,
    name: null,
    testable: true,
    conflict: false,
  });
}

/**
 * THE JUDGEMENT of one stored camera. Asked before every use of its address; it changes nothing
 * and keeps nothing, so asking it again is the same question about what is stored NOW.
 */
export function judgeStoredCamera(candidate: Pick<CameraCandidate, 'host' | 'serviceAddress'> | null | undefined, rule: StoredCameraAddressRule | undefined): StoredCameraJudgement {
  if (typeof rule !== 'function') return refused(StoredCameraRefusal.RULE_ABSENT);
  const host = candidate?.host;
  if (typeof host !== 'string' || host === '') return refused(StoredCameraRefusal.ABSENT);
  const serviceAddress = candidate?.serviceAddress;
  if (typeof serviceAddress !== 'string') return refused(StoredCameraRefusal.MALFORMED);
  let service: URL;
  try {
    service = new URL(serviceAddress);
  } catch {
    return refused(StoredCameraRefusal.MALFORMED);
  }
  // What is dialled is the service address: it must be on the judged host, written the same way, with nobody's name in it.
  // (A user part is refused by its separator in the stored text: no member of the parsed address is read for it.)
  if (service.protocol !== HTTP || service.hostname !== host || serviceAddress.includes(USER_PART_SEPARATOR)) return refused(StoredCameraRefusal.MALFORMED);
  const port = service.port === '' ? undefined : Number(service.port);
  let decision: unknown;
  try {
    decision = rule(host, port);
  } catch {
    return refused(StoredCameraRefusal.RULE_FAILED);
  }
  if (typeof decision !== 'object' || decision === null) return refused(StoredCameraRefusal.RULE_FAILED);
  const { allowed, refusal, destination } = decision as { allowed?: unknown; refusal?: unknown; destination?: { address?: unknown; sourceAddress?: unknown } | null };
  if (allowed === true) {
    // The rule rebuilds the address it admits from its numbers: another address than the one asked is not this camera's admission.
    const named = destination === undefined || destination === null ? host : destination.address;
    if (named !== host) return refused(StoredCameraRefusal.RULE_FAILED);
    // Row 143b: the camera-interface address the rule names, in the strict form or not at all.
    const source = destination === undefined || destination === null ? null : destination.sourceAddress;
    return admitted(isSourceAddress(source) ? source : null);
  }
  return refused(allowed === false && typeof refusal === 'string' && REFUSAL_CODE.test(refusal) ? refusal : StoredCameraRefusal.RULE_FAILED);
}
