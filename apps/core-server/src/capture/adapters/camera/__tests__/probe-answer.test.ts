// Reading one probe answer (blueprint row 131; checks M4-SEC-DISC-1 (the parser half), M4-SEC-TXT-1;
// capture spec §A.6.1 DS-8, DS-9, DS-16, §J H-14; security review SEC35-29, SEC35-32 (2), SEC35-48).
//
// No socket: every case is a datagram built here. H-14 is measured on the pinned parser version.
// EVERY RULE HAS ITS CONTROL: beside each "is dropped" stands the same message, unharmed, that is read.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import xml2js from 'xml2js';
import {
  DEVICE_TEXT_MAX_CHARS,
  ENDPOINT_REF_MAX_CHARS,
  HINT_LIST_MAX_ENTRIES,
  PROBE_ANSWER_MAX_BYTES,
  PROBE_ANSWER_MAX_DEPTH,
  PROBE_MATCHES_PER_MESSAGE,
  cleanDeviceText,
  ipv4ToNumber,
  readProbeAnswer,
  serviceAddressFor,
} from '../probe-answer';
import { answerXml, matchXml, scopesOf, uuidUrn } from './support';

const HOST = '192.0.2.20';
const bytes = (xml: string): Buffer => Buffer.from(xml, 'utf8');
const read = (xml: string) => readProbeAnswer(bytes(xml));
const dropOf = (xml: string): string => {
  const reading = read(xml);
  return reading.ok ? 'READ' : reading.drop;
};
const only = (xml: string) => {
  const reading = read(xml);
  if (!reading.ok) throw new Error(`expected a read answer, got ${reading.drop}`);
  const [match] = reading.answer.matches;
  if (match === undefined) throw new Error('expected one match');
  return { answer: reading.answer, match };
};

