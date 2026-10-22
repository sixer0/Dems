// What a search keeps of its answers (blueprint row 131; checks M4-SEC-DISC-2, M4-SEC-DISC-4 (the
// interface half), M4-SEC-TXT-1; capture spec §A.6.1 DS-4, DS-8, DS-9, DS-16 and "Failure modes";
// security review SEC35-28, SEC35-30).
//
// No socket: the collector is handed fixture datagrams with the source address a kernel would
// report. Addresses are documentation addresses (RFC 5737). EVERY RULE HAS ITS CONTROL.
import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_MAX_BYTES,
  DISCOVERY_MAX_DATAGRAMS,
  DISCOVERY_MAX_INTERFACES,
  DISCOVERY_MAX_RESPONDERS,
  createDiscoveryCollector,
  selectInterfaces,
  sourceRefusal,
  type DiscoveryNetwork,
  type RegisteredLookup,
} from '../discovery-collector';
import { LAN_A, LAN_B, LOOPBACK, answerFrom, answerXml, interfaceTable, matchXml, scopesOf, uuidUrn } from './support';

const NETWORK: DiscoveryNetwork = { kind: 'LAN', probed: [LAN_A], ownAddresses: [LAN_A.address, LOOPBACK] };
const CAMERA = '192.0.2.20';
const ROGUE = '192.0.2.66';
const from = (address: string) => ({ address, family: 'IPv4' });

function collectorFor(network: DiscoveryNetwork = NETWORK, registered?: RegisteredLookup) {
  const messageIds = [uuidUrn(), uuidUrn()];
  return { messageIds, first: messageIds[0] ?? '', collector: createDiscoveryCollector({ messageIds, network, registered }) };
}

describe('DS-4: which interfaces a search probes, by property and never by name', () => {
  it('IPv4, not internal, not a host mask, a hardware address that is not all zero; link-local is eligible', () => {
    const selection = selectInterfaces({
      lo0: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true }],
      en0: [
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '02:00:00:00:00:01', internal: false },
        { address: '192.0.2.10', netmask: '255.255.255.0', family: 'IPv4', mac: '02:00:00:00:00:01', internal: false },
      ],
      utun3: [{ address: '198.51.100.7', netmask: '255.255.255.255', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false }],
      tunnel: [{ address: '203.0.113.7', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false }],
      en5: [{ address: '169.254.10.20', netmask: '255.255.0.0', family: 'IPv4', mac: '02:00:00:00:00:05', internal: false }],
    });
    expect(selection.probed).toEqual([
      { address: '192.0.2.10', netmask: '255.255.255.0' },
      { address: '169.254.10.20', netmask: '255.255.0.0' },
    ]);
    // Every IPv4 address of the host is "own", eligible or not.
    expect(selection.ownAddresses).toEqual(['127.0.0.1', '192.0.2.10', '198.51.100.7', '203.0.113.7', '169.254.10.20']);
  });

  it('none is none (the search does not run); more than four are four', () => {
    expect(selectInterfaces(interfaceTable()).probed).toEqual([]);
    const many = Object.fromEntries(Array.from({ length: 6 }, (_unused, index) => [`en${index}`, [{ address: `192.0.2.${index + 1}`, netmask: '255.255.255.0', family: 'IPv4', mac: '02:00:00:00:00:01', internal: false }]]));
    expect(selectInterfaces(many).probed).toHaveLength(DISCOVERY_MAX_INTERFACES);
    expect(selectInterfaces(many).ownAddresses).toHaveLength(6);
  });

  it('R-FLEX 5.2 (NW-K1): the typed probe\'s source interface is placed FIRST, the others follow in table order, the bound stays four', () => {
    const lan = (index: number) => [{ address: `192.0.2.${index + 1}`, netmask: '255.255.255.0', family: 'IPv4', mac: '02:00:00:00:00:01', internal: false }];
    const five = Object.fromEntries(Array.from({ length: 5 }, (_unused, index) => [`en${index}`, lan(index)]));
    const addresses = (source?: string) => selectInterfaces(five, source).probed.map((probed) => probed.address);
    // Control: no source, or a source no eligible interface holds - table order, first four.
    expect(addresses()).toEqual(['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4']);
    expect(addresses('192.0.2.99')).toEqual(['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4']);
    // The source on the fifth: probed, first, and still four in all.
    expect(addresses('192.0.2.5')).toEqual(['192.0.2.5', '192.0.2.1', '192.0.2.2', '192.0.2.3']);
    expect(selectInterfaces(five, '192.0.2.5').probed).toHaveLength(DISCOVERY_MAX_INTERFACES);
    // The source on the second: moved to the front, nothing dropped that was in the first four.
    expect(addresses('192.0.2.2')).toEqual(['192.0.2.2', '192.0.2.1', '192.0.2.3', '192.0.2.4']);
    // An internal or host-mask address is never made eligible by being the source.
    expect(addresses('127.0.0.1')).toEqual(['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4']);
    expect(selectInterfaces(five, '192.0.2.5').ownAddresses).toHaveLength(5);
  });
});

