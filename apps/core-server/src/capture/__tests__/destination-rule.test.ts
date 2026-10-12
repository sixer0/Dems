// The one destination rule (task 4 blueprint row 95, M8 / WP-19c; security finding S13-11 points
// 1 to 4 and its set-IP paragraph; S13-08 point 2; security addendum AD-02): THE TARGET TABLE.
//
// One row per bound, and every refusal by its own name. The function is pure, so "refused before
// any packet is built" is held in two ways: the answer of a refusal carries a code and nothing
// else, and the file imports no module that could send anything (last block).
//
// EVERY REFUSAL HAS ITS CONTROL: the first block passes an address through the same calls.
import { readFileSync } from 'node:fs';
import { CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS, CAPTURE_DISCOVERY_MIN_INTERVAL_MS } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_ADDRESS_MODE,
  DESTINATION_DEFAULT_PORTS,
  DESTINATION_MAX_PORTS,
  DESTINATION_MIN_INTERVAL_MS,
  DestinationPurpose,
  DestinationRefusal,
  DestinationSpacing,
  SCAN_MAX_STORED_ADDRESSES,
  SCAN_MAX_TYPED_ADDRESSES,
  ScanSizeRefusal,
  decideDestination,
  decideNewCameraAddress,
  scanSizeRefusal,
  spacingAllowance,
  type DestinationContext,
  type NewCameraAddressContext,
} from '../destination-rule';

/**
 * The host of the table: the camera interface holds 192.168.50.1 in the camera subnet
 * 192.168.50.0/24 and one temporary alias 192.168.1.253 (the factory network); the office
 * interface holds 10.20.0.15 in 10.20.0.0/16.
 */
const HOST: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [
    { address: '192.168.50.1', alias: false },
    { address: '192.168.1.253', alias: true },
  ],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
  hostAddresses: ['10.20.0.15', '192.168.50.1', '192.168.1.253'],
};

const ALL_PURPOSES = Object.values(DestinationPurpose);
const decide = (address: unknown, purpose: DestinationPurpose = DestinationPurpose.STORED_CAMERA, port?: unknown, context: DestinationContext = HOST) =>
  decideDestination(port === undefined ? { purpose, address } : { purpose, address, port }, context);
const refusalOf = (...args: Parameters<typeof decide>): string => {
  const decision = decide(...args);
  return decision.allowed ? `ALLOWED ${decision.destination.address}` : decision.refusal;
};

describe('the control: an address of the camera subnet is allowed, from the camera interface', () => {
  it.each(ALL_PURPOSES)('%s: 192.168.50.101 on the default port, from 192.168.50.1', (purpose) => {
    expect(decide('192.168.50.101', purpose)).toEqual({ allowed: true, destination: { address: '192.168.50.101', port: 80, sourceAddress: '192.168.50.1', viaAlias: false } });
  });

  it('the three private ranges are the ones allowed, each from a camera interface inside it', () => {
    const inRange = (network: string, prefixLength: number, own: string, target: string) =>
      decide(target, DestinationPurpose.STORED_CAMERA, undefined, { cameraSubnet: { network, prefixLength }, cameraAddresses: [{ address: own, alias: false }], otherInterfaceSubnets: [], hostAddresses: [own] });
    expect(inRange('10.9.0.0', 16, '10.9.0.1', '10.9.4.7').allowed).toBe(true);
    expect(inRange('172.16.0.0', 16, '172.16.0.1', '172.16.3.9').allowed).toBe(true);
    expect(inRange('172.31.255.0', 24, '172.31.255.1', '172.31.255.9').allowed).toBe(true);
    expect(inRange('192.168.0.0', 24, '192.168.0.1', '192.168.0.90').allowed).toBe(true);
  });

  it('an allowed and a refused answer are frozen, and a refusal carries its code and nothing else', () => {
    const allowed = decide('192.168.50.101');
    const refused = decide('127.0.0.1');
    expect(Object.isFrozen(allowed)).toBe(true);
    expect(allowed.allowed && Object.isFrozen(allowed.destination)).toBe(true);
    expect(Object.isFrozen(refused)).toBe(true);
    expect(Object.keys(refused).sort()).toEqual(['allowed', 'refusal']);
  });
});

