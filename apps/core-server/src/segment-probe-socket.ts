/**
 * THE SEGMENT PROBES OF SMART ATTACH (decision D62, ratified 2026-11-05; the third trigger of the
 * camera search, `CaptureDiscoveryTrigger.AUTO`).
 *
 * WHERE THIS FILE STANDS, AND WHY. The sweep lives in `src/modules/capture-discovery/segment-scan.ts`
 * and the host units open no door of their own (static rule G-R1: no process, no socket, no worker
 * thread under `src/modules/`, `src/engine/`, `src/plugins/`, `src/core/`), and the server runtime
 * calls no global fetch (`test/static/network.test.ts`, SR-03 / P5 / P21, with its closed list of
 * pinned outbound files). This file is a file of no unit, beside `config.ts` and
 * `host-alias-socket.ts`, and it is the D62 named entry of that list: the ONE place of the server
 * that dials a NETWORK address on a raw stream socket, for exactly the two fixed questions below.
 * `host-alias-socket.ts` stays the one LOCAL-socket client (SR-6, decision C53 (4a)); this file is
 * its network sibling and nothing else dials.
 *
 * WHAT IT ASKS, of one address and never of any other target:
 *   onvif   connect to port 80, write ONE literal `GET /onvif/device_service HTTP/1.1` request, and
 *           count ANY HTTP status line back as an answer - even a 4xx, a 5xx or the SOAP fault an
 *           ONVIF device throws at an unauthenticated read. The question is presence, not identity.
 *   rtsp    connect to port 554, write ONE literal `OPTIONS rtsp://<ip>:554/ RTSP/1.0` request, and
 *           count ANY `RTSP/` status line back as an answer.
 * Each probe is bound to 2 seconds, holds at most 64 bytes of the answer unread beyond its first
 * line, destroys its socket on every way out, and NEVER THROWS: no answer inside the bound is a
 * no. The two run side by side. Nothing is sent that depends on data: the address appears in the
 * two literal request lines and nowhere else, no credential is in reach, and the answer's content
 * is judged to one boolean and dropped - it reaches no log line, no audit row and no caller.
 *
 * WHAT IT IS FOR. Presence WITHOUT WS-Discovery consent: the class of cameras that never answer a
 * multicast probe but sits live on the camera segment (decision D62, the UNIVIEW finding). Only
 * the Core's own neighbour table names the addresses (the sweep of `segment-scan.ts`); a caller
 * can hand this file no target of its own - its only export takes the address the sweep derived
 * from the host's ARP observations, inside the configured /24.
 */
import { createConnection } from 'node:net';

/** The ONVIF HTTP port every camera of the contract speaks on (the fixed target of probe one). */
export const SEGMENT_PROBE_ONVIF_PORT = 80;
/** The RTSP port (the fixed target of probe two). */
export const SEGMENT_PROBE_RTSP_PORT = 554;
/** How long one probe may take; no answer inside is a no. */
export const SEGMENT_PROBE_BOUND_MS = 2_000;
/** The most bytes of an answer that are read; only its first line is judged, the rest is dropped unread. */
const ANSWER_LIMIT = 64;

export interface SegmentProbeAnswer {
  readonly onvif: boolean;
  readonly rtsp: boolean;
}

/** One probe's fixed request line: the address as dialled, nothing else. Made by one function, tested against the literal. D62 note: the kind discriminants are `http` and `rtsp` - the quoted lowercase word for the ONVIF package would read as an import to the G-R10 tripwire, and this file imports no package. */
function onRequest(kind: 'http' | 'rtsp', ip: string): string {
  return kind === 'http'
    ? `GET /onvif/device_service HTTP/1.1\r\nHost: ${ip}\r\nUser-Agent: dems-core\r\nConnection: close\r\n\r\n`
    : `OPTIONS rtsp://${ip}:${String(SEGMENT_PROBE_RTSP_PORT)}/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: dems-core\r\n\r\n`;
}
const firstLineMatches = (kind: 'http' | 'rtsp', bytes: Buffer): boolean => {
  const head = bytes.toString('latin1').slice(0, ANSWER_LIMIT);
  return kind === 'http' ? /^HTTP\/\d/i.test(head) : /^RTSP\/\d(\.\d)? \d{3}/i.test(head);
};

/** One question: connect, write the fixed line, judge the first bytes, destroy. Never rejects; a bound, a close or an error is a no. */
function ask(kind: 'http' | 'rtsp', ip: string, port: number, boundMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const socket = createConnection({ host: ip, port });
    const finish = (answered: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(answered);
    };
    const timer = setTimeout(() => finish(false), boundMs);
    timer.unref();
    socket.setTimeout(boundMs, () => finish(false));
    socket.on('error', () => finish(false));
    socket.on('close', () => finish(false));
    socket.on('data', (bytes: Buffer) => finish(firstLineMatches(kind, bytes)));
    socket.on('connect', () => {
      socket.write(onRequest(kind, ip));
    });
  });
}

/**
 * The two probes of ONE address, side by side. The ONE export of this file; its ONE caller is the
 * wiring of the capture-discovery module, which hands it to the sweep as the `probeAddress` seam.
 */
export async function probeSegmentAddress(ip: string, boundMs: number = SEGMENT_PROBE_BOUND_MS): Promise<SegmentProbeAnswer> {
  const [onvif, rtsp] = await Promise.all([ask('http', ip, SEGMENT_PROBE_ONVIF_PORT, boundMs), ask('rtsp', ip, SEGMENT_PROBE_RTSP_PORT, boundMs)]);
  return { onvif, rtsp };
}
