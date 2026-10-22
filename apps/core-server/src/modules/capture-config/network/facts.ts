/**
 * THE NETWORK FACTS OF THE CORE HOST, AS THE DESTINATION RULE TAKES THEM (task 4 blueprint row 108,
 * package WP-19d; decisions C55, C60 (4), U11; the request of row 85b).
 *
 * Two sources, joined at EVERY judgement:
 *   - the STORED choice of the technician: `interface_name` and `camera_subnet` of the one row of
 *     `capture_network_config`. THE CORE NEVER CHOOSES either. Since R-FLEX (row 105; spec B1,
 *     RF-N3) a row without both - or no row at all - is still a context: "not configured" then
 *     means `cameraSubnet: null` (COMMISSIONING_SCAN and SET_IP refuse `NOT_CONFIGURED`), while
 *     TYPED_PROBE and STORED_CAMERA judge on `interfaceSubnets`;
 *   - the interface list of the host, read through an INJECTED reader (the product's is
 *     `readHostInterfaces`: the operating system's own table, read synchronously).
 *
 * WHAT IS BUILT FROM THEM (`DestinationContext` of `capture/destination-rule.ts`):
 *   cameraSubnet            the stored subnet, as written; the rule itself holds it to its bounds
 *   cameraAddresses         the IPv4 addresses the camera interface holds: inside the subnet = its
 *                           own; outside it and private = a temporary address (`alias: true`);
 *                           anything else it holds (link-local) is a host address and no source
 *   otherInterfaceSubnets   the subnet of every IPv4 address of every OTHER interface (DR-4);
 *                           with no usable camera interface, of every interface (O-6: kept)
 *   interfaceSubnets        NW-C1 (row 105): every IPv4 address of every ELIGIBLE interface, the
 *                           camera interface included, with name, address, network and prefix
 *                           length, in the host's order. Eligible = the discovery test (RG-13):
 *                           not loopback, prefix neither /0 nor /32, hardware address of THAT
 *                           address stated and not all zero (tunnels and VPN devices have none;
 *                           an address whose hardware address the reader did not state is left
 *                           out: unknown is not eligible)
 *   hostAddresses           every IPv4 address of the host, eligible or not
 *   allowedPorts            the STORED list `onvif_ports` (row V7b; S2-02, C116), in its order;
 *                           with no row, the column's default [80] (= `DESTINATION_DEFAULT_PORTS`)
 *
 * THE CAMERA PART (`cameraSubnet`, `cameraAddresses`) is filled only when the interface AND the
 * subnet are chosen, the subnet reads as `a.b.c.d/n` and the host has a non-loopback interface of
 * that name; otherwise `cameraSubnet` is null and `cameraAddresses` empty - so the bound purposes
 * keep their old answer `NOT_CONFIGURED` (Q96-04 a).
 *
 * NULL - and the rule then refuses every address (RF-N7, O-5) - only when the host's facts cannot
 * be read: the list is no list, an interface's addresses are no list, an address is no IPv4
 * address with a prefix length; or the stored port list is no list. This file never guesses a
 * subnet, a source or an interface.
 *
 * THE FORMS OF A WRITE are asked of the rule itself (`cameraSubnetAccepted`,
 * `factoryAddressAccepted`): the SET_IP binding of the capture fence (`cameraNetworkDialRuleOf`,
 * C4; RF-N8 - STORED_CAMERA is global since R-FLEX and no longer reads the camera subnet) is asked
 * about ONE address on a host that holds nothing, and only the rule's own answer "the form is
 * good, no source is there" passes. No range and no bound is restated here for a decision; the three
 * private ranges below only sort an address the camera interface ALREADY holds into "alias" or
 * "no source", and the rule reads the result again.
 */
import { networkInterfaces } from 'node:os';
import { CAPTURE_NETWORK_CONFIG_DEFAULTS } from '@dems/shared/api';
import { cameraNetworkDialRuleOf, type DestinationContext } from '../../../capture/fence';

/** One IPv4 address an interface holds, with the prefix length of its subnet. */
export interface HostInterfaceAddress {
  readonly address: string;
  readonly prefixLength: number;
  /**
   * The hardware address the operating system states for THIS address (row 105, RG-13), as it
   * states it (`aa:bb:cc:dd:ee:ff`). All zero for tunnels and loopback. Left out: not stated, and
   * the address is then no candidate source of `interfaceSubnets`.
   */
  readonly mac?: string;
}

/** One network interface of the host that holds at least one address. Only its IPv4 addresses are listed. */
export interface HostInterface {
  readonly name: string;
  /** True for a loopback interface. */
  readonly internal: boolean;
  readonly addresses: readonly HostInterfaceAddress[];
}