describe('point 1: an IPv4 literal only, never a name', () => {
  it.each([
    ['a host name', 'camera-1.local', DestinationRefusal.HOST_NAME],
    ['the name of the host itself', 'localhost', DestinationRefusal.HOST_NAME],
    ['a single label', 'gateway', DestinationRefusal.HOST_NAME],
    ['a name with a port', 'camera:80', DestinationRefusal.HOST_NAME],
    ['a locator instead of an address', 'http://192.168.50.101/', DestinationRefusal.HOST_NAME],
    ['nothing', '', DestinationRefusal.NOT_AN_ADDRESS],
    ['not a text: a number', 3_232_248_421, DestinationRefusal.NOT_AN_ADDRESS],
    ['not a text: null', null, DestinationRefusal.NOT_AN_ADDRESS],
    ['not a text: a list', ['192.168.50.101'], DestinationRefusal.NOT_AN_ADDRESS],
    ['a text longer than any literal', `${'a'.repeat(80)}.local`, DestinationRefusal.NOT_AN_ADDRESS],
  ])('%s is refused', (_case, address, refusal) => {
    expect(refusalOf(address)).toBe(refusal);
  });

  it.each([
    ['a leading zero (octal reading)', '192.168.050.101'],
    ['a hexadecimal part', '0xC0.168.50.101'],
    ['a bare integer', '3232248421'],
    ['a hexadecimal integer', '0x7f000001'],
    ['three parts', '192.168.50'],
    ['two parts (short loopback)', '127.1'],
    ['five parts', '192.168.50.101.1'],
    ['a part above 255', '192.168.50.256'],
    ['a trailing dot', '192.168.50.101.'],
    ['a port glued on', '192.168.50.101:80'],
    ['a prefix glued on', '192.168.50.101/24'],
    ['a space before', ' 192.168.50.101'],
    ['a line end after', '192.168.50.101\n'],
    ['a second address after a space', '192.168.50.101 127.0.0.1'],
  ])('%s is not a strict dotted quad', (_case, address) => {
    expect(refusalOf(address)).toBe(DestinationRefusal.MALFORMED_IPV4);
  });
});

