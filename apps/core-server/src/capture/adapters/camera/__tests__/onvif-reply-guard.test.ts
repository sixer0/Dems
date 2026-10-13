// The reply guard of the two ONVIF files (row B1; decision C95; blocking finding B-01 of
// `verification/060b_m3_review_second_pass.md`).
//
// WHAT IS PROVEN HERE, without a socket: the scan itself - every refusal with its control at the
// bound, the same verdict however the bytes are cut into chunks, the review's reproducer refused
// in bounded time at every size it measured, and that what the scan ADMITS keeps the package's
// namespace replacement linear (counted, not only timed) - and the wrap that puts the scan in front
// of the package, on a hand-made agent, request and response.
//
// The end-to-end half (a hostile device on loopback, through the real package) stands in the last
// block of `onvif-session.test.ts` and of `onvif-network.test.ts`.
//
// THE EXPRESSION BELOW IS A COPY of the one line of the package that is quadratic
// (`onvif/lib/utils.js:56`, version 0.8.3). It is here as the CONTROL: the same text the scan
// refuses is slow through it, and the text the scan admits is not. No test file may import the
// package (static rule G-R10), so the line is restated; if the package changes it, the control
// measures the old line - the end-to-end tests measure the real one.
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { ONVIF_REPLY_BOUNDS, ONVIF_REPLY_MAX_BYTES, OnvifReplyRefusal, createOnvifReplyScan, guardOnvifReplies, onvifReplyMaxBytes, scanOnvifReply, type OnvifReplyBounds } from '../onvif-reply-guard';

const KIB = 1024;
const NO_CAP = Number.MAX_SAFE_INTEGER;
const bytesOf = (text: string): Buffer => Buffer.from(text, 'utf8');
const verdict = (text: string, bounds: Partial<OnvifReplyBounds> = {}, cap = NO_CAP): OnvifReplyRefusal | null => scanOnvifReply(bytesOf(text), cap, { ...ONVIF_REPLY_BOUNDS, ...bounds });
const envelope = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Body>${inner}</s:Body></s:Envelope>`;
const fill = (unit: string, length: number): string => unit.repeat(Math.ceil(length / unit.length)).slice(0, length);

/** The package's namespace replacement, restated (see the head of the file). */
const packageReplacement = (text: string): string => text.replace(/xmlns([^=]*?)=(".*?")/g, '');
const elapsedOf = (run: () => void): number => {
  const from = performance.now();
  run();
  return performance.now() - from;
};
const fastestOf = (times: number, run: () => void): number => Math.min(...Array.from({ length: times }, () => elapsedOf(run)));

/**
 * The characters the replacement looks at, attempt by attempt (ASCII text): from every occurrence
 * of the five letters to the next equals sign or the end, and through a double-quoted value to its
 * closing quote or its line end. A match is taken whole; a failed attempt moves on by one.
 */
function replacementWork(text: string): number {
  let position = 0;
  let work = 0;
  for (;;) {
    const at = text.indexOf('xmlns', position);
    if (at < 0) return work;
    const from = at + 5;
    const sign = text.indexOf('=', from);
    work += (sign < 0 ? text.length : sign) - from + 1;
    if (sign < 0 || text[sign + 1] !== '"') {
      position = at + 1;
      continue;
    }
    let end = sign + 2;
    let closed = false;
    for (; end < text.length; end += 1) {
      work += 1;
      const character = text[end];
      if (character === '"') {
        closed = true;
        break;
      }
      if (character === '\n' || character === '\r') break;
    }
    position = closed ? end + 1 : at + 1;
  }
}

/** The review's reproducer: the five letters and nothing else. */
const hostile = (kib: number): string => 'xmlns'.repeat((kib * KIB) / 5);
const NAME = ONVIF_REPLY_BOUNDS.namespaceNameMaxBytes;
const VALUE = ONVIF_REPLY_BOUNDS.namespaceValueMaxBytes;
/** The most work the bounds leave the replacement: nine occurrences share one equals sign, and the value after it runs to its line end. */
const worstAdmittedUnit = `${'xmlns'.repeat(9)}aaa="${'b'.repeat(VALUE - 1)}\n`;
const admittedShapes: Readonly<Record<string, (length: number) => string>> = {
  'the worst the bounds leave the replacement': (length) => worstAdmittedUnit.repeat(Math.floor(length / worstAdmittedUnit.length)),
  'occurrences packed before each equals sign': (length) => fill(`${'xmlns'.repeat(Math.floor(NAME / 5))}=`, length),
  'values that close at their bound': (length) => fill(`xmlns="${'a'.repeat(VALUE - 1)}" `, length),
  'an equals sign after every occurrence': (length) => fill('xmlns=', length),
  'a well-formed envelope of many declarations': (length) => envelope(fill('<tt:a xmlns:tt="http://www.onvif.org/ver10/schema" token="t">1</tt:a>', length - 200).replace(/<[^>]*$/, '')),
};
const SWEEP_KIB = [16, 32, 64, 128] as const;