describe('the parser is the pinned one', () => {
  it('xml2js 0.6.2, as the workspace resolves it and as its manifest pins it exactly (M4-SEC-DEP-1)', () => {
    const require = createRequire(import.meta.url);
    expect((require('xml2js/package.json') as { version: string }).version).toBe('0.6.2');
    const manifest = JSON.parse(readFileSync(new URL('../../../../../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> };
    expect(manifest.dependencies.xml2js).toBe('0.6.2');
    expect(manifest.dependencies.onvif).toBe('0.8.3');
  });
});

describe('an ordinary answer', () => {
  it('is read from the answer alone: endpoint reference, types, the announced addresses, name, hardware, profile and location hints', () => {
    const relatesTo = uuidUrn();
    const endpointRef = uuidUrn();
    const { answer, match } = only(
      answerXml({
        relatesTo,
        matches: matchXml({ endpointRef, scopes: scopesOf('Lobby Camera', 'MODEL X-200', ['onvif://www.onvif.org/location/country/id', 'onvif://www.onvif.org/type/video_encoder']) }, HOST),
      }),
    );
    expect(answer.relatesTo).toBe(relatesTo);
    expect(answer.matchesSkipped).toBe(0);
    expect(match).toEqual({
      endpointRef,
      types: ['dn:NetworkVideoTransmitter', 'tds:Device'],
      xaddrs: [`http://${HOST}/onvif/device_service`],
      name: 'Lobby Camera',
      model: 'MODEL X-200',
      vendor: null,
      profileHints: ['Streaming'],
      locationHints: ['country/id'],
      macHint: null,
      serialHint: null,
    });
  });

  it('a vendor is null unless a non-standard scope states one; other prefixes and attributes change nothing', () => {
    const relatesTo = uuidUrn();
    const withVendor = only(answerXml({ relatesTo, matches: matchXml({ scopes: scopesOf('A', 'B', ['onvif://www.onvif.org/manufacturer/Fixture%20Works', 'onvif://www.onvif.org/MAC/02:00:00:00:00:99', 'onvif://www.onvif.org/serial/SN-1']) }, HOST) }));
    expect(withVendor.match).toMatchObject({ vendor: 'Fixture Works', macHint: '02:00:00:00:00:99', serialHint: 'SN-1' });
    // The same message as another device would write it: other prefixes, attributes on the header.
    const other =
      `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:wsdd="http://schemas.xmlsoap.org/ws/2005/04/discovery">` +
      `<SOAP-ENV:Header><wsa:RelatesTo RelationshipType="wsa:Reply">${relatesTo}</wsa:RelatesTo><wsa:Action SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action></SOAP-ENV:Header>` +
      `<SOAP-ENV:Body><wsdd:ProbeMatches><wsdd:ProbeMatch><wsa:EndpointReference><wsa:Address>urn:uuid:11111111-2222-3333-4444-555555555555</wsa:Address></wsa:EndpointReference>` +
      `<wsdd:Scopes MatchBy="x">onvif://www.onvif.org/name/Other</wsdd:Scopes></wsdd:ProbeMatch></wsdd:ProbeMatches></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    expect(only(other).match).toMatchObject({ endpointRef: 'urn:uuid:11111111-2222-3333-4444-555555555555', name: 'Other', model: null, xaddrs: [] });
    expect(only(other).answer.relatesTo).toBe(relatesTo);
  });

  it('two ProbeMatch children are two matches (the case that ends the process inside the package, spec §A.6.1a O-8)', () => {
    const reading = read(answerXml({ relatesTo: uuidUrn(), matches: matchXml({}, HOST) + matchXml({}, HOST) }));
    expect(reading.ok && reading.answer.matches.length).toBe(2);
  });
});

describe('M4-SEC-DISC-1: hostile and odd answers are dropped with a reason and never throw', () => {
  const relatesTo = uuidUrn();
  const good = answerXml({ relatesTo, matches: matchXml({}, HOST) });

  it('control: the unharmed message is read', () => {
    expect(dropOf(good)).toBe('READ');
  });

  it('bytes that are not XML, an empty datagram, a truncated message', () => {
    expect(dropOf('')).toBe('NOT_XML');
    expect(dropOf('   ')).toBe('NOT_XML');
    expect(readProbeAnswer(Buffer.from(Array.from({ length: 512 }, (_unused, index) => (index * 97 + 13) % 256))).ok).toBe(false);
    expect(dropOf(good.slice(0, good.length - 40))).toBe('NOT_XML');
    expect(dropOf('<a><b></a></b>')).toBe('NOT_XML');
  });

  it('a body over 16 KiB is refused on its byte length, before any text is made', () => {
    const padded = answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `<!--${'x'.repeat(60 * 1024)}-->` });
    expect(Buffer.byteLength(padded)).toBeGreaterThan(PROBE_ANSWER_MAX_BYTES);
    expect(dropOf(padded)).toBe('OVERSIZED');
    // Control: the same padding within the cap is read. Two-byte characters count as two.
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `<!--${'x'.repeat(8 * 1024)}-->` }))).toBe('READ');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `<!--${'é'.repeat(8 * 1024)}-->` }))).toBe('OVERSIZED');
  });

  it('a document type or an entity declaration is refused on the bytes: entity expansion never reaches the parser', () => {
    const doctype = '<!DOCTYPE s:Envelope [<!ENTITY a "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;">]>';
    expect(dropOf(answerXml({ relatesTo, beforeEnvelope: doctype, matches: matchXml({ scopes: ['onvif://www.onvif.org/name/&c;'] }, HOST) }))).toBe('DECLARATION');
    expect(dropOf(answerXml({ relatesTo, beforeEnvelope: '<!doctype x>', matches: matchXml({}, HOST) }))).toBe('DECLARATION');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: '<!ENTITY x "y">' }))).toBe('DECLARATION');
    // Control: a comment and a CDATA section are not declarations.
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: '<!-- note --><x><![CDATA[<raw>]]></x>' }))).toBe('READ');
    // An undeclared entity is a parse error, not an expansion.
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ scopes: ['onvif://www.onvif.org/name/&undeclared;'] }, HOST) }))).toBe('NOT_XML');
  });

  it('2,300 levels of nesting within 16 KiB are refused by the depth count; the depth limit itself is read', () => {
    const deep = (levels: number): string => answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `${'<n>'.repeat(levels)}${'</n>'.repeat(levels)}` });
    const bare = `${'<n>'.repeat(2_300)}${'</n>'.repeat(2_300)}`;
    expect(Buffer.byteLength(bare)).toBeLessThan(PROBE_ANSWER_MAX_BYTES);
    expect(dropOf(bare)).toBe('TOO_DEEP');
    expect(dropOf(deep(1_000))).toBe('TOO_DEEP');
    // H-14, measured on the pinned parser itself, without the depth count in front of it: it does not throw on that tree.
    let seen: unknown = null;
    expect(() => new xml2js.Parser({ strict: true, explicitArray: true, explicitRoot: true, async: false, ignoreAttrs: true, normalize: false, trim: true, tagNameProcessors: [] }).parseString(bare, (error) => void (seen = error))).not.toThrow();
    expect(seen).toBeNull();
    // `bodyExtra` sits two levels down (Envelope, Body).
    expect(dropOf(deep(PROBE_ANSWER_MAX_DEPTH - 2))).toBe('READ');
    expect(dropOf(deep(PROBE_ANSWER_MAX_DEPTH - 1))).toBe('TOO_DEEP');
    // A `>` inside an attribute value and self-closing elements do not confuse the count.
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `${'<n a="x>y"/>'.repeat(300)}` }))).toBe('READ');
  });

  it('1,300 attributes, and elements named like members of Object, change nothing and pollute nothing', () => {
    const attributes = Array.from({ length: 1_300 }, (_unused, index) => `a${index}="v"`).join(' ');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `<x ${attributes}/>` }))).toBe('READ');
    const members =
      '<__proto__><polluted>yes</polluted></__proto__><constructor><prototype><polluted>yes</polluted></prototype></constructor><toString>x</toString><hasOwnProperty>x</hasOwnProperty>';
    const { match } = only(answerXml({ relatesTo, headerExtra: members, matches: matchXml({ extra: members }, HOST), bodyExtra: members }));
    expect(match.name).toBe('Fixture Camera');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
    // An answer whose structural elements are named like that is simply not a ProbeMatches message.
    expect(dropOf('<__proto__><Header><Action>x</Action></Header></__proto__>')).toBe('NOT_PROBE_MATCHES');
    expect(dropOf('<constructor/>')).toBe('NOT_PROBE_MATCHES');
  });

  it('another action, no RelatesTo, an empty ProbeMatches, a match without a usable endpoint reference', () => {
    expect(dropOf(answerXml({ relatesTo, action: 'http://schemas.xmlsoap.org/ws/2005/04/discovery/Hello', matches: matchXml({}, HOST) }))).toBe('NOT_PROBE_MATCHES');
    expect(dropOf(answerXml({ relatesTo: '', matches: matchXml({}, HOST) }))).toBe('NO_RELATES_TO');
    expect(dropOf(answerXml({ relatesTo }))).toBe('NO_PROBE_MATCH');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ endpointRef: '' }, HOST) }))).toBe('NO_PROBE_MATCH');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ endpointRef: `urn:x:${'a'.repeat(ENDPOINT_REF_MAX_CHARS)}` }, HOST) }))).toBe('NO_PROBE_MATCH');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ endpointRef: 'urn:uuid:with space' }, HOST) }))).toBe('NO_PROBE_MATCH');
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ endpointRef: 'urn:uuid:a&#x202e;b' }, HOST) }))).toBe('NO_PROBE_MATCH');
    // Control: 120 characters exactly is used.
    expect(dropOf(answerXml({ relatesTo, matches: matchXml({ endpointRef: 'u'.repeat(ENDPOINT_REF_MAX_CHARS) }, HOST) }))).toBe('READ');
    // One usable match beside an unusable one: the usable one is read, the other is counted.
    const mixed = read(answerXml({ relatesTo, matches: matchXml({ endpointRef: '' }, HOST) + matchXml({}, HOST) }));
    expect(mixed.ok && [mixed.answer.matches.length, mixed.answer.matchesSkipped]).toEqual([1, 1]);
  });

  it('more ProbeMatch children than the per-message cap are counted, not read', () => {
    const many = read(answerXml({ relatesTo, matches: Array.from({ length: 12 }, () => matchXml({}, HOST)).join('') }));
    expect(many.ok && [many.answer.matches.length, many.answer.matchesSkipped]).toEqual([PROBE_MATCHES_PER_MESSAGE, 12 - PROBE_MATCHES_PER_MESSAGE]);
  });

  it('H-14 on the pinned version: 2,000 hostile answers are read in bounded memory (heap growth under 8 MiB) and none throws', () => {
    const hostile = [
      `${'<n>'.repeat(2_300)}${'</n>'.repeat(2_300)}`,
      answerXml({ relatesTo, matches: matchXml({}, HOST), bodyExtra: `<x ${Array.from({ length: 1_300 }, (_unused, index) => `a${index}="v"`).join(' ')}/>` }),
      answerXml({ relatesTo, beforeEnvelope: '<!DOCTYPE a [<!ENTITY a "aaaa">]>', matches: matchXml({}, HOST) }),
      answerXml({ relatesTo, matches: Array.from({ length: 30 }, () => matchXml({}, HOST)).join('') }),
      answerXml({ relatesTo, matches: matchXml({ scopes: Array.from({ length: 150 }, (_unused, index) => `onvif://www.onvif.org/location/${'L'.repeat(60)}${index}`) }, HOST) }),
      `${'<a>'.repeat(5_000)}`,
      '\u0000\u0001\u0002<<<>>>&&&',
    ].map(bytes);
    for (const sample of hostile) expect(sample.length).toBeLessThanOrEqual(PROBE_ANSWER_MAX_BYTES);
    const collect = (globalThis as { gc?: () => void }).gc;
    const run = (rounds: number): void => {
      for (let round = 0; round < rounds; round += 1) for (const sample of hostile) readProbeAnswer(sample);
    };
    run(20); // warm-up: code and caches are allocated before the measurement
    collect?.();
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    expect(() => run(286)).not.toThrow(); // 286 x 7 = 2,002 answers
    const elapsedMs = performance.now() - started;
    collect?.();
    const grown = process.memoryUsage().heapUsed - before;
    // Without an exposed collector the figure includes garbage that is not yet collected: the bound is then generous by that much.
    expect(grown).toBeLessThan((collect === undefined ? 64 : 8) * 1024 * 1024);
    // A bound, not a benchmark: 2,002 answers of at most 16 KiB each.
    expect(elapsedMs).toBeLessThan(20_000);
  });
});

describe('M4-SEC-TXT-1: untrusted device text is one plain line of at most 120 characters', () => {
  it('control and direction characters are removed, line breaks become a space, markup stays text', () => {
    expect(cleanDeviceText('Lobby\u0000 \u0007Cam\u001b[31m')).toBe('Lobby Cam[31m');
    expect(cleanDeviceText('a\r\n\tb')).toBe('a b');
    expect(cleanDeviceText('abc‮def⁦ghi​‏jkl﻿')).toBe('abcdefghijkl');
    expect(cleanDeviceText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
    expect(cleanDeviceText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    expect(cleanDeviceText('\ud83d')).toBe('');
    expect(cleanDeviceText('   ')).toBe('');
  });

  it('5,000 characters are cut to 120, and a cut never splits a character', () => {
    expect(cleanDeviceText('x'.repeat(5_000))).toHaveLength(DEVICE_TEXT_MAX_CHARS);
    const emoji = cleanDeviceText('\u{1f4f7}'.repeat(500));
    expect(Array.from(emoji)).toHaveLength(DEVICE_TEXT_MAX_CHARS);
    expect(emoji).toBe('\u{1f4f7}'.repeat(DEVICE_TEXT_MAX_CHARS));
    // Control: a text within the bound is unchanged.
    expect(cleanDeviceText('Kamera Lobi 1')).toBe('Kamera Lobi 1');
  });

  it('holds for every text of a candidate: name, hardware, vendor, hints, types', () => {
    const relatesTo = uuidUrn();
    const long = 'N'.repeat(5_000);
    const { match } = only(
      answerXml({
        relatesTo,
        matches: matchXml(
          {
            types: `t:${'T'.repeat(400)} tds:Device`,
            scopes: [
              `onvif://www.onvif.org/name/${long}`,
              'onvif://www.onvif.org/hardware/%3Cb%3EX%3C%2Fb%3E%E2%80%AE%00',
              'onvif://www.onvif.org/manufacturer/%E2%80%8BAcme%0D%0AInc',
              'onvif://www.onvif.org/location/%ZZbad',
              ...Array.from({ length: 20 }, (_unused, index) => `onvif://www.onvif.org/location/site${index}`),
            ],
          },
          HOST,
        ),
      }),
    );
    expect(match.name).toBe('N'.repeat(DEVICE_TEXT_MAX_CHARS));
    expect(match.model).toBe('<b>X</b>');
    expect(match.vendor).toBe('Acme Inc');
    expect(match.locationHints).toHaveLength(HINT_LIST_MAX_ENTRIES);
    expect(match.locationHints[0]).toBe('%ZZbad');
    expect(match.types[0]).toHaveLength(DEVICE_TEXT_MAX_CHARS);
    for (const text of [match.name, match.model, match.vendor, ...match.locationHints, ...match.types]) expect((text ?? '').length).toBeLessThanOrEqual(DEVICE_TEXT_MAX_CHARS);
  });
});

describe('DS-9 / SEC35-32 (2): a service address is used only when its host is the datagram source', () => {
  it('the first well-formed address on the source host is taken', () => {
    expect(serviceAddressFor([`http://${HOST}/onvif/device_service`], HOST)).toEqual({ serviceAddress: `http://${HOST}/onvif/device_service`, reason: null });
    expect(serviceAddressFor(['http://192.0.2.99/onvif/device_service', `https://${HOST}:8443/onvif/device_service`], HOST).serviceAddress).toBe(`https://${HOST}:8443/onvif/device_service`);
    expect(serviceAddressFor([`http://${HOST}`], HOST).serviceAddress).toBe(`http://${HOST}`);
  });

  it('another host is a mismatch; nothing usable is "no service address"; neither is ever returned as an address', () => {
    expect(serviceAddressFor(['http://192.0.2.99/onvif/device_service'], HOST)).toEqual({ serviceAddress: null, reason: 'ADDRESS_MISMATCH' });
    expect(serviceAddressFor([], HOST)).toEqual({ serviceAddress: null, reason: 'NO_SERVICE_ADDRESS' });
    for (const entry of [
      `http://user:pw@${HOST}/onvif/device_service`, // a user part
      `http://${HOST}@192.0.2.99/x`,
      'http://camera.example/onvif/device_service', // a name: nothing is resolved
      'http://[fe80::1]/onvif/device_service', // an IPv6 literal
      `http://${HOST}:0/onvif`, // port 0
      `http://${HOST}:65536/onvif`,
      `http://${HOST}:080/onvif`,
      `http://${HOST}/onvif#fragment`,
      `http://${HOST}/onvif?query=1`,
      `http://${HOST}/${'p'.repeat(200)}`, // a path over 128 characters
      `ftp://${HOST}/onvif`,
      `rtsp://${HOST}/stream`,
      'http://192.0.2.020/onvif', // not the canonical spelling of an address
      'http://192.0.2.256/onvif',
      `http://${HOST}/a b`,
    ]) {
      expect(serviceAddressFor([entry], HOST), entry).toEqual({ serviceAddress: null, reason: 'NO_SERVICE_ADDRESS' });
    }
  });

  it('an address has one spelling', () => {
    expect(ipv4ToNumber('192.0.2.1')).toBe(0xc0000201);
    expect(ipv4ToNumber('255.255.255.255')).toBe(0xffffffff);
    for (const text of ['192.0.2', '192.0.2.01', '192.0.2.256', '0x7f.0.0.1', '192.0.2.1 ', '::1', '']) expect(ipv4ToNumber(text), text).toBeNull();
  });
});