describe('point 1 and AD-02: the address classes that are never dialled', () => {
  it.each([
    ['loopback', '127.0.0.1', DestinationRefusal.LOOPBACK],
    ['loopback, the far end of 127.0.0.0/8', '127.255.255.254', DestinationRefusal.LOOPBACK],
    ['loopback, another address of the block', '127.8.9.10', DestinationRefusal.LOOPBACK],
    ['the unspecified address', '0.0.0.0', DestinationRefusal.UNSPECIFIED],
    ['an address of 0.0.0.0/8', '0.1.2.3', DestinationRefusal.UNSPECIFIED],
    ['link-local', '169.254.10.20', DestinationRefusal.LINK_LOCAL],
    ['link-local, the metadata address', '169.254.169.254', DestinationRefusal.LINK_LOCAL],
    ['multicast, the discovery group', '239.255.255.250', DestinationRefusal.MULTICAST],
    ['multicast, the first address', '224.0.0.1', DestinationRefusal.MULTICAST],
    ['broadcast', '255.255.255.255', DestinationRefusal.BROADCAST],
    ['the reserved block', '240.0.0.1', DestinationRefusal.BROADCAST],
    ['a public address', '8.8.8.8', DestinationRefusal.PUBLIC_ADDRESS],
    ['a public address beside 10.0.0.0/8', '11.0.0.1', DestinationRefusal.PUBLIC_ADDRESS],
    ['just below 172.16.0.0/12', '172.15.255.254', DestinationRefusal.PUBLIC_ADDRESS],
    ['just above 172.16.0.0/12', '172.32.0.1', DestinationRefusal.PUBLIC_ADDRESS],
    ['beside 192.168.0.0/16', '192.169.0.1', DestinationRefusal.PUBLIC_ADDRESS],
    ['the shared address space', '100.64.0.1', DestinationRefusal.PUBLIC_ADDRESS],
  ])('%s: %s', (_case, address, refusal) => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf(address, purpose)).toBe(refusal);
  });

  it.each([
    ['IPv6 loopback', '::1', DestinationRefusal.LOOPBACK],
    ['IPv6 loopback, written out', '0:0:0:0:0:0:0:1', DestinationRefusal.LOOPBACK],
    ['IPv6 loopback in brackets', '[::1]', DestinationRefusal.LOOPBACK],
    ['the IPv6 unspecified address', '::', DestinationRefusal.UNSPECIFIED],
    ['the IPv6 unspecified address, written out', '0:0:0:0:0:0:0:0', DestinationRefusal.UNSPECIFIED],
    ['IPv4-mapped, dotted, loopback', '::ffff:127.0.0.1', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-mapped, dotted, a camera address', '::ffff:192.168.50.101', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-mapped, upper case', '::FFFF:192.168.50.101', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-mapped, hexadecimal', '::ffff:7f00:1', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-mapped, written out', '0:0:0:0:0:ffff:c0a8:3265', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-mapped in brackets', '[::ffff:192.168.50.101]', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-compatible, dotted', '::192.168.50.101', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4-compatible, hexadecimal', '::7f00:1', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['IPv4 translated (64:ff9b::/96)', '64:ff9b::c0a8:3265', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['an IPv6 link-local address with a zone', 'fe80::1%en0', DestinationRefusal.IPV6_LITERAL],
    ['an IPv6 unique local address', 'fd00::10', DestinationRefusal.IPV6_LITERAL],
    ['a global IPv6 address', '2001:db8::1', DestinationRefusal.IPV6_LITERAL],
  ])('%s: %s', (_case, address, refusal) => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf(address, purpose)).toBe(refusal);
  });

  it('the class of an address has its own code whatever the configuration says', () => {
    const unconfigured: DestinationContext = { cameraSubnet: null, cameraAddresses: [], otherInterfaceSubnets: [], hostAddresses: [] };
    expect(refusalOf('127.0.0.1', DestinationPurpose.STORED_CAMERA, undefined, unconfigured)).toBe(DestinationRefusal.LOOPBACK);
    expect(refusalOf('::ffff:127.0.0.1', DestinationPurpose.STORED_CAMERA, undefined, unconfigured)).toBe(DestinationRefusal.IPV4_MAPPED_IPV6);
    expect(refusalOf('8.8.8.8', DestinationPurpose.STORED_CAMERA, undefined, unconfigured)).toBe(DestinationRefusal.PUBLIC_ADDRESS);
    expect(refusalOf('localhost', DestinationPurpose.STORED_CAMERA, undefined, unconfigured)).toBe(DestinationRefusal.HOST_NAME);
  });

  it('no context makes a loopback address a destination (AD-02: there is no permissive value)', () => {
    const steered: DestinationContext = { cameraSubnet: { network: '127.0.0.0', prefixLength: 24 }, cameraAddresses: [{ address: '127.0.0.2', alias: false }], otherInterfaceSubnets: [], hostAddresses: [] };
    expect(refusalOf('127.0.0.1', DestinationPurpose.STORED_CAMERA, undefined, steered)).toBe(DestinationRefusal.LOOPBACK);
    // And a private address under such a context is not dialled either: the context itself is refused.
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, undefined, steered)).toBe(DestinationRefusal.NOT_CONFIGURED);
  });
});