describe('DS-8 / SEC35-28 (2): the source is the kernel\'s, and only an on-link device may answer', () => {
  it('control: a device on the probed segment may answer', () => {
    expect(sourceRefusal(CAMERA, 'IPv4', NETWORK)).toBeNull();
    expect(sourceRefusal('198.51.100.20', 'IPv4', { kind: 'LAN', probed: [LAN_A, LAN_B], ownAddresses: [] })).toBeNull();
  });

  it('this host\'s own addresses, the network and broadcast address, multicast, unspecified, loopback, off-link and IPv6 are refused', () => {
    expect(sourceRefusal(LAN_A.address, 'IPv4', NETWORK)).toBe('SOURCE_OWN_ADDRESS');
    expect(sourceRefusal('192.0.2.0', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('192.0.2.255', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('239.255.255.250', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('224.0.0.1', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('255.255.255.255', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('0.0.0.0', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('127.0.0.1', 'IPv4', NETWORK)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('198.51.100.20', 'IPv4', NETWORK)).toBe('SOURCE_OFF_LINK');
    expect(sourceRefusal('8.8.8.8', 'IPv4', NETWORK)).toBe('SOURCE_OFF_LINK');
    expect(sourceRefusal('fe80::1', 'IPv6', NETWORK)).toBe('SOURCE_NOT_IPV4');
    expect(sourceRefusal('::ffff:192.0.2.20', 'IPv6', NETWORK)).toBe('SOURCE_NOT_IPV4');
    // A wider mask: its own network and broadcast addresses.
    const wide: DiscoveryNetwork = { kind: 'LAN', probed: [{ address: '169.254.10.20', netmask: '255.255.0.0' }], ownAddresses: ['169.254.10.20'] };
    expect(sourceRefusal('169.254.255.255', 'IPv4', wide)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('169.254.0.0', 'IPv4', wide)).toBe('SOURCE_RESERVED');
    expect(sourceRefusal('169.254.0.255', 'IPv4', wide)).toBeNull();
  });

  it('in the loopback fixture the one stub address is the whole network', () => {
    const fixture: DiscoveryNetwork = { kind: 'LOOPBACK_FIXTURE', address: LOOPBACK };
    expect(sourceRefusal(LOOPBACK, 'IPv4', fixture)).toBeNull();
    expect(sourceRefusal(CAMERA, 'IPv4', fixture)).toBe('SOURCE_OFF_LINK');
  });

  it('a refused source is dropped and counted before the message is read', () => {
    const { first, collector } = collectorFor();
    let reads = 0;
    const counting = createDiscoveryCollector({ messageIds: [first], network: NETWORK, read: () => ((reads += 1), { ok: false, drop: 'NOT_XML' }) });
    for (const address of [LAN_A.address, '192.0.2.255', '192.0.2.0', '239.255.255.250', '0.0.0.0', '198.51.100.20']) {
      collector.accept(answerFrom(first, address), from(address));
      counting.accept(answerFrom(first, address), from(address));
    }
    expect(reads).toBe(0);
    expect(collector.result()).toMatchObject({ candidates: [], responderCount: 0, counts: { datagramsReceived: 6, datagramsAccepted: 0, dropped: { SOURCE_OWN_ADDRESS: 1, SOURCE_RESERVED: 4, SOURCE_OFF_LINK: 1 } } });
    // Control: the same message from an on-link device is a candidate, and the reader is asked.
    counting.accept(answerFrom(first, CAMERA), from(CAMERA));
    expect(reads).toBe(1);
  });
});

describe('DS-8: an answer counts only for this search', () => {
  it('a foreign RelatesTo (an answer nobody asked for, an answer to another search) is dropped and counted', () => {
    const { first, messageIds, collector } = collectorFor();
    collector.accept(answerFrom(uuidUrn(), CAMERA), from(CAMERA));
    collector.accept(answerFrom(first.toUpperCase(), CAMERA), from(CAMERA));
    expect(collector.result()).toMatchObject({ candidates: [], counts: { dropped: { RELATES_TO_MISMATCH: 2 } } });
    // Control: either of the two message IDs is this search's.
    collector.accept(answerFrom(messageIds[1] ?? '', CAMERA), from(CAMERA));
    expect(collector.result().candidates).toHaveLength(1);
  });

  it('builds the candidate from the answer alone', () => {
    const { first, collector } = collectorFor();
    const endpointRef = uuidUrn();
    collector.accept(answerFrom(first, CAMERA, { endpointRef, scopes: scopesOf('Lobby', 'X-200') }), from(CAMERA));
    expect(collector.result().candidates).toEqual([
      {
        adapterKind: 'ONVIF_RTSP',
        host: CAMERA,
        serviceAddress: `http://${CAMERA}/onvif/device_service`,
        endpointRef,
        vendor: null,
        model: 'X-200',
        name: 'Lobby',
        testable: true,
        conflict: false,
        reason: null,
        registered: false,
        addressChanged: false,
        types: ['dn:NetworkVideoTransmitter', 'tds:Device'],
        profileHints: ['Streaming'],
        locationHints: [],
        macHint: null,
        serialHint: null,
      },
    ]);
  });

  it('what the loopback fixture yields is FAKE, never a production candidate (SEC35-41 (a))', () => {
    const { first, collector } = collectorFor({ kind: 'LOOPBACK_FIXTURE', address: LOOPBACK });
    collector.accept(answerFrom(first, LOOPBACK), from(LOOPBACK));
    expect(collector.result().candidates.map((candidate) => candidate.adapterKind)).toEqual(['FAKE']);
  });
});

describe('DS-9: the anti-steering rule', () => {
  it('a device that names another host, or none, is listed and not testable; its reason says which', () => {
    const { first, collector } = collectorFor();
    collector.accept(answerFrom(first, CAMERA, { xaddrs: 'http://192.0.2.99/onvif/device_service' }), from(CAMERA));
    collector.accept(answerFrom(first, '192.0.2.21', { xaddrs: null }), from('192.0.2.21'));
    collector.accept(answerFrom(first, '192.0.2.22', { xaddrs: 'http://192.0.2.99/a http://192.0.2.22:8080/onvif/device_service' }), from('192.0.2.22'));
    expect(collector.result().candidates.map((candidate) => [candidate.host, candidate.serviceAddress, candidate.testable, candidate.reason])).toEqual([
      [CAMERA, null, false, 'ADDRESS_MISMATCH'],
      ['192.0.2.21', null, false, 'NO_SERVICE_ADDRESS'],
      ['192.0.2.22', 'http://192.0.2.22:8080/onvif/device_service', true, null],
    ]);
    // No candidate carries the foreign host anywhere.
    expect(JSON.stringify(collector.result().candidates)).not.toContain('192.0.2.99');
  });
});

describe('M4-SEC-DISC-2: forged answers', () => {
  it('a clone answering first with a real camera\'s endpoint reference from a second address: two rows, both conflict, 0 testable', () => {
    for (const order of [
      [ROGUE, CAMERA],
      [CAMERA, ROGUE],
    ]) {
      const { first, collector } = collectorFor();
      const endpointRef = uuidUrn();
      for (const address of order) collector.accept(answerFrom(first, address, { endpointRef, scopes: scopesOf('Lobby', 'X-200') }), from(address));
      const { candidates, responderCount } = collector.result();
      expect(candidates.map((candidate) => candidate.host)).toEqual(order);
      expect(candidates.map((candidate) => [candidate.conflict, candidate.testable])).toEqual([
        [true, false],
        [true, false],
      ]);
      expect(responderCount).toBe(2);
    }
  });

  it('two endpoint references from one address are both listed, both conflict, 0 testable', () => {
    const { first, collector } = collectorFor();
    collector.accept(answerFrom(first, CAMERA), from(CAMERA));
    collector.accept(answerFrom(first, CAMERA), from(CAMERA));
    // The same in ONE message: two ProbeMatch children.
    collector.accept(Buffer.from(answerXml({ relatesTo: first, matches: matchXml({}, '192.0.2.30') + matchXml({}, '192.0.2.30') })), from('192.0.2.30'));
    const { candidates } = collector.result();
    expect(candidates).toHaveLength(4);
    expect(candidates.every((candidate) => candidate.conflict && !candidate.testable)).toBe(true);
  });

  it('control: two cameras with two references from two addresses are two testable rows', () => {
    const { first, collector } = collectorFor();
    collector.accept(answerFrom(first, CAMERA), from(CAMERA));
    collector.accept(answerFrom(first, '192.0.2.21'), from('192.0.2.21'));
    expect(collector.result().candidates.map((candidate) => [candidate.conflict, candidate.testable])).toEqual([
      [false, true],
      [false, true],
    ]);
  });

  it('a second answer from one source with the same reference is counted, not listed (a device answers each probe)', () => {
    const { first, messageIds, collector } = collectorFor();
    const endpointRef = uuidUrn();
    for (const relatesTo of [first, messageIds[1] ?? '', first, messageIds[1] ?? '']) collector.accept(answerFrom(relatesTo, CAMERA, { endpointRef }), from(CAMERA));
    // A later answer does not replace what the first one announced.
    collector.accept(answerFrom(first, CAMERA, { endpointRef, scopes: scopesOf('Renamed', 'OTHER'), xaddrs: null }), from(CAMERA));
    const { candidates, responderCount, counts } = collector.result();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ name: 'Fixture Camera', testable: true, conflict: false });
    expect(responderCount).toBe(1);
    expect(counts).toMatchObject({ datagramsReceived: 5, datagramsAccepted: 5, repeats: 4 });
  });

  it('300 responders: 64 listed, the already-registered ones first, truncated; the rest counted', () => {
    const registeredHosts = ['192.0.2.150', '192.0.2.200', '192.0.2.250'];
    const { first, collector } = collectorFor(NETWORK, ({ host }) => (registeredHosts.includes(host) ? { storedHost: host, byEndpointRef: true } : null));
    // 250 forged responders arrive first; the three real, registered cameras are among the last.
    const hosts = Array.from({ length: 253 }, (_unused, index) => `192.0.2.${index + 1}`).filter((host) => host !== LAN_A.address);
    const wide: string[] = [...hosts.filter((host) => !registeredHosts.includes(host)), ...registeredHosts];
    for (const host of wide) expect(collector.accept(answerFrom(first, host), from(host))).toBe(true);
    const { candidates, responderCount, truncated, counts } = collector.result();
    expect(candidates).toHaveLength(DISCOVERY_MAX_RESPONDERS);
    expect(candidates.slice(0, 3).map((candidate) => candidate.host)).toEqual(registeredHosts);
    expect(candidates.slice(0, 3).every((candidate) => candidate.registered)).toBe(true);
    // Then arrival order.
    expect(candidates.slice(3, 6).map((candidate) => candidate.host)).toEqual(wide.slice(0, 3));
    expect(truncated).toBe(true);
    expect(responderCount).toBe(wide.length);
    expect(counts.respondersOverCap).toBe(wide.length - DISCOVERY_MAX_RESPONDERS - 3);
  });

  it('control: 64 responders are all listed and the result is not truncated', () => {
    const { first, collector } = collectorFor();
    for (let index = 0; index < DISCOVERY_MAX_RESPONDERS; index += 1) collector.accept(answerFrom(first, `192.0.2.${index + 100}`), from(`192.0.2.${index + 100}`));
    expect(collector.result()).toMatchObject({ responderCount: DISCOVERY_MAX_RESPONDERS, truncated: false });
    expect(collector.result().candidates).toHaveLength(DISCOVERY_MAX_RESPONDERS);
  });

  it('the datagram cap: the 256th datagram is the last one read, and the caller is told to close at once', () => {
    const { first, collector } = collectorFor();
    const endpointRef = uuidUrn();
    const answers: boolean[] = [];
    for (let index = 0; index < DISCOVERY_MAX_DATAGRAMS + 5; index += 1) answers.push(collector.accept(answerFrom(first, CAMERA, { endpointRef }), from(CAMERA)));
    expect(answers.slice(0, DISCOVERY_MAX_DATAGRAMS - 1).every(Boolean)).toBe(true);
    expect(answers.slice(DISCOVERY_MAX_DATAGRAMS - 1).some(Boolean)).toBe(false);
    expect(collector.result()).toMatchObject({ truncated: true, counts: { datagramsAccepted: DISCOVERY_MAX_DATAGRAMS, dropped: { OVER_DATAGRAM_CAP: 5 } } });
  });

  it('a registered endpoint reference at another address is marked addressChanged; at its stored address, or matched by address only, it is not', () => {
    const moved = uuidUrn();
    const stays = uuidUrn();
    const lookup: RegisteredLookup = ({ endpointRef, host }) => {
      if (endpointRef === moved) return { storedHost: '192.0.2.40', byEndpointRef: true };
      if (endpointRef === stays) return { storedHost: '192.0.2.41', byEndpointRef: true };
      return host === '192.0.2.42' ? { storedHost: host, byEndpointRef: false } : null;
    };
    const { first, collector } = collectorFor(NETWORK, lookup);
    collector.accept(answerFrom(first, '192.0.2.77', { endpointRef: moved }), from('192.0.2.77'));
    collector.accept(answerFrom(first, '192.0.2.41', { endpointRef: stays }), from('192.0.2.41'));
    collector.accept(answerFrom(first, '192.0.2.42'), from('192.0.2.42'));
    collector.accept(answerFrom(first, '192.0.2.43'), from('192.0.2.43'));
    expect(collector.result().candidates.map((candidate) => [candidate.host, candidate.registered, candidate.addressChanged])).toEqual([
      ['192.0.2.77', true, true],
      ['192.0.2.41', true, false],
      ['192.0.2.42', true, false],
      ['192.0.2.43', false, false],
    ]);
  });
});

describe('DS-16: a candidate stays small whatever a device announces', () => {
  it('at most 2 KiB of text, and every text at most 120 characters', () => {
    const { first, collector } = collectorFor();
    const big = 'W'.repeat(150);
    const scopes = [
      `onvif://www.onvif.org/name/${big}`,
      `onvif://www.onvif.org/hardware/${big}`,
      `onvif://www.onvif.org/manufacturer/${big}`,
      `onvif://www.onvif.org/mac/${big}`,
      `onvif://www.onvif.org/serial/${big}`,
      ...Array.from({ length: 12 }, (_unused, index) => `onvif://www.onvif.org/location/${big}${index}`),
      ...Array.from({ length: 12 }, (_unused, index) => `onvif://www.onvif.org/Profile/${big}${index}`),
    ];
    collector.accept(answerFrom(first, CAMERA, { scopes, types: Array.from({ length: 20 }, (_unused, index) => `t:${big}${index}`).join(' ') }), from(CAMERA));
    const [candidate] = collector.result().candidates;
    expect(candidate).toBeDefined();
    const texts = Object.values(candidate ?? {}).flatMap((value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? (value as string[]) : []));
    expect(texts.every((text) => text.length <= 320)).toBe(true);
    expect([candidate?.name, candidate?.model, candidate?.vendor, candidate?.macHint, candidate?.serialHint].every((text) => (text ?? '').length === 120)).toBe(true);
    expect(texts.reduce((sum, text) => sum + Buffer.byteLength(text), 0)).toBeLessThanOrEqual(CANDIDATE_MAX_BYTES);
    // Control: a small answer loses nothing.
    const small = collectorFor();
    small.collector.accept(answerFrom(small.first, CAMERA, { scopes: scopesOf('A', 'B', ['onvif://www.onvif.org/location/x', 'onvif://www.onvif.org/location/y']) }), from(CAMERA));
    expect(small.collector.result().candidates[0]).toMatchObject({ locationHints: ['x', 'y'], profileHints: ['Streaming'] });
  });
});
