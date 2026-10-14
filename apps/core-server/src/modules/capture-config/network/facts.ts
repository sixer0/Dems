/**
 * THE NETWORK FACTS OF THE CORE HOST, AS THE DESTINATION RULE TAKES THEM (task 4 blueprint row 108,
 * package WP-19d; decisions C55, C60 (4), U11; the request of row 85b).
 *
 * Two sources, joined at EVERY judgement:
 *   - the STORED choice of the technician: `interface_name` and `camera_subnet` of the one row of
 *     `capture_network_config`. THE CORE NEVER CHOOSES either; a row without both is "not
 *     configured" and the answer is null;
 *   - the interface list of the host, read through an INJECTED reader (the product's is
 *     `readHostInterfaces`: the operating system's own table, read synchronously).
 *
 * WHAT IS BUILT FROM THEM (`DestinationContext` of `capture/destination-rule.ts`):
 *   cameraSubnet            the stored subnet, as written; the rule itself holds it to its bounds
 *   cameraAddresses         the IPv4 addresses the camera interface holds: inside the subnet = its
 *                           own; outside it and private = a temporary address (`alias: true`);
 *                           anything else it holds (link-local) is a host address and no source
 *   otherInterfaceSubnets   the subnet of every IPv4 address of every OTHER interface (DR-4)
 *   hostAddresses           every IPv4 address of the host
 *   allowedPorts            the STORED list `onvif_ports` (row V7b; S2-02, C116), in its order
 *
 * NULL - and the rule then refuses every address - when no row is stored, when the interface or
 * the subnet is not chosen, when the host has no interface of that name (or it is a loopback
 * interface), or when a fact of the host cannot be read as an address with a prefix length. This
 * file never guesses a subnet, a source or an interface.
 *
 * THE FORMS OF A WRITE are asked of the rule itself (`cameraSubnetAccepted`,
 * `factoryAddressAccepted`): the stored-address binding of the capture unit is asked about ONE
 * address on a host that holds nothing, and only the rule's own answer "the form is good, no
 * source is there" passes. No range and no bound is restated here for a decision; the three
 * private ranges below only sort an address the camera interface ALREADY holds into "alias" or
 * "no source", and the rule reads the result again.
 */
import { networkInterfaces } from 'node:os';
import { storedCameraAddressRuleOf, type DestinationContext } from '../../../capture/fence';

/** One IPv4 address an interface holds, with the prefix length of its subnet. */
export interface HostInterfaceAddress {
  readonly address: string;
  readonly prefixLength: number;
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
      addresses.push({ address: entry.address, prefixLength: stated === null ? prefixOfMask(entry.netmask) : Number(stated[2]) });
    }
    interfaces.push({ name, internal: entries.length > 0 && entries.every((entry) => entry.internal), addresses });
  }
  return interfaces;
};

/** True when the host has an interface of this name that is no loopback interface: the ONE check of a chosen interface. */
export function hostHoldsInterface(interfaces: readonly HostInterface[], name: string): boolean {
  return interfaces.some((entry) => entry.name === name && !entry.internal);
}

/**
 * THE JOIN. The stored choice with the host's interfaces as the rule's context, or null (see the
 * file header). Pure: the caller passes both.
 */
export function networkFactsOf(stored: StoredNetworkChoice | null, interfaces: readonly HostInterface[]): DestinationContext | null {
  if (stored === null || stored.interfaceName === null || stored.cameraSubnet === null) return null;
  const subnet = subnetOf(stored.cameraSubnet);
  if (subnet === null || !Array.isArray(interfaces) || !hostHoldsInterface(interfaces, stored.interfaceName)) return null;
  // A stored port list that is no list: the facts are unknown (the rule holds the list's own bounds itself, `PORT_LIST_INVALID`).
  if (!Array.isArray(stored.onvifPorts)) return null;

  const cameraAddresses: { address: string; alias: boolean }[] = [];
  const otherInterfaceSubnets = new Map<string, { network: string; prefixLength: number }>();
  const hostAddresses: string[] = [];
  for (const entry of interfaces) {
    if (!Array.isArray(entry.addresses)) return null;
    for (const held of entry.addresses) {
      const value = quad(held.address);
      if (value === null || !isPrefix(held.prefixLength)) return null;
      const address = dotted(value);
      hostAddresses.push(address);
      if (entry.name !== stored.interfaceName) {
        const network = dotted(networkOf(value, held.prefixLength));
        otherInterfaceSubnets.set(`${network}/${String(held.prefixLength)}`, { network, prefixLength: held.prefixLength });
      } else if (networkOf(value, subnet.prefixLength) === subnet.value) {
        cameraAddresses.push({ address, alias: false });
      } else if (isPrivate(value)) {
        cameraAddresses.push({ address, alias: true });
      }
    }
  }
  return Object.freeze({
    cameraSubnet: Object.freeze({ network: subnet.network, prefixLength: subnet.prefixLength }),
    cameraAddresses: Object.freeze(cameraAddresses.map((entry) => Object.freeze(entry))),
    otherInterfaceSubnets: Object.freeze([...otherInterfaceSubnets.values()].map((entry) => Object.freeze(entry))),
    hostAddresses: Object.freeze(hostAddresses),
    allowedPorts: Object.freeze([...stored.onvifPorts]),
  });
}

/** The rule's word for "the form is good; this host has no source for it": the only answer a form check lets pass. */
const FORM_ACCEPTED = 'NO_CAMERA_SOURCE';

/** The rule's own answer on ONE address inside `subnet`, on a host that holds nothing. */
function formAccepted(subnet: { readonly network: string; readonly prefixLength: number }, address: string): boolean {
  const decision = storedCameraAddressRuleOf(() => ({ cameraSubnet: subnet, cameraAddresses: [], otherInterfaceSubnets: [], hostAddresses: [] }))(address, undefined);
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