describe('point 1: the edges of a subnet and the host itself', () => {
  it('the network and the broadcast address of the /24', () => {
    expect(refusalOf('192.168.50.0')).toBe(DestinationRefusal.NETWORK_ADDRESS);
    expect(refusalOf('192.168.50.255')).toBe(DestinationRefusal.SUBNET_BROADCAST);
    expect(refusalOf('192.168.1.0', DestinationPurpose.COMMISSIONING_SCAN)).toBe(DestinationRefusal.NETWORK_ADDRESS);
    expect(refusalOf('192.168.1.255', DestinationPurpose.COMMISSIONING_SCAN)).toBe(DestinationRefusal.SUBNET_BROADCAST);
  });

  it('in a wider camera subnet the edges of each /24 stay refused', () => {
    const wide: DestinationContext = { cameraSubnet: { network: '10.9.0.0', prefixLength: 16 }, cameraAddresses: [{ address: '10.9.0.1', alias: false }], otherInterfaceSubnets: [], hostAddresses: ['10.9.0.1'] };
    expect(refusalOf('10.9.4.0', DestinationPurpose.STORED_CAMERA, undefined, wide)).toBe(DestinationRefusal.NETWORK_ADDRESS);
    expect(refusalOf('10.9.4.255', DestinationPurpose.STORED_CAMERA, undefined, wide)).toBe(DestinationRefusal.SUBNET_BROADCAST);
    expect(refusalOf('10.9.255.255', DestinationPurpose.STORED_CAMERA, undefined, wide)).toBe(DestinationRefusal.SUBNET_BROADCAST);
    expect(refusalOf('10.9.4.7', DestinationPurpose.STORED_CAMERA, undefined, wide)).toBe('ALLOWED 10.9.4.7');
  });

  it('in a narrower camera subnet the edges of that subnet are refused', () => {
    const narrow: DestinationContext = { cameraSubnet: { network: '192.168.50.64', prefixLength: 26 }, cameraAddresses: [{ address: '192.168.50.65', alias: false }], otherInterfaceSubnets: [], hostAddresses: ['192.168.50.65'] };
    expect(refusalOf('192.168.50.64', DestinationPurpose.STORED_CAMERA, undefined, narrow)).toBe(DestinationRefusal.NETWORK_ADDRESS);
    expect(refusalOf('192.168.50.127', DestinationPurpose.STORED_CAMERA, undefined, narrow)).toBe(DestinationRefusal.SUBNET_BROADCAST);
    expect(refusalOf('192.168.50.128', DestinationPurpose.STORED_CAMERA, undefined, narrow)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
    expect(refusalOf('192.168.50.100', DestinationPurpose.STORED_CAMERA, undefined, narrow)).toBe('ALLOWED 192.168.50.100');
  });

  it.each([
    ['the camera interface address', '192.168.50.1'],
    ['the alias address', '192.168.1.253'],
    ['the office address', '10.20.0.15'],
  ])('%s is an address of the Core host itself', (_case, address) => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf(address, purpose)).toBe(DestinationRefusal.HOST_ADDRESS);
  });

  it('a camera-interface address the host list forgot is still the host', () => {
    expect(refusalOf('192.168.50.1', DestinationPurpose.STORED_CAMERA, undefined, { ...HOST, hostAddresses: [] })).toBe(DestinationRefusal.HOST_ADDRESS);
  });
});