describe('row B1: what the scan admits', () => {
  it('a SOAP envelope with its declaration, namespaces in both quote forms, a comment, a CDATA section and a fault', () => {
    expect(verdict(envelope('<tt:a token="x">1</tt:a>'))).toBeNull();
    expect(verdict(`<?xml version='1.0'?><e xmlns:a='urn:a' xmlns="urn:b"><!-- a - comment -- --><![CDATA[ <!DOCTYPE x> ]] ]]><a:b/></e>`)).toBeNull();
    expect(verdict(envelope('<s:Fault><s:Reason><s:Text xml:lang="en">Sender not authorized</s:Text></s:Reason></s:Fault>'))).toBeNull();
    expect(verdict('')).toBeNull();
    expect(verdict('no markup at all, and xmlns= in plain text')).toBeNull();
  });

  it('is no judge of well-formed XML: a body cut in the middle of an element is left to the parser', () => {
    expect(verdict('<s:Envelope xmlns:s="urn:s"><s:Body><tds:Get')).toBeNull();
    expect(verdict('<a></b></c>')).toBeNull();
    expect(verdict('<>')).toBeNull();
  });

  it('the cap of a reply is its operation\'s, never above the caller\'s own limit; a name that is not listed gets the smallest', () => {
    expect(ONVIF_REPLY_MAX_BYTES).toEqual({
      GetSystemDateAndTime: 16 * KIB,
      GetServices: 64 * KIB,
      GetCapabilities: 64 * KIB,
      GetProfiles: 128 * KIB,
      GetStreamUri: 16 * KIB,
      GetNetworkInterfaces: 64 * KIB,
      SetNetworkInterfaces: 16 * KIB,
      SetNetworkDefaultGateway: 16 * KIB,
      SystemReboot: 16 * KIB,
    });
    // Far below the 1 MiB the exchange allows in all: the largest is an eighth of it.
    expect(Math.max(...Object.values(ONVIF_REPLY_MAX_BYTES))).toBe(128 * KIB);
    expect(onvifReplyMaxBytes('GetProfiles', 1_048_576)).toBe(128 * KIB);
    expect(onvifReplyMaxBytes('GetProfiles', 4 * KIB)).toBe(4 * KIB);
    expect(onvifReplyMaxBytes(null, 1_048_576)).toBe(16 * KIB);
    expect(onvifReplyMaxBytes('constructor', 1_048_576)).toBe(16 * KIB);
    expect(onvifReplyMaxBytes('GetProfiles', -1)).toBe(0);
    expect(ONVIF_REPLY_BOUNDS).toEqual({ maxDepth: 32, maxElements: 8_192, maxAttributes: 4_096, maxAttributesPerElement: 128, namespaceNameMaxBytes: 48, namespaceValueMaxBytes: 512 });
  });
});