/** The interface list of the host, NOW. Synchronous: it is asked at every judgement. It may throw; the caller refuses then. */
export type HostInterfacesReader = () => readonly HostInterface[];

/** What the reader needs of the stored row. */
export interface StoredNetworkChoice {
  readonly interfaceName: string | null;
  readonly cameraSubnet: string | null;
  /**
   * `onvif_ports` (row V7b; S2-02, C116): the STORED list of allowed ONVIF ports, handed to the rule as
   * `allowedPorts`. Before this row no production file set `allowedPorts` and the rule always used its
   * own `DESTINATION_DEFAULT_PORTS` ([80]); now the stored list is what the rule judges a port by.
   */
  readonly onvifPorts: readonly number[];
}

const QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
const SUBNET = /^([0-9.]{7,15})\/(\d{1,2})$/;

/** One strict dotted quad as a number, or null. */
function quad(text: unknown): number | null {
  const match = typeof text === 'string' ? QUAD.exec(text) : null;
  if (match === null) return null;
  let value = 0;
  for (let part = 1; part <= 4; part += 1) {
    const octet = Number(match[part]);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}
const dotted = (value: number): string => [Math.floor(value / 16_777_216) % 256, Math.floor(value / 65_536) % 256, Math.floor(value / 256) % 256, value % 256].join('.');
const blockOf = (prefixLength: number): number => 2 ** (32 - prefixLength);
const networkOf = (value: number, prefixLength: number): number => value - (value % blockOf(prefixLength));
const isPrefix = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 32;
/** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16: only to sort an address the camera interface already holds. */
const isPrivate = (value: number): boolean => networkOf(value, 8) === 10 * 16_777_216 || networkOf(value, 12) === 172 * 16_777_216 + 16 * 65_536 || networkOf(value, 16) === 192 * 16_777_216 + 168 * 65_536;

/** `a.b.c.d/n` as the rule's subnet, or null for a text of another shape. The bounds are the rule's. */
function subnetOf(text: unknown): { readonly network: string; readonly prefixLength: number; readonly value: number } | null {
  const match = typeof text === 'string' ? SUBNET.exec(text) : null;
  if (match === null) return null;
  const value = quad(match[1]);
  const prefixLength = Number(match[2]);
  if (value === null || !isPrefix(prefixLength)) return null;
  return { network: dotted(value), prefixLength, value };
}

/** The prefix length a netmask states, or -1 for a mask that is no run of ones. */
function prefixOfMask(netmask: unknown): number {
  const value = quad(netmask);
  if (value === null) return -1;
  for (let prefixLength = 0; prefixLength <= 32; prefixLength += 1) {
    if (value === 4_294_967_296 - blockOf(prefixLength)) return prefixLength;
  }
  return -1;
}

/**
 * THE PRODUCT'S READER: the interface table of the operating system. An interface without any
 * address is not in that table, so it cannot be chosen until it holds one. A prefix length that
 * cannot be read is stated as -1: the facts are then unknown and every address is refused.
 */
export const readHostInterfaces: HostInterfacesReader = () => {
  const interfaces: HostInterface[] = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    if (entries === undefined) continue;
    const addresses: HostInterfaceAddress[] = [];
    for (const entry of entries) {
      // The family is the text `IPv4`; one release line of the runtime answered the number 4.
      if (entry.family !== 'IPv4' && (entry.family as unknown) !== 4) continue;
      const stated = entry.cidr === null ? null : SUBNET.exec(entry.cidr);
      addresses.push({ address: entry.address, prefixLength: stated === null ? prefixOfMask(entry.netmask) : Number(stated[2]), mac: entry.mac });
    }
    interfaces.push({ name, internal: entries.length > 0 && entries.every((entry) => entry.internal), addresses });
  }
  return interfaces;
};

/** True when the host has an interface of this name that is no loopback interface: the ONE check of a chosen interface. */
export function hostHoldsInterface(interfaces: readonly HostInterface[], name: string): boolean {
  return interfaces.some((entry) => entry.name === name && !entry.internal);
}

/** A hardware address with at least one digit that is not zero: the discovery test (`discovery-collector.ts` `selectInterfaces`). */
const NONZERO_HARDWARE = /[1-9a-f]/i;

/**
 * RG-13: an address of an interface that discovery would search from - not loopback, a prefix
 * that is neither /0 nor /32, a stated hardware address that is not all zero. By property, never
 * by name.
 */
function eligible(entry: HostInterface, held: HostInterfaceAddress): boolean {
  return entry.internal !== true && held.prefixLength !== 0 && held.prefixLength !== 32 && typeof held.mac === 'string' && NONZERO_HARDWARE.test(held.mac);
}