describe('point 2: the camera interface only', () => {
  it('an address inside the subnet of another interface is refused (DR-4)', () => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf('10.20.3.4', purpose)).toBe(DestinationRefusal.OTHER_INTERFACE_SUBNET);
  });

  it('a camera subnet that another interface also holds refuses its addresses', () => {
    const overlap: DestinationContext = { ...HOST, otherInterfaceSubnets: [{ network: '192.168.50.0', prefixLength: 24 }] };
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, undefined, overlap)).toBe(DestinationRefusal.OTHER_INTERFACE_SUBNET);
  });

  it.each([
    ['another private network', '192.168.77.5'],
    ['another private range', '10.99.0.5'],
    ['the neighbouring /24', '192.168.51.101'],
  ])('%s is outside the configured camera subnet, for every purpose', (_case, address) => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf(address, purpose)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
  });

  it('a factory address is reached from the alias by the two commissioning purposes only', () => {
    const viaAlias = { allowed: true, destination: { address: '192.168.1.64', port: 80, sourceAddress: '192.168.1.253', viaAlias: true } };
    expect(decide('192.168.1.64', DestinationPurpose.COMMISSIONING_SCAN)).toEqual(viaAlias);
    expect(decide('192.168.1.64', DestinationPurpose.SET_IP)).toEqual(viaAlias);
    expect(refusalOf('192.168.1.64', DestinationPurpose.TYPED_PROBE)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
    expect(refusalOf('192.168.1.64', DestinationPurpose.STORED_CAMERA)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
  });

  it('without the alias the factory address is refused: no route by another interface is taken', () => {
    const noAlias: DestinationContext = { ...HOST, cameraAddresses: [{ address: '192.168.50.1', alias: false }] };
    expect(refusalOf('192.168.1.64', DestinationPurpose.COMMISSIONING_SCAN, undefined, noAlias)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
  });

  it('an alias reaches its own /24 and no further', () => {
    expect(refusalOf('192.168.0.90', DestinationPurpose.COMMISSIONING_SCAN)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
    expect(refusalOf('192.168.2.64', DestinationPurpose.COMMISSIONING_SCAN)).toBe(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
  });

  it('inside the camera subnet with no address of the camera interface in it: refused, not sent from the alias', () => {
    const aliasOnly: DestinationContext = { ...HOST, cameraAddresses: [{ address: '192.168.1.253', alias: true }] };
    for (const purpose of ALL_PURPOSES) expect(refusalOf('192.168.50.101', purpose, undefined, aliasOnly)).toBe(DestinationRefusal.NO_CAMERA_SOURCE);
  });

  it.each<[string, Partial<DestinationContext>]>([
    ['no camera subnet', { cameraSubnet: null }],
    ['a camera subnet whose address is not its network address', { cameraSubnet: { network: '192.168.50.7', prefixLength: 24 } }],
    ['a camera subnet wider than /16', { cameraSubnet: { network: '10.0.0.0', prefixLength: 8 } }],
    ['a camera subnet narrower than /30', { cameraSubnet: { network: '192.168.50.0', prefixLength: 31 } }],
    ['a public camera subnet', { cameraSubnet: { network: '8.8.8.0', prefixLength: 24 } }],
    ['a camera subnet given as a name', { cameraSubnet: { network: 'cameras', prefixLength: 24 } }],
    ['an address of the interface itself outside the camera subnet', { cameraAddresses: [{ address: '192.168.60.1', alias: false }] }],
    ['a public alias', { cameraAddresses: [{ address: '8.8.8.253', alias: true }] }],
    ['a camera-interface address that is not a literal', { cameraAddresses: [{ address: 'eth1', alias: false }] }],
    ['a subnet of another interface that cannot be read', { otherInterfaceSubnets: [{ network: 'office', prefixLength: 16 }] }],
    ['a host address that cannot be read', { hostAddresses: ['::1'] }],
  ])('a context that is not well-formed refuses a good address: %s', (_case, change) => {
    for (const purpose of ALL_PURPOSES) expect(refusalOf('192.168.50.101', purpose, undefined, { ...HOST, ...change })).toBe(DestinationRefusal.NOT_CONFIGURED);
  });

  it('a purpose that is not one of the four is refused', () => {
    expect(decideDestination({ purpose: 'ANYTHING' as DestinationPurpose, address: '192.168.50.101' }, HOST)).toEqual({ allowed: false, refusal: DestinationRefusal.NOT_CONFIGURED });
  });
});

describe('point 3: the port from the short stored list', () => {
  const withPorts = (allowedPorts: readonly number[]): DestinationContext => ({ ...HOST, allowedPorts });

  it('the default list is port 80 alone', () => {
    expect(DESTINATION_DEFAULT_PORTS).toEqual([80]);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80)).toBe('ALLOWED 192.168.50.101');
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 8080)).toBe(DestinationRefusal.PORT_NOT_LISTED);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 443)).toBe(DestinationRefusal.PORT_NOT_LISTED);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 22)).toBe(DestinationRefusal.PORT_NOT_LISTED);
  });

  it('a port of the stored list is allowed, and a port left out is the first of the list', () => {
    const decision = decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, 8000, withPorts([8899, 8000]));
    expect(decision.allowed && decision.destination.port).toBe(8000);
    const first = decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, undefined, withPorts([8899, 8000]));
    expect(first.allowed && first.destination.port).toBe(8899);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts([8899, 8000]))).toBe(DestinationRefusal.PORT_NOT_LISTED);
  });

  it.each([0, -1, 65_536, 80.5, Number.NaN, '80', null])('a port that is not a whole number from 1 to 65535 is refused: %s', (port) => {
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, port)).toBe(DestinationRefusal.PORT_OUT_OF_RANGE);
  });

  it('a stored list that is empty, too long or holds no port refuses everything', () => {
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts([]))).toBe(DestinationRefusal.PORT_LIST_INVALID);
    const tooLong = Array.from({ length: DESTINATION_MAX_PORTS + 1 }, (_, index) => 80 + index);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts(tooLong))).toBe(DestinationRefusal.PORT_LIST_INVALID);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts(tooLong.slice(0, DESTINATION_MAX_PORTS)))).toBe('ALLOWED 192.168.50.101');
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts([80, 0]))).toBe(DestinationRefusal.PORT_LIST_INVALID);
    expect(refusalOf('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, withPorts([80, 70_000]))).toBe(DestinationRefusal.PORT_LIST_INVALID);
  });
});