describe('row B1: every refusal, with its control at the bound', () => {
  it('OVERSIZED: one byte above the cap, over one chunk or many (control: exactly the cap)', () => {
    expect(verdict('a'.repeat(100), {}, 100)).toBeNull();
    expect(verdict('a'.repeat(101), {}, 100)).toBe(OnvifReplyRefusal.OVERSIZED);
    const scan = createOnvifReplyScan(100);
    expect(scan.push(bytesOf('a'.repeat(60)))).toBeNull();
    expect(scan.push(bytesOf('a'.repeat(40)))).toBeNull();
    expect(scan.push(bytesOf('a'))).toBe(OnvifReplyRefusal.OVERSIZED);
  });

  it('DECLARATION: a document type, an entity, an element or notation declaration, a broken comment or CDATA opening (control: a comment and a CDATA section)', () => {
    for (const text of ['<!DOCTYPE a>', '<!DOCTYPE a [<!ENTITY b "c">]><a>&b;</a>', '<a><!ENTITY b "c"></a>', '<!ELEMENT a ANY>', '<!NOTATION n SYSTEM "x">', '<!-x-->', '<![CDAT[x]]>', '<![cdata[x]]>', '<!>'])
      expect(verdict(text), text).toBe(OnvifReplyRefusal.DECLARATION);
    for (const text of ['<!---->', '<!-- <!DOCTYPE a> -->', '<a><![CDATA[<!ENTITY b "c">]]></a>']) expect(verdict(text), text).toBeNull();
    // A `<!` inside a quoted attribute value is text of that value.
    expect(verdict('<a b="<!DOCTYPE c>"/>')).toBeNull();
  });

  it('INSTRUCTION: a processing instruction after the document began (control: the XML declaration that opens it)', () => {
    expect(verdict('<?xml version="1.0"?><a/>')).toBeNull();
    expect(verdict('  \n<?xml version="1.0"?><a/>')).toBeNull();
    expect(verdict('<?xml version="1.0"?><?xml-stylesheet href="x"?><a/>')).toBe(OnvifReplyRefusal.INSTRUCTION);
    expect(verdict('<a><?pi x?></a>')).toBe(OnvifReplyRefusal.INSTRUCTION);
    expect(verdict('<!-- c --><?xml version="1.0"?><a/>')).toBe(OnvifReplyRefusal.INSTRUCTION);
  });

  it('TOO_DEEP: one element more nested than the bound (control: the bound; siblings, self-closed elements and closed ones do not add)', () => {
    const nested = (depth: number): string => `${'<a>'.repeat(depth)}${'</a>'.repeat(depth)}`;
    expect(verdict(nested(ONVIF_REPLY_BOUNDS.maxDepth))).toBeNull();
    expect(verdict(nested(ONVIF_REPLY_BOUNDS.maxDepth + 1))).toBe(OnvifReplyRefusal.TOO_DEEP);
    expect(verdict('<a>'.repeat(ONVIF_REPLY_BOUNDS.maxDepth + 1))).toBe(OnvifReplyRefusal.TOO_DEEP);
    expect(verdict(`<r>${'<a></a><b/><c x="/>"/>'.repeat(200)}</r>`)).toBeNull();
    expect(verdict(`${'<a>'.repeat(3)}${'</a>'.repeat(2)}<b>`, { maxDepth: 3 })).toBeNull();
    expect(verdict(`${'<a>'.repeat(3)}${'</a>'.repeat(2)}<b><c><d>`, { maxDepth: 3 })).toBe(OnvifReplyRefusal.TOO_DEEP);
    // The review's second check: 9,362 nested elements never reach the package.
    expect(verdict(nested(9_362))).toBe(OnvifReplyRefusal.TOO_DEEP);
  });

  it('TOO_MANY_ELEMENTS: one element above the bound (control: the bound)', () => {
    expect(verdict(`<r>${'<a/>'.repeat(9)}</r>`, { maxElements: 10 })).toBeNull();
    expect(verdict(`<r>${'<a/>'.repeat(10)}</r>`, { maxElements: 10 })).toBe(OnvifReplyRefusal.TOO_MANY_ELEMENTS);
    expect(verdict(`<r>${'<a/>'.repeat(ONVIF_REPLY_BOUNDS.maxElements - 1)}</r>`)).toBeNull();
    expect(verdict(`<r>${'<a/>'.repeat(ONVIF_REPLY_BOUNDS.maxElements)}</r>`)).toBe(OnvifReplyRefusal.TOO_MANY_ELEMENTS);
  });

  it('TOO_MANY_ATTRIBUTES: on one element and in all (control: the bounds; an equals sign in a value or in text is no attribute)', () => {
    const element = (count: number): string => `<a ${Array.from({ length: count }, (_unused, index) => `b${index}="1"`).join(' ')}/>`;
    expect(verdict(element(ONVIF_REPLY_BOUNDS.maxAttributesPerElement))).toBeNull();
    expect(verdict(element(ONVIF_REPLY_BOUNDS.maxAttributesPerElement + 1))).toBe(OnvifReplyRefusal.TOO_MANY_ATTRIBUTES);
    expect(verdict(`<r>${element(5).repeat(2)}</r>`, { maxAttributes: 10 })).toBeNull();
    expect(verdict(`<r>${element(5).repeat(2)}<a b="1"/></r>`, { maxAttributes: 10 })).toBe(OnvifReplyRefusal.TOO_MANY_ATTRIBUTES);
    expect(verdict(`<a b="${'='.repeat(500)}" c='${'='.repeat(500)}'>${'='.repeat(500)}</a>`)).toBeNull();
  });

  it('NAMESPACE_SHAPE: an occurrence of the five letters with no equals sign within the bound (control: the bound)', () => {
    expect(verdict(`xmlns${'a'.repeat(NAME)}=`)).toBeNull();
    expect(verdict(`xmlns${'a'.repeat(NAME + 1)}=`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    expect(verdict(`<a>xmlns${' '.repeat(NAME + 1)}</a>`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    // It is the EARLIEST occurrence that is held to the bound: later ones do not start the count again.
    expect(verdict(`${'xmlns'.repeat(Math.floor(NAME / 5) + 1)}=`)).toBeNull();
    expect(verdict(`${'xmlns'.repeat(Math.floor(NAME / 5) + 2)}=`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    // Fewer than the bound before the end of the text is no refusal: the replacement has nothing left to scan.
    expect(verdict(`<a/>xmlns${'a'.repeat(NAME)}`)).toBeNull();
    // Letters that only begin like the five are none.
    expect(verdict(fill('xmlnxmlxmxxmln s', 4 * KIB))).toBeNull();
  });

  it('NAMESPACE_SHAPE: a double-quoted value that neither closes nor ends its line within the bound (control: the bound, a closing quote, a line end)', () => {
    expect(verdict(`xmlns="${'a'.repeat(VALUE)}"`)).toBeNull();
    expect(verdict(`xmlns="${'a'.repeat(VALUE + 1)}"`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    expect(verdict(`xmlns="${'a'.repeat(VALUE)}\n${'a'.repeat(VALUE)}`)).toBeNull();
    expect(verdict(`xmlns="${'a'.repeat(VALUE)}\r`)).toBeNull();
    // A single-quoted or unquoted value is not one the replacement reads: nothing to bound.
    expect(verdict(`xmlns='${'a'.repeat(4 * VALUE)}'`)).toBeNull();
    expect(verdict(`xmlns=${'a'.repeat(4 * VALUE)}`)).toBeNull();
  });

  it('NAMESPACE_SHAPE: occurrences INSIDE a value count only when the value did not close', () => {
    const inner = `xmlns${'a'.repeat(NAME + 20)}`;
    // Closed: the replacement takes the whole declaration with what stands in it.
    expect(verdict(`xmlns="${inner}"`)).toBeNull();
    // Given up at the line end: the occurrence inside is tried, and it has no equals sign in reach.
    expect(verdict(`xmlns="${inner}\n`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    expect(verdict(`xmlns="xmlns${'a'.repeat(NAME - 10)}\n${'a'.repeat(20)}`)).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
    // The same with an equals sign in reach.
    expect(verdict(`xmlns="xmlns${'a'.repeat(NAME - 10)}\n${'a'.repeat(5)}=`)).toBeNull();
    expect(verdict(`xmlns="xmlns=${'a'.repeat(NAME + 20)}\n`)).toBeNull();
  });

  it('a refusal stands: every later chunk answers the same code', () => {
    const scan = createOnvifReplyScan(NO_CAP);
    expect(scan.push(bytesOf('<a><!DOCTYPE b>'))).toBe(OnvifReplyRefusal.DECLARATION);
    expect(scan.push(bytesOf('<a/>'))).toBe(OnvifReplyRefusal.DECLARATION);
    expect(scan.push(new Uint8Array(0))).toBe(OnvifReplyRefusal.DECLARATION);
  });

  it('the verdict does not depend on how the bytes arrive: every text above, byte by byte and cut in two at every place', () => {
    const tight: Partial<OnvifReplyBounds> = { maxDepth: 4, maxElements: 12, maxAttributes: 6, maxAttributesPerElement: 3 };
    const texts = [
      envelope('<tt:a token="x">1</tt:a>'),
      '<?xml version="1.0"?><a><!-- c --><![CDATA[ ]]> ]]><b c="d" e=\'f\'/></a><?late?>',
      '<a><!DOCTYPE b></a>',
      '<a><b><c><d><e/></d></c></b></a>',
      `<a>${'<b/>'.repeat(12)}</a>`,
      '<a b="1" c="2" d="3" e="4"/>',
      `xmlns${'a'.repeat(NAME + 1)}=`,
      `xmlns="${'a'.repeat(60)}\nxmlns:tt="urn:x" xmlns${'b'.repeat(NAME)}="`,
      `xmlns="xmlns${'a'.repeat(NAME + 2)}\n`,
      'xxmlnsxmlns=""xmlns=\'\'xmlns:a="b"',
    ];
    for (const text of texts) {
      const whole = verdict(text, tight);
      const bytes = bytesOf(text);
      const single = createOnvifReplyScan(NO_CAP, { ...ONVIF_REPLY_BOUNDS, ...tight });
      let byByte: OnvifReplyRefusal | null = null;
      for (let index = 0; index < bytes.length && byByte === null; index += 1) byByte = single.push(bytes.subarray(index, index + 1));
      expect(byByte, text).toBe(whole);
      for (let cutAt = 0; cutAt <= bytes.length; cutAt += 1) {
        const scan = createOnvifReplyScan(NO_CAP, { ...ONVIF_REPLY_BOUNDS, ...tight });
        expect(scan.push(bytes.subarray(0, cutAt)) ?? scan.push(bytes.subarray(cutAt)), `${text} cut at ${cutAt}`).toBe(whole);
      }
    }
    // Control: the list holds admitted and refused texts both.
    expect(new Set(texts.map((text) => verdict(text, tight) === null)).size).toBe(2);
  });
});

describe('row B1 / B-01: the review\'s reproducer, and what the scan admits, in bounded time', () => {
  it('the reproducer is refused at every size the review measured, within the first bytes, in milliseconds', () => {
    for (const kib of [16, 256, 1_000]) {
      const body = bytesOf(hostile(kib));
      const scan = createOnvifReplyScan(NO_CAP);
      let refusedAt = -1;
      const elapsed = elapsedOf(() => {
        for (let index = 0; index < body.length && refusedAt < 0; index += 64) if (scan.push(body.subarray(index, index + 64)) !== null) refusedAt = index + 64;
      });
      expect(scan.push(new Uint8Array(0)), `${kib} KiB`).toBe(OnvifReplyRefusal.NAMESPACE_SHAPE);
      // Refused before the 65th byte: nothing after it is read at all.
      expect(refusedAt, `${kib} KiB`).toBe(64);
      // Measured 0.02 ms; the package took 41.9 s at 1,000 KiB. 250 ms is a bound no loaded host misses and the old behaviour cannot meet.
      expect(elapsed, `${kib} KiB`).toBeLessThan(250);
      expect(elapsedOf(() => scanOnvifReply(body, NO_CAP)), `${kib} KiB, whole`).toBeLessThan(250);
    }
  });

  it('CONTROL: the reproducer through the package\'s own replacement is quadratic - the work it does is counted, and it is slow', () => {
    // Counted (no clock): four times the text is sixteen times the work.
    const small = replacementWork(hostile(16));
    const large = replacementWork(hostile(64));
    expect(large / small).toBeGreaterThan(15);
    expect(large / (64 * KIB)).toBeGreaterThan(6_000); // characters looked at PER BYTE of the reply
    // Timed, at 64 KiB only (138 to 284 ms measured; 1,000 KiB would hold this test for 42 s): still far above what an admitted reply of twice the size costs.
    const admitted = admittedShapes['the worst the bounds leave the replacement']?.(128 * KIB) ?? '';
    expect(verdict(admitted)).toBeNull();
    const slow = elapsedOf(() => packageReplacement(hostile(64)));
    const fast = fastestOf(3, () => packageReplacement(admitted));
    expect(slow).toBeGreaterThan(10 * fast);
  });

  it('the sweep: for every admitted shape from 16 KiB to the largest cap the replacement\'s work is linear (counted) and scan plus replacement stay inside the budget (timed)', () => {
    /** Characters the replacement may look at per byte of an admitted reply: the bounds leave about nine (measured 8.6). */
    const WORK_PER_BYTE = 16;
    /** The budget of one reply for scan and replacement together, in ms. Measured: under 4 ms at 128 KiB on a host at load 13 to 18. */
    const BUDGET_MS = 250;
    for (const [name, make] of Object.entries(admittedShapes)) {
      for (const kib of SWEEP_KIB) {
        const text = make(kib * KIB);
        const label = `${name}, ${kib} KiB`;
        expect(text.length, label).toBeGreaterThan(kib * KIB * 0.9);
        expect(text.length, label).toBeLessThanOrEqual(kib * KIB);
        expect(verdict(text), label).toBeNull();
        expect(replacementWork(text) / text.length, label).toBeLessThan(WORK_PER_BYTE);
        const body = bytesOf(text);
        expect(fastestOf(2, () => scanOnvifReply(body, NO_CAP)) + fastestOf(2, () => packageReplacement(text)), label).toBeLessThan(BUDGET_MS);
      }
    }
  });

  it('whatever a seeded generator writes: a text the scan admits never costs the replacement more than the linear bound', () => {
    let seed = 20261013;
    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const units = ['xmlns', 'xmlns', 'a', ' ', '=', '="', '"', '\n', 'xmln', ':tt', '<', '>'];
    let admitted = 0;
    let refused = 0;
    for (let round = 0; round < 6_000; round += 1) {
      const weights = units.map(() => random() ** 2);
      const sum = weights.reduce((total, weight) => total + weight, 0);
      const length = 20 + Math.floor(random() * 4_000);
      let text = '';
      while (text.length < length) {
        let at = random() * sum;
        let index = 0;
        while (index < units.length - 1 && at > (weights[index] ?? 0)) {
          at -= weights[index] ?? 0;
          index += 1;
        }
        text += (units[index] ?? '').repeat(random() < 0.1 ? 1 + Math.floor(random() * 120) : 1);
      }
      if (verdict(text, { maxDepth: NO_CAP, maxElements: NO_CAP, maxAttributes: NO_CAP, maxAttributesPerElement: NO_CAP }) !== null) {
        refused += 1;
        continue;
      }
      admitted += 1;
      // The one thing the scan cannot see is the END of the text: a last value that never closes is tried once more from each
      // occurrence inside it - at most the value bound, about a hundred times. A constant, not a factor.
      expect(replacementWork(text)).toBeLessThanOrEqual(16 * text.length + (VALUE + NAME) * (VALUE / 5 + 1));
    }
    // Control: the generator writes both kinds, in numbers.
    expect(admitted).toBeGreaterThan(200);
    expect(refused).toBeGreaterThan(200);
  });
});

describe('row B1: the wrap that puts the scan in front of the package', () => {
  class FakeResponse extends EventEmitter {
    destroyed = 0;
    destroy(): this {
      this.destroyed += 1;
      return this;
    }
  }
  /** An agent, and a "package" that subscribes as the real one does: its response listener is on the request before the agent is handed it. */
  function harness(capOf: () => number = () => NO_CAP) {
    const handed: unknown[][] = [];
    const agent = {
      addRequest(...values: unknown[]): string {
        handed.push(values);
        return 'handed';
      },
    };
    const refusals: OnvifReplyRefusal[] = [];
    guardOnvifReplies(agent, capOf, (refusal) => refusals.push(refusal));
    const request = new EventEmitter();
    const response = new FakeResponse();
    const got: string[] = [];
    let ended = 0;
    request.once('response', (incoming: FakeResponse) => {
      incoming.on('data', (chunk: Buffer) => got.push(chunk.toString('utf8')));
      incoming.on('end', () => {
        ended += 1;
      });
    });
    const returned = (agent.addRequest as (...values: unknown[]) => unknown)(request, { host: 'h' }, 80, 'local');
    request.emit('response', response);
    return { handed, refusals, request, response, got, ended: () => ended, returned };
  }

  it('an admitted reply reaches the package whole, with its end; the request is handed to the agent as it came (control)', () => {
    const { handed, refusals, request, response, got, ended, returned } = harness();
    response.emit('data', bytesOf('<a xmlns:tt="urn:x">'));
    response.emit('data', bytesOf('1</a>'));
    response.emit('end');
    expect(got).toEqual(['<a xmlns:tt="urn:x">', '1</a>']);
    expect(ended()).toBe(1);
    expect(refusals).toEqual([]);
    expect(response.destroyed).toBe(0);
    expect(handed).toEqual([[request, { host: 'h' }, 80, 'local']]);
    expect(returned).toBe('handed');
  });

  it('a refused reply: the package gets neither the refused chunk nor a later one nor the end; the response is destroyed; the code is told once', () => {
    const { refusals, response, got, ended } = harness();
    response.emit('data', bytesOf('<a>'));
    response.emit('data', bytesOf(hostile(1)));
    response.emit('data', bytesOf('</a>'));
    response.emit('end');
    expect(got).toEqual(['<a>']);
    expect(ended()).toBe(0);
    expect(refusals).toEqual([OnvifReplyRefusal.NAMESPACE_SHAPE]);
    expect(response.destroyed).toBe(1);
  });

  it('the cap is asked once per response, when its head arrived, and a body above it is refused as oversized; so is a chunk that is not bytes', () => {
    let asked = 0;
    const capped = harness(() => {
      asked += 1;
      return 8;
    });
    expect(asked).toBe(1);
    capped.response.emit('data', bytesOf('12345678'));
    capped.response.emit('data', bytesOf('9'));
    capped.response.emit('end');
    expect(asked).toBe(1);
    expect(capped.got).toEqual(['12345678']);
    expect(capped.refusals).toEqual([OnvifReplyRefusal.OVERSIZED]);
    expect(capped.ended()).toBe(0);

    const decoded = harness();
    decoded.response.emit('data', '<a/>');
    decoded.response.emit('end');
    expect(decoded.got).toEqual([]);
    expect(decoded.refusals).toEqual([OnvifReplyRefusal.OVERSIZED]);
    expect(decoded.ended()).toBe(0);
  });

  it('other events of a response are not touched, and a second request through the agent gets a scan of its own', () => {
    const first = harness();
    let closed = 0;
    first.response.on('close', () => {
      closed += 1;
    });
    first.response.emit('close');
    expect(closed).toBe(1);

    const agent = { addRequest: (): void => undefined };
    const refusals: OnvifReplyRefusal[] = [];
    guardOnvifReplies(agent, () => NO_CAP, (refusal) => refusals.push(refusal));
    const answers: string[][] = [];
    for (const body of ['<!DOCTYPE a>', '<a/>']) {
      const request = new EventEmitter();
      const response = new FakeResponse();
      const got: string[] = [];
      answers.push(got);
      request.once('response', (incoming: FakeResponse) => incoming.on('data', (chunk: Buffer) => got.push(chunk.toString('utf8'))));
      (agent.addRequest as (...values: unknown[]) => unknown)(request);
      request.emit('response', response);
      response.emit('data', bytesOf(body));
    }
    expect(answers).toEqual([[], ['<a/>']]);
    expect(refusals).toEqual([OnvifReplyRefusal.DECLARATION]);
  });

  it('nothing of a refused reply is in what the guard tells: a refusal is one of the seven codes', () => {
    expect(Object.values(OnvifReplyRefusal).sort()).toEqual(['DECLARATION', 'INSTRUCTION', 'NAMESPACE_SHAPE', 'OVERSIZED', 'TOO_DEEP', 'TOO_MANY_ATTRIBUTES', 'TOO_MANY_ELEMENTS']);
    const canary = `cnry${'q'.repeat(24)}`;
    const { refusals, response } = harness();
    response.emit('data', bytesOf(`<a>${canary}<!DOCTYPE ${canary}></a>`));
    expect(refusals).toEqual([OnvifReplyRefusal.DECLARATION]);
    expect(JSON.stringify([refusals, verdict(`<a ${canary}="1">xmlns${canary.repeat(3)}</a>`)])).not.toContain(canary);
  });
});