/**
 * THE JOIN. The stored choice with the host's interfaces as the rule's context, or null for
 * unreadable facts only (see the file header). Pure: the caller passes both. `stored` null: no
 * row is stored.
 */
export function networkFactsOf(stored: StoredNetworkChoice | null, interfaces: readonly HostInterface[]): DestinationContext | null {
  if (!Array.isArray(interfaces)) return null;
  // A stored port list that is no list: the facts are unknown (the rule holds the list's own bounds itself, `PORT_LIST_INVALID`).
  if (stored !== null && !Array.isArray(stored.onvifPorts)) return null;
  const allowedPorts = stored === null ? CAPTURE_NETWORK_CONFIG_DEFAULTS.onvifPorts : stored.onvifPorts;

  // The camera part: only for a complete choice on an interface this host has (Q96-04 a: the bound purposes unchanged).
  const subnet = stored === null || stored.interfaceName === null || stored.cameraSubnet === null ? null : subnetOf(stored.cameraSubnet);
  const cameraInterface = subnet !== null && stored !== null && stored.interfaceName !== null && hostHoldsInterface(interfaces, stored.interfaceName) ? stored.interfaceName : null;

  const cameraAddresses: { address: string; alias: boolean }[] = [];
  const otherInterfaceSubnets = new Map<string, { network: string; prefixLength: number }>();
  const interfaceSubnets: { name: string; address: string; network: string; prefixLength: number }[] = [];
  const hostAddresses: string[] = [];
  for (const entry of interfaces) {
    if (entry === null || typeof entry !== 'object' || !Array.isArray(entry.addresses)) return null;
    for (const held of entry.addresses) {
      const value = quad(held?.address);
      if (value === null || !isPrefix(held.prefixLength)) return null;
      const address = dotted(value);
      const network = dotted(networkOf(value, held.prefixLength));
      hostAddresses.push(address);
      if (eligible(entry, held)) interfaceSubnets.push({ name: entry.name, address, network, prefixLength: held.prefixLength });
      if (cameraInterface === null || entry.name !== cameraInterface) {
        otherInterfaceSubnets.set(`${network}/${String(held.prefixLength)}`, { network, prefixLength: held.prefixLength });
      } else if (subnet !== null && networkOf(value, subnet.prefixLength) === subnet.value) {
        cameraAddresses.push({ address, alias: false });
      } else if (isPrivate(value)) {
        cameraAddresses.push({ address, alias: true });
      }
    }
  }
  return Object.freeze({
    cameraSubnet: cameraInterface === null || subnet === null ? null : Object.freeze({ network: subnet.network, prefixLength: subnet.prefixLength }),
    cameraAddresses: Object.freeze(cameraAddresses.map((entry) => Object.freeze(entry))),
    otherInterfaceSubnets: Object.freeze([...otherInterfaceSubnets.values()].map((entry) => Object.freeze(entry))),
    interfaceSubnets: Object.freeze(interfaceSubnets.map((entry) => Object.freeze(entry))),
    hostAddresses: Object.freeze(hostAddresses),
    allowedPorts: Object.freeze([...allowedPorts]),
  });
}

/** The rule's word for "the form is good; this host has no source for it": the only answer a form check lets pass. */
const FORM_ACCEPTED = 'NO_CAMERA_SOURCE';

/** The SET_IP binding (C4): bound to the camera subnet, so it still reads the subnet's form (RF-N8). */
const SET_IP_RULE = cameraNetworkDialRuleOf();

/** The rule's own answer on ONE address inside `subnet`, on a host that holds nothing (purpose SET_IP, RF-N8). */
function formAccepted(subnet: { readonly network: string; readonly prefixLength: number }, address: string): boolean {
  const decision = SET_IP_RULE(address, { cameraSubnet: subnet, cameraAddresses: [], otherInterfaceSubnets: [], hostAddresses: [] });
  return !decision.allowed && decision.refusal === FORM_ACCEPTED;
}

/**
 * A camera subnet AS THE RULE ACCEPTS IT: a private IPv4 network, prefix length inside the rule's
 * bounds, no host bit set. Asked of the rule about the first address after the network address.
 */
export function cameraSubnetAccepted(text: string): boolean {
  const subnet = subnetOf(text);
  return subnet !== null && subnet.value % 256 !== 255 && formAccepted(subnet, dotted(subnet.value + 1));
}

/** A factory address AS THE RULE CLASSES IT: one strict private IPv4 literal. Asked of the rule inside the address's own /24. */
export function factoryAddressAccepted(text: string): boolean {
  const value = quad(text);
  return value !== null && value % 256 !== 0 && value % 256 !== 255 && formAccepted({ network: dotted(networkOf(value, 24)), prefixLength: 24 }, text);
}