describe('point 4: the size of a scan and the spacings', () => {
  it('a scan covers at most 32 stored addresses plus one typed', () => {
    expect([SCAN_MAX_STORED_ADDRESSES, SCAN_MAX_TYPED_ADDRESSES]).toEqual([32, 1]);
    expect(scanSizeRefusal(32, 1)).toBeNull();
    expect(scanSizeRefusal(4, 0)).toBeNull();
    expect(scanSizeRefusal(0, 1)).toBeNull();
    expect(scanSizeRefusal(33, 0)).toBe(ScanSizeRefusal.TOO_MANY_STORED);
    expect(scanSizeRefusal(32, 2)).toBe(ScanSizeRefusal.TOO_MANY_TYPED);
    expect(scanSizeRefusal(0, 0)).toBe(ScanSizeRefusal.NOTHING_TO_SCAN);
    expect(scanSizeRefusal(-1, 0)).toBe(ScanSizeRefusal.TOO_MANY_STORED);
    expect(scanSizeRefusal(1.5, 0)).toBe(ScanSizeRefusal.TOO_MANY_STORED);
    expect(scanSizeRefusal(1, Number.NaN)).toBe(ScanSizeRefusal.TOO_MANY_TYPED);
  });

  it('the spacings are the existing ones: a search per session, a connection test per host', () => {
    expect(DESTINATION_MIN_INTERVAL_MS).toEqual({ SCAN: CAPTURE_DISCOVERY_MIN_INTERVAL_MS, TYPED_PROBE: CAPTURE_DISCOVERY_MIN_INTERVAL_MS, HOST: CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS });
    expect(DESTINATION_MIN_INTERVAL_MS).toEqual({ SCAN: 10_000, TYPED_PROBE: 10_000, HOST: 5_000 });
    expect(Object.isFrozen(DESTINATION_MIN_INTERVAL_MS)).toBe(true);
  });

  it.each(Object.values(DestinationSpacing))('%s: the first is allowed, the next only after the interval', (spacing) => {
    const interval = DESTINATION_MIN_INTERVAL_MS[spacing];
    expect(spacingAllowance(spacing, null, 1_000)).toEqual({ allowed: true });
    expect(spacingAllowance(spacing, 1_000, 1_000)).toEqual({ allowed: false, retryAfterMs: interval });
    expect(spacingAllowance(spacing, 1_000, 1_000 + interval - 1)).toEqual({ allowed: false, retryAfterMs: 1 });
    expect(spacingAllowance(spacing, 1_000, 1_000 + interval)).toEqual({ allowed: true });
  });

  it('a clock that went back, or a time that is not a number, is refused for the whole interval', () => {
    expect(spacingAllowance(DestinationSpacing.SCAN, 5_000, 4_000)).toEqual({ allowed: false, retryAfterMs: 10_000 });
    expect(spacingAllowance(DestinationSpacing.HOST, Number.NaN, 4_000)).toEqual({ allowed: false, retryAfterMs: 5_000 });
    expect(spacingAllowance(DestinationSpacing.TYPED_PROBE, 4_000, Number.POSITIVE_INFINITY)).toEqual({ allowed: false, retryAfterMs: 10_000 });
  });
});

