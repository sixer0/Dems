/**
 * Row C1D (audit 2026-11-05, decision D149; finding F-W3TW4-C1): WHAT A GATED END-TO-END TEST PRINTS
 * WHEN THE SOURCES OF ITS SESSION DO NOT OPEN.
 *
 * W3TW4 saw every camera of every recorded session end `CAPTURE_CAMERA_NOT_OPENED`, and the failure
 * dumps of the gated files printed only codes: the cause the Core had recorded went with the
 * throw-away data directory. Two facts close that gap for the next run:
 *
 *   - `openFailuresOf`: the entries of the Core's own error log (`errorLogFile`, one JSON row per
 *     line, `plugins/logger/error-log.ts`) whose code says a camera or a microphone of a session did
 *     not open - device, the recorded cause (`INGEST_ADDRESS_UNKNOWN`, `CAMERA_OPEN_BOUND`, ...), the
 *     error's name, the name of its coded cause and the first stack frames. Codes, identifiers and
 *     source locations only: the error log holds no text of an error and no address.
 *   - `ingestReachOfThisProcess`: whether THIS process (and so every helper or relay it starts, which
 *     run as the same user) may connect to the Core's camera ingest ports on the loopback at all. A
 *     host can refuse that by rule - the bench host 192.168.0.29 rejects a loopback connect to
 *     8554-8564 from any user but the service user (`/etc/dems/loopback-ingest.nft`), which is what
 *     row C1D found behind F-W3TW4-C1. The probe listens on the port itself and connects to its own
 *     listener: `REFUSED_WHILE_LISTENING` can only be a refusal of the host, never of the product.
 *
 * Both are READS for a failure message: neither is asserted, so a run that routes its sources
 * another way (decision D135) is not blocked by them.
 */
import { readFileSync } from 'node:fs';
import { createConnection, createServer, type Server } from 'node:net';
import { CAPTURE_INGEST_PORT, type CaptureIngestTrackId } from '../../src/capture/ingest-address';

/** The codes the capture session persists for a source that did not open (`capture-session/index.ts`). */
export const OPEN_FAILURE_CODES: readonly string[] = Object.freeze(['CAPTURE_CAMERA_NOT_OPENED', 'CAPTURE_MIC_NOT_OPENED']);

/** One recorded open failure, as the error log holds it. */
export interface OpenFailure {
  readonly code: string;
  readonly deviceId: string | null;
  /** The cause the Core named (`context.cause`), or null when the failure is the rejection of the open itself. */
  readonly cause: string | null;
  readonly errorName: string | null;
  readonly causeName: string | null;
  /** The first two stack frames: where the open was refused (a frame names a file and a line, never a value). */
  readonly frames: readonly string[];
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** The open failures of the error log file, in file order. A missing or unreadable file, or a line that is not JSON, gives nothing. */
export function openFailuresOf(errorLogFile: string | null | undefined): OpenFailure[] {
  if (errorLogFile === null || errorLogFile === undefined) return [];
  let content: string;
  try {
    content = readFileSync(errorLogFile, 'utf8');
  } catch {
    return [];
  }
  const failures: OpenFailure[] = [];
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const code = text(row['code']);
    if (code === null || !OPEN_FAILURE_CODES.includes(code)) continue;
    const context = typeof row['context'] === 'object' && row['context'] !== null ? (row['context'] as Record<string, unknown>) : {};
    const stack = text(row['stackTrace']);
    failures.push({
      code,
      deviceId: text(context['deviceId']),
      cause: text(context['cause']),
      errorName: text(row['errorName']),
      causeName: text(row['causeName']),
      frames: stack === null ? [] : stack.split('\n').map((frame) => frame.trim()).filter((frame) => frame !== '').slice(0, 2),
    });
  }
  return failures;
}

/** What a loopback connect to one port gives this process. */
export type LoopbackReach = 'OPEN' | 'REFUSED_WHILE_LISTENING' | 'PORT_BUSY' | 'TIMEOUT' | `ERROR_${string}`;

const listen = (server: Server, port: number): Promise<'LISTENING' | 'PORT_BUSY' | `ERROR_${string}`> =>
  new Promise((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => resolve(error.code === 'EADDRINUSE' ? 'PORT_BUSY' : `ERROR_${error.code ?? 'LISTEN'}`));
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => resolve('LISTENING'));
  });

/**
 * Listens on 127.0.0.1:`port`, connects to that listener, and says what came of the connect. A
 * port another process holds is `PORT_BUSY` (nothing is connected to it).
 */
export async function probeLoopbackReach(port: number, timeoutMs = 2_000): Promise<LoopbackReach> {
  const server = createServer((socket) => socket.destroy());
  const listening = await listen(server, port);
  if (listening !== 'LISTENING') return listening;
  try {
    return await new Promise<LoopbackReach>((resolve) => {
      const socket = createConnection({ port, host: '127.0.0.1' });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve('TIMEOUT');
      }, timeoutMs);
      socket.once('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve('OPEN');
      });
      socket.once('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        resolve(error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' ? 'REFUSED_WHILE_LISTENING' : `ERROR_${error.code ?? 'CONNECT'}`);
      });
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** The reach of every camera ingest port of the Core for this process, with the user it runs as. */
export interface IngestReach {
  readonly uid: number | null;
  readonly ports: Readonly<Partial<Record<CaptureIngestTrackId, `${number}:${LoopbackReach}`>>>;
}

export async function ingestReachOfThisProcess(): Promise<IngestReach> {
  const ports: Partial<Record<CaptureIngestTrackId, `${number}:${LoopbackReach}`>> = {};
  for (const [trackId, port] of Object.entries(CAPTURE_INGEST_PORT) as [CaptureIngestTrackId, number][]) ports[trackId] = `${port}:${await probeLoopbackReach(port)}`;
  return { uid: typeof process.getuid === 'function' ? process.getuid() : null, ports };
}