describe('set-IP: the address a camera is given', () => {
  const SET: NewCameraAddressContext = { ...HOST, registeredCameraAddresses: ['192.168.50.101', '192.168.50.102'], gatewayAddress: '192.168.50.254' };
  const refusalOfNew = (request: Parameters<typeof decideNewCameraAddress>[0], context: NewCameraAddressContext = SET): string => {
    const decision = decideNewCameraAddress(request, context);
    return decision.allowed ? `ALLOWED ${decision.assignment.address}/${decision.assignment.prefixLength}` : decision.refusal;
  };

  it('the control: a free address of the camera subnet, with the prefix of the configuration', () => {
    expect(decideNewCameraAddress({ address: '192.168.50.103' }, SET)).toEqual({ allowed: true, assignment: { address: '192.168.50.103', prefixLength: 24, gateway: null } });
    expect(decideNewCameraAddress({ address: '192.168.50.103', mode: CAMERA_ADDRESS_MODE, gateway: '192.168.50.254' }, SET)).toEqual({
      allowed: true,
      assignment: { address: '192.168.50.103', prefixLength: 24, gateway: '192.168.50.254' },
    });
  });

  it('a prefix in the request changes nothing: the prefix comes from the configuration', () => {
    const request = { address: '192.168.50.103', prefixLength: 8, prefix: 8, netmask: '255.0.0.0' };
    expect(refusalOfNew(request)).toBe('ALLOWED 192.168.50.103/24');
  });

  it.each(['DHCP', 'dhcp', 'AUTO', true, 1, null, ''])('DHCP mode is not carried: mode %s is refused, whatever the address', (mode) => {
    expect(refusalOfNew({ address: '192.168.50.103', mode })).toBe(DestinationRefusal.DHCP_NOT_CARRIED);
    expect(refusalOfNew({ address: undefined, mode })).toBe(DestinationRefusal.DHCP_NOT_CARRIED);
  });

  it.each([
    ['outside the camera subnet', '192.168.1.64', DestinationRefusal.OUTSIDE_CAMERA_SUBNET],
    ['inside the alias network, which is not the camera subnet', '192.168.1.100', DestinationRefusal.OUTSIDE_CAMERA_SUBNET],
    ['inside the office subnet', '10.20.3.4', DestinationRefusal.OTHER_INTERFACE_SUBNET],
    ['the Core host itself', '192.168.50.1', DestinationRefusal.HOST_ADDRESS],
    ['the gateway of the installation', '192.168.50.254', DestinationRefusal.GATEWAY_ADDRESS],
    ['a registered camera', '192.168.50.101', DestinationRefusal.REGISTERED_CAMERA_ADDRESS],
    ['another registered camera', '192.168.50.102', DestinationRefusal.REGISTERED_CAMERA_ADDRESS],
    ['the network address', '192.168.50.0', DestinationRefusal.NETWORK_ADDRESS],
    ['the broadcast address', '192.168.50.255', DestinationRefusal.SUBNET_BROADCAST],
    ['loopback', '127.0.0.1', DestinationRefusal.LOOPBACK],
    ['link-local', '169.254.1.1', DestinationRefusal.LINK_LOCAL],
    ['multicast', '239.255.255.250', DestinationRefusal.MULTICAST],
    ['broadcast', '255.255.255.255', DestinationRefusal.BROADCAST],
    ['the unspecified address', '0.0.0.0', DestinationRefusal.UNSPECIFIED],
    ['a public address', '8.8.8.8', DestinationRefusal.PUBLIC_ADDRESS],
    ['IPv4-mapped', '::ffff:192.168.50.103', DestinationRefusal.IPV4_MAPPED_IPV6],
    ['a name', 'camera-3', DestinationRefusal.HOST_NAME],
    ['a leading zero', '192.168.50.0103', DestinationRefusal.MALFORMED_IPV4],
  ])('the new address is refused: %s', (_case, address, refusal) => {
    expect(refusalOfNew({ address })).toBe(refusal);
  });

  it('the new address is not the gateway the request gives', () => {
    expect(refusalOfNew({ address: '192.168.50.200', gateway: '192.168.50.200' }, { ...SET, gatewayAddress: null })).toBe(DestinationRefusal.GATEWAY_ADDRESS);
  });

  it.each([
    ['outside the camera subnet', '192.168.1.1'],
    ['a public address', '8.8.8.8'],
    ['loopback', '127.0.0.1'],
    ['the network address of the subnet', '192.168.50.0'],
    ['the broadcast address of the subnet', '192.168.50.255'],
    ['a name', 'router'],
    ['IPv4-mapped', '::ffff:192.168.50.254'],
    ['not a text', 3_232_248_574],
  ])('a gateway, when given, lies inside the camera subnet: %s is refused', (_case, gateway) => {
    expect(refusalOfNew({ address: '192.168.50.103', gateway })).toBe(DestinationRefusal.GATEWAY_OUTSIDE_SUBNET);
  });

  it('a context that cannot be read refuses the job', () => {
    expect(refusalOfNew({ address: '192.168.50.103' }, { ...SET, cameraSubnet: null })).toBe(DestinationRefusal.NOT_CONFIGURED);
    expect(refusalOfNew({ address: '192.168.50.103' }, { ...SET, registeredCameraAddresses: ['camera-1'] })).toBe(DestinationRefusal.NOT_CONFIGURED);
    expect(refusalOfNew({ address: '192.168.50.103' }, { ...SET, gatewayAddress: '192.168.60.1' })).toBe(DestinationRefusal.NOT_CONFIGURED);
  });
});

describe('refused before any packet is built: the file can send nothing', () => {
  const text = readFileSync(new URL('../destination-rule.ts', import.meta.url), 'utf8');

  it('its one import is the contract constants', () => {
    const imports = [...text.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)].map((match) => match[1]);
    expect(imports).toEqual(['@dems/shared/api']);
    expect(text).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  it('it resolves no name, opens nothing and reads no clock', () => {
    expect(text).not.toMatch(/\b(?:lookup|resolve4|resolve|fetch|connect|createSocket|createConnection)\s*\(/);
    expect(text).not.toMatch(/\bDate\b|\bperformance\b|\bprocess\b|\bglobalThis\b/);
  });

  it('every refusal of the vocabulary is reached by a case of this table', () => {
    const reached = new Set<string>();
    const note = (decision: { readonly allowed: boolean; readonly refusal?: string }): void => {
      if (!decision.allowed && decision.refusal !== undefined) reached.add(decision.refusal);
    };
    const targets: unknown[] = ['', 'localhost', '192.168.050.1', 'fe80::1', '::ffff:10.0.0.1', '127.0.0.1', '0.0.0.0', '169.254.0.1', '224.0.0.1', '255.255.255.255', '8.8.8.8', '192.168.50.0', '192.168.50.255', '192.168.50.1', '10.20.3.4', '192.168.77.5'];
    for (const address of targets) note(decide(address));
    note(decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, undefined, { ...HOST, cameraSubnet: null }));
    note(decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, undefined, { ...HOST, cameraAddresses: [] }));
    note(decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, 0));
    note(decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, 81));
    note(decide('192.168.50.101', DestinationPurpose.STORED_CAMERA, 80, { ...HOST, allowedPorts: [] }));
    const set: NewCameraAddressContext = { ...HOST, registeredCameraAddresses: ['192.168.50.101'], gatewayAddress: '192.168.50.254' };
    note(decideNewCameraAddress({ address: '192.168.50.103', mode: 'DHCP' }, set));
    note(decideNewCameraAddress({ address: '192.168.50.254' }, set));
    note(decideNewCameraAddress({ address: '192.168.50.101' }, set));
    note(decideNewCameraAddress({ address: '192.168.50.103', gateway: '10.0.0.1' }, set));
    expect([...reached].sort()).toEqual(Object.values(DestinationRefusal).sort());
  });
});
