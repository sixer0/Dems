/**
 * DEMO evidence package generator (blueprint step 93; decisions D50, D51, D61; Parallel Execution Protocol P6, P13).
 *
 * Writes (and nothing else in the repository):
 *   packages/shared/assets/demo-evidence/
 *     README.md
 *     SESSION-<session ID>/                       one folder per evidence item (design book §11.2)
 *       evidence-container.json                   stands in for the encrypted media payload; references step-92 media
 *       metadata.json                             descriptive record (status, custody); not sealed
 *       manifest.json                             the 13 §11.3 fields; per-track SHA-256 over the real media files
 *       signature.sig                             detached DEMO Ed25519 signature over SHA-256(manifest.json)
 *       device-certificate.pem                    self-signed X.509, subject "DEMO — NOT FOR PRODUCTION"
 *       audit-session-extract.jsonl               the session's rows of the simulator audit chain (step-31 rule)
 *       media/AUDIO-02.m4a                        the TAMPERED package only: the track altered after sealing
 *       export/EXP-<n>.zip, export-manifest.json, export-manifest.sig   exported items only (§19.2)
 *   packages/shared/src/demo-data/packages.generated.ts    the typed index (DEMO_EVIDENCE_INDEX)
 *   packages/shared/src/demo-data/documents.generated.ts   manifest/metadata/signature text per item
 *
 * Data: the simulator dataset (`createIdleState` at `--as-of`, steps 31/32) gives EV 0001–0013 and their audit rows;
 * the simulator's `finalizing` scenario, ticked until sealed, gives the recording scenario's item (session
 * `RECORDING_SCENARIO.sessionSeq`, evidence `IDLE_COUNTERS.evidence`). Media and their durations come from the
 * step-92 `assets/demo-media/media-index.json`; every hash is recomputed here from the media bytes.
 *
 * DEMO key (D51): the Ed25519 private key is derived in memory from the published phrase `DEMO_SEED_PHRASE`
 * (seed = SHA-256 of its UTF-8 bytes). It is never exported or written to any file. Anyone can re-derive it: the
 * signatures only demonstrate the mechanism and prove nothing.
 *
 * Exactly one package is TAMPERED: after sealing, AUDIO-02 of evidence `TAMPERED_EVIDENCE_SEQ` was altered (equal-size
 * AAC frames rotated inside one subject answer; the file still decodes). Its verification fails exactly one check.
 *
 * Deterministic: no wall clock and no randomness in any output (Ed25519 signatures are deterministic; zip entries have
 * fixed order, modes and times, built with `zip -X -D` under TZ=UTC). The same `--as-of` gives the same bytes.
 *
 * Tools: Node built-ins and the macOS `zip` CLI. No npm package, no package.json script (P1, D49).
 *
 * Run (from packages/shared): node --import tsx scripts/gen-demo-evidence.ts [--as-of YYYY-MM-DD[THH:MM]] [--out <dir>]
 * `--as-of` is WIB (UTC+07:00; default 2026-10-01T10:00, the step-92 default; a date alone means 10:00).
 * `--out <dir>` writes <dir>/assets/demo-evidence and <dir>/src/demo-data instead of the repository (previews,
 * determinism checks). A structured JSON-lines run log goes to $TMPDIR/dems-gen-demo-evidence/.
 */
import { spawnSync } from 'node:child_process';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify as verifySignature,
  webcrypto,
  X509Certificate,
  type KeyObject,
} from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CORE_API_EXAMPLES } from '../src/api/examples';
import { EXPORT_ID_PATTERN } from '../src/api/patterns';
import { TrackId } from '../src/domain';
import { formatSeq, toWibIso, wibDateParts } from '../src/sim/clock';
import { DEFAULT_SEED } from '../src/sim/constants';
import { auditBody, chainHash } from '../src/sim/events';
import {
  DEVICE_ID,
  DEVICE_IDENTITY,
  DEVICE_NAME,
  IDLE_COUNTERS,
  OPERATORS,
  RECORDING_PROFILES,
  RECORDING_SCENARIO,
  SOFTWARE_VERSION,
} from '../src/sim/dataset';
import { DEFAULT_TAMPER_TRACK, TRACK_LABELS, TRACK_ORDER } from '../src/sim/evidence';
import { createIdleState } from '../src/sim/initial-state';
import { buildScenarioState, scenarioRng } from '../src/sim/scenarios';
import { tickMachine } from '../src/sim/session-machine';
import type { AuditRow, EvidenceItem, SimState } from '../src/sim/types';
import { EvidenceStatus, ScenarioName, SessionOutcome } from '../src/sim/vocabulary';
import {
  DEMO_EVIDENCE_FOLDER,
  DEMO_EVIDENCE_INDEX_SCHEMA,
  DEMO_EVIDENCE_JOIN_KEY,
  DEMO_MEDIA_FOLDER,
  EXPORT_MANIFEST_ITEMS,
  MANIFEST_FIELDS,
  PACKAGE_ITEM_FILES,
  type DemoApiExamplePayloads,
  type DemoAssetRef,
  type DemoCertificateInfo,
  type DemoCheckResult,
  type DemoEvidenceDocuments,
  type DemoEvidenceIndex,
  type DemoEvidencePackage,
  type DemoExportEntry,
  type DemoFileRef,
  type DemoMobileAssetRef,
  type DemoPrecomputedVerification,
  type DemoSigningKeyInfo,
  type DemoTrackEntry,
  type PackageItemKey,
} from '../src/demo-data/types';
import { buildReport, checkOrder, DEMO_PRECOMPUTED_LABEL, verifyDemoPackage } from '../src/demo-data/verify';

// ── Paths and constants ─────────────────────────────────────────────────────────────────────────
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, '..');
const ASSETS_DIR = join(PKG_DIR, 'assets');
const MEDIA_INDEX_PATH = join(ASSETS_DIR, DEMO_MEDIA_FOLDER, 'media-index.json');
const GENERATOR = 'packages/shared/scripts/gen-demo-evidence.ts';
const ZIP_BIN = '/usr/bin/zip';

const DEFAULT_AS_OF = '2026-10-01T10:00';
/** The published phrase the DEMO signing key is derived from (D51). Changing it changes every signature. */
export const DEMO_SEED_PHRASE =
  'DEMS demo evidence signing key v1 | DEMO ONLY | NOT FOR PRODUCTION | published in packages/shared/scripts/gen-demo-evidence.ts';
const KEY_ID = 'DEMO-KEY-EVSIGN-01';
/** The one TAMPERED package: evidence 0005 (a sealed item of the previous day). */
const TAMPERED_EVIDENCE_SEQ = 5;
/** The altered track mirrors the simulator's tamper hook default (AUDIO-02, MIC 2). */
const TAMPERED_TRACK: TrackId = DEFAULT_TAMPER_TRACK;
const CERT_NOT_BEFORE = Date.UTC(2026, 0, 1, 0, 0, 0);
const CERT_NOT_AFTER = Date.UTC(2030, 11, 31, 23, 59, 59);
const DAY_MS = 86_400_000;
const NOTICE =
  'DEMO - synthetic evidence package for the DEMS demo stack. Not evidence and not for production: it is signed with a DEMO key derived from a published seed.';
const CERT_SUBJECT = {
  country: 'ID',
  organization: 'DEMS Demo (synthetic)',
  organizationalUnit: 'DEMO — NOT FOR PRODUCTION',
  commonName: `${DEVICE_ID} (DEMO — NOT FOR PRODUCTION)`,
  serialNumber: DEVICE_IDENTITY.serialNumber,
} as const;
const CERT_SUBJECT_TEXT = `CN=${CERT_SUBJECT.commonName}, OU=${CERT_SUBJECT.organizationalUnit}, O=${CERT_SUBJECT.organization}, serialNumber=${CERT_SUBJECT.serialNumber}, C=${CERT_SUBJECT.country}`;

// ── Structured run log (persistent, outside the repository) ────────────────────────────────────
type LogLevel = 'info' | 'warn' | 'error';
const RUN_ID = `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const LOG_DIR = join(tmpdir(), 'dems-gen-demo-evidence');
const LOG_PATH = join(LOG_DIR, `${RUN_ID}.jsonl`);

function log(level: LogLevel, source: string, message: string, context: Record<string, unknown> = {}, error?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    source: `gen-demo-evidence.${source}`,
    correlationId: RUN_ID,
    message,
    stack_trace: error instanceof Error ? error.stack : undefined,
    context,
  };
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // The console line below still reports the event if the log directory is not writable.
  }
  const line = `[${level}] ${message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

// ── Small helpers ───────────────────────────────────────────────────────────────────────────────
function sha256(bytes: Uint8Array | string): Buffer {
  return createHash('sha256').update(bytes).digest();
}
function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
function writeBytes(path: string, bytes: Uint8Array): void {
  ensureDir(dirname(path));
  writeFileSync(path, bytes);
}
function posix(path: string): string {
  return path.split(sep).join('/');
}
function iso(ms: number): string {
  return toWibIso(ms);
}
function fail(message: string): never {
  throw new Error(message);
}

// ── Arguments ───────────────────────────────────────────────────────────────────────────────────
interface Options {
  asOf: string;
  now: number;
  /** Root that receives assets/demo-evidence and src/demo-data (the package root by default). */
  outRoot: string;
  preview: boolean;
}

function parseOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      'as-of': { type: 'string', default: DEFAULT_AS_OF },
      out: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const asOf = values['as-of'] ?? DEFAULT_AS_OF;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(asOf);
  if (!match) fail(`--as-of must be YYYY-MM-DD or YYYY-MM-DDTHH:MM (WIB), got "${asOf}"`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const hour = match[4] === undefined ? 10 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const now = Date.UTC(year, month - 1, day, hour - 7, minute, 0);
  const check = wibDateParts(now);
  const roundTrips =
    check.year === year && check.month === month && check.day === day && check.hour === hour && check.minute === minute;
  if (!roundTrips) fail(`--as-of is not a valid WIB date-time: "${asOf}"`);
  // The history reaches back two WIB days, and the recording-scenario item seals a few seconds after `now`.
  if (now - 3 * DAY_MS < CERT_NOT_BEFORE || now + DAY_MS > CERT_NOT_AFTER) {
    fail(`--as-of must lie between 2026-01-04 and 2030-12-30 (the DEMO certificate's validity), got "${asOf}"`);
  }
  const out = values.out;
  return {
    asOf: match[4] === undefined ? `${match[1]}-${match[2]}-${match[3]}T10:00` : asOf,
    now,
    outRoot: out ? resolve(out) : PKG_DIR,
    preview: Boolean(out),
  };
}

// ── Step-92 media index ─────────────────────────────────────────────────────────────────────────
interface MediaFile {
  path: string;
  bytes: number;
  sha256: string;
  durationSec?: number;
}
interface MediaEntry {
  sessionSuffix: string;
  evidenceSuffix: string | null;
  evidenceSuffixWhenSealed?: string;
  subjectName: string;
  excerpt: { durationMs: number; loop: boolean };
  tracks: Record<TrackId, MediaFile>;
  posters: Record<'VIDEO-01' | 'VIDEO-02', MediaFile>;
  thumbnails: Record<'VIDEO-01' | 'VIDEO-02', MediaFile>;
  mobile: { tracks: Record<TrackId, MediaFile>; posters: Record<'VIDEO-01' | 'VIDEO-02', MediaFile> };
  transcript: { speaker: string; track: TrackId; text: string; startSec: number; endSec: number }[];
}
interface MediaIndex {
  schema: string;
  asOf: string;
  video: { codec: string; profile: string; width: number; height: number; fps: number };
  audio: { codec: string; channels: number; sampleRate: number; bitrateKbps: number };
  joinKey: string;
  evidence: MediaEntry[];
  live: MediaEntry;
}

function readMediaIndex(): MediaIndex {
  if (!existsSync(MEDIA_INDEX_PATH)) fail(`Step-92 media index not found: ${MEDIA_INDEX_PATH}. Run gen-demo-media.ts first.`);
  const index = JSON.parse(readFileSync(MEDIA_INDEX_PATH, 'utf8')) as MediaIndex;
  if (index.schema !== 'dems.demo-media/1' || index.joinKey !== DEMO_EVIDENCE_JOIN_KEY) {
    fail(`Unexpected media index schema "${index.schema}" / joinKey "${index.joinKey}"`);
  }
  return index;
}

// ── Simulator data at --as-of ───────────────────────────────────────────────────────────────────
interface SourceItem {
  item: EvidenceItem;
  origin: DemoEvidencePackage['origin'];
  auditRows: AuditRow[];
  outcome: SessionOutcome;
  stopReason: string;
  createdAt: number;
}

/** The session's rows of the global audit chain, plus the investigator's sign-in row just before them. */
function sessionAuditRows(rows: readonly AuditRow[], item: EvidenceItem): AuditRow[] {
  const mine = rows.filter((row) => row.sessionId === item.sessionId || row.evidenceId === item.id);
  const first = mine[0];
  if (!first) fail(`No audit rows for ${item.sessionId}`);
  const previous = rows[rows.indexOf(first) - 1];
  if (previous && previous.type === 'AUTH_SUCCESS' && previous.actorId === item.investigatorId && previous.seq === first.seq - 1) {
    mine.unshift(previous);
  }
  return mine;
}

function loadSimulatorItems(now: number): { base: SimState; items: SourceItem[] } {
  const base = createIdleState({ now, seed: DEFAULT_SEED });
  const items: SourceItem[] = base.evidence.map((item) => {
    const history = base.sessionHistory.find((entry) => entry.id === item.sessionId);
    if (!history) fail(`No session history for ${item.sessionId}`);
    const stopRow = base.audit.rows.find((row) => row.sessionId === item.sessionId && row.type === 'RECORDING_STOPPED');
    return {
      item,
      origin: 'DATASET',
      auditRows: sessionAuditRows(base.audit.rows, item),
      outcome: history.outcome,
      stopReason: typeof stopRow?.details.reason === 'string' ? stopRow.details.reason : '',
      createdAt: history.createdAt,
    };
  });

  // The recording scenario's item, sealed the way the simulator seals it (`finalizing` scenario, ticked).
  let state = buildScenarioState(ScenarioName.FINALIZING, base);
  const rng = scenarioRng(DEFAULT_SEED, ScenarioName.FINALIZING);
  const liveSuffix = formatSeq(IDLE_COUNTERS.evidence);
  const sealedLive = (): EvidenceItem | undefined =>
    state.evidence.find((item) => item.id.endsWith(`-${liveSuffix}`) && item.status === EvidenceStatus.SEALED);
  for (let t = now; t <= now + 20_000 && !sealedLive(); t += 100) state = tickMachine(state, t, rng);
  const live = sealedLive();
  if (!live) fail(`The finalizing scenario did not seal evidence ${liveSuffix} within 20 s`);
  const liveRows = sessionAuditRows(state.audit.rows, live);
  const created = liveRows.find((row) => row.type === 'SESSION_CREATED');
  const stopRow = liveRows.find((row) => row.type === 'RECORDING_STOPPED');
  items.push({
    item: live,
    origin: 'RECORDING_SCENARIO',
    auditRows: liveRows,
    outcome: SessionOutcome.SEALED,
    stopReason: typeof stopRow?.details.reason === 'string' ? stopRow.details.reason : '',
    createdAt: created?.at ?? live.recordedAt,
  });
  return { base, items };
}

// ── DEMO key and certificate ────────────────────────────────────────────────────────────────────
interface DemoKey {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicRaw: Buffer;
}

function deriveDemoKey(): DemoKey {
  const seed = sha256(Buffer.from(DEMO_SEED_PHRASE, 'utf8'));
  // PKCS#8 wrapper of a raw Ed25519 seed (RFC 8410); the key object stays in memory only.
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return { privateKey, publicKey, publicRaw: Buffer.from(spki.subarray(spki.length - 32)) };
}

// Minimal DER writer for the self-signed certificate.
function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function tlv(tag: number, ...content: Buffer[]): Buffer {
  const body = Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}
const derSeq = (...content: Buffer[]): Buffer => tlv(0x30, ...content);
const derSet = (...content: Buffer[]): Buffer => tlv(0x31, ...content);
function derOid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  const out: number[] = [40 * (parts[0] ?? 0) + (parts[1] ?? 0)];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [part & 0x7f];
    for (let value = Math.floor(part / 128); value > 0; value = Math.floor(value / 128)) chunk.unshift(0x80 | (value & 0x7f));
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
}
const derUtf8 = (text: string): Buffer => tlv(0x0c, Buffer.from(text, 'utf8'));
const derPrintable = (text: string): Buffer => tlv(0x13, Buffer.from(text, 'ascii'));
const derIa5 = (text: string): Buffer => tlv(0x16, Buffer.from(text, 'ascii'));
function derUtcTime(ms: number): Buffer {
  const d = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const text = `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(text, 'ascii'));
}
const ED25519_ALGORITHM = derSeq(derOid('1.3.101.112'));

function buildCertificate(key: DemoKey): { der: Buffer; pem: string; info: DemoCertificateInfo } {
  const name = derSeq(
    derSet(derSeq(derOid('2.5.4.6'), derPrintable(CERT_SUBJECT.country))),
    derSet(derSeq(derOid('2.5.4.10'), derUtf8(CERT_SUBJECT.organization))),
    derSet(derSeq(derOid('2.5.4.11'), derUtf8(CERT_SUBJECT.organizationalUnit))),
    derSet(derSeq(derOid('2.5.4.5'), derPrintable(CERT_SUBJECT.serialNumber))),
    derSet(derSeq(derOid('2.5.4.3'), derUtf8(CERT_SUBJECT.commonName))),
  );
  const serial = Buffer.from(sha256('dems.demo.device-certificate.serial').subarray(0, 16));
  serial[0] = ((serial[0] ?? 0) & 0x7f) | 0x40; // positive, 16 bytes
  const extension = (oid: string, critical: boolean, value: Buffer): Buffer =>
    derSeq(derOid(oid), ...(critical ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, value));
  const extensions = tlv(
    0xa3,
    derSeq(
      extension('2.5.29.19', true, derSeq()), // basicConstraints: not a CA
      extension('2.5.29.15', true, tlv(0x03, Buffer.from([0x07, 0x80]))), // keyUsage: digitalSignature
      extension('2.5.29.14', false, tlv(0x04, sha256(key.publicRaw).subarray(0, 20))), // subjectKeyIdentifier
      extension('2.16.840.1.113730.1.13', false, derIa5('DEMO certificate - NOT FOR PRODUCTION - key derived from a published seed')),
    ),
  );
  const tbs = derSeq(
    tlv(0xa0, tlv(0x02, Buffer.from([0x02]))),
    tlv(0x02, serial),
    ED25519_ALGORITHM,
    name,
    derSeq(derUtcTime(CERT_NOT_BEFORE), derUtcTime(CERT_NOT_AFTER)),
    name,
    derSeq(ED25519_ALGORITHM, tlv(0x03, Buffer.concat([Buffer.from([0]), key.publicRaw]))),
    extensions,
  );
  const signature = sign(null, tbs, key.privateKey);
  const der = derSeq(tbs, ED25519_ALGORITHM, tlv(0x03, Buffer.concat([Buffer.from([0]), signature])));
  const base64 = der.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  const pem = `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`;
  const parsed = new X509Certificate(der);
  if (!parsed.verify(key.publicKey)) fail('The DEMO certificate does not verify with its own key');
  return {
    der,
    pem,
    info: {
      path: '',
      sha256: sha256Hex(der),
      subject: CERT_SUBJECT_TEXT,
      issuer: CERT_SUBJECT_TEXT,
      serialNumber: parsed.serialNumber.toUpperCase(),
      notBefore: new Date(CERT_NOT_BEFORE).toISOString(),
      notAfter: new Date(CERT_NOT_AFTER).toISOString(),
      selfSigned: true,
    },
  };
}

// ── The tamper: rotate equal-size AAC frames inside a time window (the file stays decodable) ────
interface Box {
  type: string;
  body: number;
  end: number;
}
function readBoxes(buffer: Buffer, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  for (let offset = start; offset + 8 <= end; ) {
    let size = buffer.readUInt32BE(offset);
    let header = 8;
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header) fail(`Bad MP4 box at ${offset}`);
    boxes.push({ type: buffer.toString('latin1', offset + 4, offset + 8), body: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}
function childBox(buffer: Buffer, parent: Box | undefined, type: string): Box {
  if (!parent) fail(`MP4 box missing before "${type}"`);
  const found = readBoxes(buffer, parent.body, parent.end).find((box) => box.type === type);
  if (!found) fail(`MP4 box "${type}" not found`);
  return found;
}

/** Returns a copy of an AAC .m4a whose frames in [startSec, endSec) are rotated among equal-size frames. */
function alterAacTrack(original: Buffer, startSec: number, endSec: number): { bytes: Buffer; framesChanged: number } {
  const buffer = Buffer.from(original);
  const top: Box = { type: 'root', body: 0, end: buffer.length };
  const moov = childBox(buffer, top, 'moov');
  const traks = readBoxes(buffer, moov.body, moov.end).filter((box) => box.type === 'trak');
  if (traks.length !== 1) fail(`Expected one track, found ${traks.length}`);
  const mdia = childBox(buffer, traks[0], 'mdia');
  const mdhd = childBox(buffer, mdia, 'mdhd');
  const timescale = buffer[mdhd.body] === 1 ? buffer.readUInt32BE(mdhd.body + 20) : buffer.readUInt32BE(mdhd.body + 12);
  const stbl = childBox(buffer, childBox(buffer, mdia, 'minf'), 'stbl');
  const stts = childBox(buffer, stbl, 'stts');
  const frameDuration = buffer.readUInt32BE(stts.body + 12);
  const stsz = childBox(buffer, stbl, 'stsz');
  const fixedSize = buffer.readUInt32BE(stsz.body + 4);
  const count = buffer.readUInt32BE(stsz.body + 8);
  const sizes = Array.from({ length: count }, (_, index) => fixedSize || buffer.readUInt32BE(stsz.body + 12 + 4 * index));
  const stblChildren = readBoxes(buffer, stbl.body, stbl.end);
  const stco = stblChildren.find((box) => box.type === 'stco');
  const co64 = stblChildren.find((box) => box.type === 'co64');
  const chunkTable = stco ?? co64 ?? fail('No chunk offset table');
  const chunkCount = buffer.readUInt32BE(chunkTable.body + 4);
  const chunkOffsets = Array.from({ length: chunkCount }, (_, index) =>
    stco ? buffer.readUInt32BE(chunkTable.body + 8 + 4 * index) : Number(buffer.readBigUInt64BE(chunkTable.body + 8 + 8 * index)),
  );
  const stsc = childBox(buffer, stbl, 'stsc');
  const entries = Array.from({ length: buffer.readUInt32BE(stsc.body + 4) }, (_, index) => ({
    firstChunk: buffer.readUInt32BE(stsc.body + 8 + 12 * index),
    perChunk: buffer.readUInt32BE(stsc.body + 12 + 12 * index),
  }));
  const offsets: number[] = [];
  let sample = 0;
  for (let chunk = 0; chunk < chunkCount; chunk += 1) {
    let perChunk = 0;
    for (const entry of entries) if (chunk + 1 >= entry.firstChunk) perChunk = entry.perChunk;
    let offset = chunkOffsets[chunk] ?? 0;
    for (let k = 0; k < perChunk && sample < count; k += 1) {
      offsets.push(offset);
      offset += sizes[sample] ?? 0;
      sample += 1;
    }
  }
  if (offsets.length !== count) fail('Sample table does not map every frame');
  const first = Math.ceil((startSec * timescale) / frameDuration);
  const last = Math.min(count, Math.floor((endSec * timescale) / frameDuration));
  const groups = new Map<number, number[]>();
  for (let index = first; index < last; index += 1) {
    const size = sizes[index] ?? 0;
    groups.set(size, [...(groups.get(size) ?? []), index]);
  }
  let framesChanged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((target, k) => {
      const source = group[(k + 1) % group.length] ?? target;
      const from = offsets[source] ?? 0;
      original.copy(buffer, offsets[target] ?? 0, from, from + (sizes[source] ?? 0));
      if (!original.subarray(from, from + (sizes[source] ?? 0)).equals(original.subarray(offsets[target] ?? 0, (offsets[target] ?? 0) + (sizes[target] ?? 0)))) {
        framesChanged += 1;
      }
    });
  }
  if (framesChanged === 0 || buffer.equals(original)) fail('The tamper changed no frame');
  return { bytes: buffer, framesChanged };
}

// ── Package building ────────────────────────────────────────────────────────────────────────────
interface Built {
  entry: DemoEvidencePackage;
  documents: DemoEvidenceDocuments;
}

interface BuildContext {
  options: Options;
  media: MediaIndex;
  base: SimState;
  key: DemoKey;
  certificate: { der: Buffer; pem: string; info: DemoCertificateInfo };
  /** Staging root that mirrors packages/shared/assets/. */
  stageAssets: string;
}

function operatorOf(id: string): (typeof OPERATORS)[number] {
  return OPERATORS.find((operator) => operator.id === id) ?? fail(`Unknown operator ${id}`);
}

function suffixOf(id: string): string {
  return /-(\d{4})$/.exec(id)?.[1] ?? fail(`ID without a numeric suffix: ${id}`);
}

/** A file of the stage (packages) or, failing that, of the repository assets (step-92 media). */
function resolveAsset(stageAssets: string, assetPath: string): string {
  const staged = join(stageAssets, assetPath);
  return existsSync(staged) ? staged : join(ASSETS_DIR, assetPath);
}

function fileRef(stageAssets: string, assetPath: string): DemoFileRef {
  const bytes = readFileSync(resolveAsset(stageAssets, assetPath));
  return { path: assetPath, bytes: bytes.length, sha256: sha256Hex(bytes) };
}

function mediaRef(assetPath: string, meta: MediaFile): DemoFileRef {
  return { path: assetPath, bytes: meta.bytes, sha256: meta.sha256 };
}

/** A step-92 still or rendition (path relative to packages/shared/assets/); consumers need no hash for these. */
function assetRef(meta: MediaFile): DemoAssetRef {
  return { path: `${DEMO_MEDIA_FOLDER}/${meta.path}`, bytes: meta.bytes };
}

function mobileRef(meta: MediaFile): DemoMobileAssetRef {
  return { ...assetRef(meta), file: meta.path.split('/').pop() ?? meta.path };
}

function signDigest(key: DemoKey, digest: Buffer): Buffer {
  return sign(null, digest, key.privateKey);
}

function mediaTypeOf(trackId: TrackId): 'video/mp4' | 'audio/mp4' {
  return trackId.startsWith('VIDEO') ? 'video/mp4' : 'audio/mp4';
}

function fileNameOf(trackId: TrackId): string {
  return `${trackId}${trackId.startsWith('VIDEO') ? '.mp4' : '.m4a'}`;
}

function buildPackage(ctx: BuildContext, source: SourceItem): Built {
  const { item } = source;
  const { key, certificate, stageAssets, media, base } = ctx;
  const evidenceSuffix = suffixOf(item.id);
  const sessionSuffix = suffixOf(item.sessionId);
  const mediaEntry =
    source.origin === 'RECORDING_SCENARIO' ? media.live : media.evidence.find((entry) => entry.evidenceSuffix === evidenceSuffix);
  if (!mediaEntry) fail(`No step-92 media for evidence ${evidenceSuffix}`);
  if (mediaEntry.sessionSuffix !== sessionSuffix || mediaEntry.subjectName !== item.subjectName) {
    fail(`Step-92 media for ${evidenceSuffix} describe session ${mediaEntry.sessionSuffix} / ${mediaEntry.subjectName}; regenerate the media`);
  }
  if (source.origin === 'RECORDING_SCENARIO' && mediaEntry.evidenceSuffixWhenSealed !== evidenceSuffix) {
    fail(`Live media seal into ${mediaEntry.evidenceSuffixWhenSealed ?? '?'}, the simulator into ${evidenceSuffix}`);
  }
  const folder = `${DEMO_EVIDENCE_FOLDER}/SESSION-${item.sessionId}`;
  const packageDir = join(stageAssets, folder);
  ensureDir(packageDir);
  const tampered = item.id.endsWith(`-${formatSeq(TAMPERED_EVIDENCE_SEQ)}`) && source.origin === 'DATASET';
  const investigator = operatorOf(item.investigatorId);
  const finalizationStatus = source.outcome === SessionOutcome.INCOMPLETE ? 'INCOMPLETE' : 'SEALED';
  const signedAtMs =
    item.sealedAt ??
    source.auditRows.find((row) => row.type === 'SESSION_INCOMPLETE')?.at ??
    fail(`No seal or recovery time for ${item.id}`);
  const purpose = finalizationStatus === 'SEALED' ? 'SEAL' : 'RECOVERY_ATTESTATION';

  // Tracks: hash the real media bytes; the tampered track is altered after the hash was sealed.
  const tracks: DemoTrackEntry[] = [];
  const sealedBytes = new Map<TrackId, number>();
  let tamperNote: string | null = null;
  for (const trackId of TRACK_ORDER) {
    const meta = mediaEntry.tracks[trackId];
    const mediaPath = `${DEMO_MEDIA_FOLDER}/${meta.path}`;
    const bytes = readFileSync(join(ASSETS_DIR, mediaPath));
    if (bytes.length !== meta.bytes) fail(`${mediaPath}: ${bytes.length} bytes, media index says ${meta.bytes}`);
    const sealedSha256 = sha256Hex(bytes);
    sealedBytes.set(trackId, bytes.length);
    if (sealedSha256 !== meta.sha256) log('warn', 'tracks', `${mediaPath} differs from media-index.json; the package uses the file`, { mediaPath });
    let stored = mediaRef(mediaPath, { ...meta, sha256: sealedSha256 });
    let altered = false;
    if (tampered && trackId === TAMPERED_TRACK) {
      const answers = mediaEntry.transcript.filter((line) => line.track === trackId);
      const window = answers[answers.length - 1] ?? fail(`No ${trackId} transcript line to alter`);
      const result = alterAacTrack(bytes, window.startSec, window.endSec);
      const alteredPath = `${folder}/media/${fileNameOf(trackId)}`;
      writeBytes(join(stageAssets, alteredPath), result.bytes);
      stored = { path: alteredPath, bytes: result.bytes.length, sha256: sha256Hex(result.bytes) };
      altered = true;
      tamperNote = `${result.framesChanged} AAC frames rotated between ${window.startSec.toFixed(3)} s and ${window.endSec.toFixed(3)} s`;
      log('info', 'tamper', `TAMPERED ${item.id} ${trackId}: ${tamperNote}`, { evidenceId: item.id, trackId, alteredPath });
    }
    const isVideo = trackId === TrackId.VIDEO_01 || trackId === TrackId.VIDEO_02;
    const videoKey = trackId as 'VIDEO-01' | 'VIDEO-02';
    const mobileMeta = mediaEntry.mobile.tracks[trackId];
    const mobilePoster = isVideo ? mediaEntry.mobile.posters[videoKey] : undefined;
    tracks.push({
      trackId,
      label: TRACK_LABELS[trackId],
      file: fileNameOf(trackId),
      mediaType: mediaTypeOf(trackId),
      durationSec: meta.durationSec ?? mediaEntry.excerpt.durationMs / 1_000,
      sealedSha256,
      stored,
      altered,
      poster: isVideo ? assetRef(mediaEntry.posters[videoKey]) : null,
      thumbnail: isVideo ? assetRef(mediaEntry.thumbnails[videoKey]) : null,
      mobile: {
        media: mobileRef(mobileMeta),
        poster: mobilePoster ? mobileRef(mobilePoster) : null,
      },
    });
  }

  const cameras = base.cameras.map((camera) => ({
    trackId: camera.id,
    deviceId: camera.deviceId,
    name: camera.name,
    model: camera.model,
    firmware: camera.firmware,
  }));
  const microphones = base.mics.map((mic) => ({
    trackId: mic.id,
    deviceId: mic.deviceId,
    name: mic.name,
    channel: mic.channel,
    role: mic.role,
  }));
  const profile = RECORDING_PROFILES.find((entry) => entry.id === item.profileId) ?? RECORDING_PROFILES[0];

  // evidence-container.json (§11.2 "evidence-container / encrypted media payload").
  const container = {
    schema: 'dems.evidence-container/1',
    demo: true,
    notice: `${NOTICE} This descriptor stands in for the encrypted media payload: the demo stores the media unencrypted so it can be played.`,
    evidenceId: item.id,
    sessionId: item.sessionId,
    payload: {
      format: 'Independent track files (design book §6.3, §11.1): two H.264 video tracks, two AAC audio tracks',
      encryption: { algorithm: base.security.encryption, applied: false },
      pathsRelativeTo: 'packages/shared/assets',
      tracks: tracks.map((track) => ({
        trackId: track.trackId,
        file: track.file,
        mediaType: track.mediaType,
        path: track.stored.path,
        bytes: track.stored.bytes,
      })),
    },
  };
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.container), jsonBytes(container));

  // manifest.json: the 13 §11.3 fields, fixed at sealing (never changed afterwards).
  const manifestFields: Record<(typeof MANIFEST_FIELDS)[number]['key'], unknown> = {
    sessionId: item.sessionId,
    device: {
      deviceId: DEVICE_ID,
      name: DEVICE_NAME,
      serialNumber: DEVICE_IDENTITY.serialNumber,
      hardwareUuid: DEVICE_IDENTITY.hardwareUuid,
      softwareVersion: SOFTWARE_VERSION,
      certificate: {
        subject: certificate.info.subject,
        serialNumber: certificate.info.serialNumber,
        sha256: certificate.info.sha256,
      },
    },
    operator: {
      investigatorId: investigator.id,
      displayName: investigator.displayName,
      role: investigator.role,
    },
    subject: {
      name: item.subjectName,
      type: item.subjectType,
      authorization: 'Name and subject type only, as entered at session creation (synthetic DEMO person)',
    },
    caseReference: item.caseNumber,
    timestamps: {
      timezone: '+07:00',
      createdAt: iso(source.createdAt),
      startedAt: iso(item.recordedAt),
      stoppedAt: iso(item.endedAt),
      sealedAt: item.sealedAt === null ? null : iso(item.sealedAt),
      recordingDurationMs: item.durationMs,
    },
    timeSource: {
      source: base.time.source,
      state: base.time.locked ? 'LOCKED' : 'UNLOCKED',
      stratum: base.time.stratum,
      fallbackOrder: ['GNSS', 'NTP', 'RTC'],
    },
    cameras,
    microphones,
    tracks: tracks.map((track) => ({
      trackId: track.trackId,
      label: track.label,
      file: track.file,
      mediaType: track.mediaType,
      codec:
        track.mediaType === 'video/mp4'
          ? `${media.video.codec === 'h264' ? 'H.264' : media.video.codec} ${media.video.profile} ${media.video.width}x${media.video.height} ${media.video.fps} fps`
          : `${media.audio.codec === 'aac' ? 'AAC-LC' : media.audio.codec} ${media.audio.channels === 1 ? 'mono' : `${media.audio.channels} ch`} ${media.audio.sampleRate / 1_000} kHz`,
      bytes: sealedBytes.get(track.trackId) ?? track.stored.bytes,
      durationMs: Math.round(track.durationSec * 1_000),
      hashAlgorithm: 'SHA-256',
      sha256: track.sealedSha256,
    })),
    encryption: {
      algorithm: base.security.encryption,
      applied: false,
      keyReference: `KEY-SESSION-${item.sessionId} (DEMO: not generated)`,
      note: 'DEMO: the payload is stored unencrypted so the demo can play it; a production Core encrypts it before signing (design book §12.2 step 8).',
    },
    signature: {
      algorithm: 'Ed25519',
      keyId: KEY_ID,
      purpose,
      file: PACKAGE_ITEM_FILES.signature,
      covers: 'The SHA-256 digest (32 raw bytes) of this manifest.json file',
      certificate: {
        file: PACKAGE_ITEM_FILES.certificate,
        sha256: certificate.info.sha256,
        serialNumber: certificate.info.serialNumber,
      },
      chain: ['device-certificate.pem: self-signed DEMO device certificate (no CA)'],
      demo: true,
    },
    finalizationStatus,
  };
  const manifest = {
    schema: 'dems.evidence-manifest/1',
    demo: true,
    notice: NOTICE,
    evidenceId: item.id,
    ...Object.fromEntries(MANIFEST_FIELDS.map((field) => [field.key, manifestFields[field.key]])),
    excerpt: {
      durationMs: mediaEntry.excerpt.durationMs,
      rule: 'DEMO media: each track file is an excerpt from the recording start (step 92 excerpt rule); the hashes cover these files.',
    },
  };
  const manifestBytes = jsonBytes(manifest);
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.manifest), manifestBytes);
  const digest = sha256(manifestBytes);
  const signature = signDigest(key, digest);

  // signature.sig: a labelled, detached DEMO signature.
  const signatureDoc = {
    schema: 'dems.detached-signature/1',
    demo: true,
    notice: 'DEMO SIGNATURE - made with the published DEMO key; it demonstrates the mechanism and proves nothing about real evidence.',
    algorithm: 'Ed25519',
    keyId: KEY_ID,
    purpose,
    signedFile: PACKAGE_ITEM_FILES.manifest,
    digestAlgorithm: 'SHA-256',
    digest: digest.toString('hex'),
    message: 'The 32 raw bytes of the digest',
    signature: signature.toString('base64'),
    signedAt: iso(signedAtMs),
    certificate: PACKAGE_ITEM_FILES.certificate,
    certificateSha256: certificate.info.sha256,
  };
  const signatureBytes = jsonBytes(signatureDoc);
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.signature), signatureBytes);
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.certificate), Buffer.from(certificate.pem, 'utf8'));

  // audit-session-extract.jsonl: the simulator's own rows (global seq and hashes), one per line.
  const auditText = source.auditRows.map((row) => JSON.stringify(row)).join('\n');
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.auditExtract), Buffer.from(`${auditText}\n`, 'utf8'));
  const auditRows = source.auditRows;
  const lastRow = auditRows[auditRows.length - 1] ?? fail(`Empty audit extract for ${item.id}`);
  const gaps = auditRows.filter((row, index) => index > 0 && row.seq !== (auditRows[index - 1]?.seq ?? 0) + 1).length;

  // metadata.json: the descriptive record (status and custody change after sealing, so it is not signed).
  const metadata = {
    schema: 'dems.evidence-metadata/1',
    demo: true,
    notice: NOTICE,
    evidenceId: item.id,
    sessionId: item.sessionId,
    caseNumber: item.caseNumber,
    origin: source.origin,
    status: item.status,
    lifecycleStage: item.lifecycleStage,
    session: {
      outcome: source.outcome,
      room: item.room,
      recordingProfile: profile ? { id: profile.id, label: profile.label, codec: profile.codec, bitrateMbps: profile.bitrateMbps } : null,
      createdAt: iso(source.createdAt),
      startedAt: iso(item.recordedAt),
      endedAt: iso(item.endedAt),
      sealedAt: item.sealedAt === null ? null : iso(item.sealedAt),
      durationMs: item.durationMs,
      recordingSizeBytes: item.sizeBytes,
      stopReason: source.stopReason || null,
    },
    subject: { name: item.subjectName, type: item.subjectType },
    investigator: { id: investigator.id, displayName: investigator.displayName, role: investigator.role },
    device: { id: DEVICE_ID, name: DEVICE_NAME, serialNumber: DEVICE_IDENTITY.serialNumber, softwareVersion: SOFTWARE_VERSION },
    custody: item.custody.map((entry) => ({
      at: iso(entry.at),
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorId ? operatorOf(entry.actorId).displayName : 'System',
      detail: entry.detail,
    })),
    media: {
      excerptDurationMs: mediaEntry.excerpt.durationMs,
      note: 'DEMO media are excerpts from the recording start; a player maps position p to p mod excerptDurationMs (step 92 rule).',
      mediaIndex: `${DEMO_MEDIA_FOLDER}/media-index.json`,
    },
    package: {
      items: Object.values(PACKAGE_ITEM_FILES),
      generator: GENERATOR,
      asOf: ctx.options.asOf,
    },
  };
  const metadataBytes = jsonBytes(metadata);
  writeBytes(join(packageDir, PACKAGE_ITEM_FILES.metadata), metadataBytes);

  const files = Object.fromEntries(
    (Object.keys(PACKAGE_ITEM_FILES) as PackageItemKey[]).map((itemKey) => [
      itemKey,
      fileRef(stageAssets, `${folder}/${PACKAGE_ITEM_FILES[itemKey]}`),
    ]),
  ) as Record<PackageItemKey, DemoFileRef>;

  const entry: DemoEvidencePackage = {
    evidenceSuffix,
    sessionSuffix,
    evidenceId: item.id,
    sessionId: item.sessionId,
    caseNumber: item.caseNumber,
    origin: source.origin,
    status: item.status,
    finalizationStatus,
    subjectName: item.subjectName,
    subjectType: item.subjectType,
    investigatorId: investigator.id,
    investigatorName: investigator.displayName,
    createdAt: iso(source.createdAt),
    startedAt: iso(item.recordedAt),
    endedAt: iso(item.endedAt),
    sealedAt: item.sealedAt === null ? null : iso(item.sealedAt),
    recordingDurationMs: item.durationMs,
    excerptDurationMs: mediaEntry.excerpt.durationMs,
    tampered,
    tamperedTrackId: tampered ? TAMPERED_TRACK : null,
    folder,
    files,
    tracks,
    signature: {
      algorithm: 'Ed25519',
      keyId: KEY_ID,
      purpose,
      signedAt: iso(signedAtMs),
      signedDigest: digest.toString('hex'),
      signatureHex: signature.toString('hex'),
    },
    audit: { rows: auditRows.length, firstSeq: auditRows[0]?.seq ?? 0, lastSeq: lastRow.seq, lastHash: lastRow.hash, gaps },
    export: null,
    verification: placeholderVerification(),
  };
  if (item.status === EvidenceStatus.EXPORTED) entry.export = buildExport(ctx, source, entry, { manifestBytes, signatureBytes, metadataBytes });
  if (tamperNote) log('info', 'package', `${item.id}: tamper recorded (${tamperNote})`);

  return {
    entry,
    documents: {
      manifestJson: manifestBytes.toString('utf8'),
      metadataJson: metadataBytes.toString('utf8'),
      signatureSig: signatureBytes.toString('utf8'),
      exportManifestJson: entry.export ? readFileSync(join(stageAssets, entry.export.manifest.path), 'utf8') : null,
    },
  };
}

function placeholderVerification(): DemoPrecomputedVerification {
  return {
    evidenceSuffix: '',
    evidenceId: '',
    result: 'FAIL',
    checks: [],
    failed: [],
    demo: true,
    label: DEMO_PRECOMPUTED_LABEL,
    verifiedAt: '',
    verifiedBy: '',
  };
}

// ── Export package (§19.2) for exported items ──────────────────────────────────────────────────
function exportIdFor(evidenceId: string): string {
  // Reuse the export ID of the OpenAPI example when it describes this item (step 33 tells one story).
  const example = CORE_API_EXAMPLES.exportEvidence;
  const accepted = example?.responses[202]?.accepted?.value as { exportId?: unknown; evidenceId?: unknown } | undefined;
  if (
    accepted &&
    typeof accepted.exportId === 'string' &&
    typeof accepted.evidenceId === 'string' &&
    suffixOf(accepted.evidenceId) === suffixOf(evidenceId) &&
    EXPORT_ID_PATTERN.test(accepted.exportId)
  ) {
    return accepted.exportId;
  }
  return `EXP-${String(900_000 + Number(suffixOf(evidenceId)))}`;
}

function runZip(cwd: string, zipPath: string, entries: string[]): void {
  if (!existsSync(ZIP_BIN)) fail(`${ZIP_BIN} not found (the macOS zip CLI builds the export packages)`);
  const result = spawnSync(ZIP_BIN, ['-X', '-D', '-q', '-n', '.mp4:.m4a', zipPath, ...entries], {
    cwd,
    env: { PATH: '/usr/bin:/bin', TZ: 'UTC', LC_ALL: 'C' },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`zip exited ${String(result.status)}: ${(result.stderr || result.stdout || String(result.error ?? '')).slice(-600)}`);
  }
}

function buildExport(
  ctx: BuildContext,
  source: SourceItem,
  pkg: DemoEvidencePackage,
  sealed: { manifestBytes: Buffer; signatureBytes: Buffer; metadataBytes: Buffer },
): DemoExportEntry {
  const { item } = source;
  const { key, certificate, stageAssets } = ctx;
  const exportRow =
    source.auditRows.find((row) => row.type === 'EVIDENCE_EXPORTED') ?? fail(`No EVIDENCE_EXPORTED row for ${item.id}`);
  const exporter = operatorOf(exportRow.actorId ?? fail('Export row without an actor'));
  const details = exportRow.details as { destination?: unknown; reason?: unknown };
  const destination = typeof details.destination === 'string' ? details.destination : 'Case file transfer (simulated)';
  const reason = typeof details.reason === 'string' ? details.reason : fail('Export row without a reason');
  const exportId = exportIdFor(item.id);
  const exportedAt = exportRow.at;

  // §19.3 rule 3: verify the source before exporting (tracks against the manifest, manifest against the signature).
  const sourceChecks = pkg.tracks.map((track) => ({
    check: `track:${track.trackId}`,
    ok: sha256Hex(readFileSync(resolveAsset(stageAssets, track.stored.path))) === track.sealedSha256,
  }));
  sourceChecks.push({
    check: 'signature',
    ok: verifySignature(null, sha256(sealed.manifestBytes), key.publicKey, Buffer.from(pkg.signature.signatureHex, 'hex')),
  });
  if (!sourceChecks.every((check) => check.ok)) fail(`Source verification failed for ${item.id}; not exporting`);

  // Stage the zip tree with fixed modes and times.
  const zipStage = mkdtempSync(join(tmpdir(), 'dems-demo-export-'));
  try {
    const root = exportId;
    const entryFiles = new Map<string, Buffer>();
    for (const track of pkg.tracks) entryFiles.set(`${root}/payload/${track.file}`, readFileSync(resolveAsset(stageAssets, track.stored.path)));
    entryFiles.set(`${root}/evidence/${PACKAGE_ITEM_FILES.manifest}`, sealed.manifestBytes);
    entryFiles.set(`${root}/evidence/${PACKAGE_ITEM_FILES.signature}`, sealed.signatureBytes);
    entryFiles.set(`${root}/evidence/${PACKAGE_ITEM_FILES.certificate}`, Buffer.from(certificate.pem, 'utf8'));
    entryFiles.set(`${root}/evidence/${PACKAGE_ITEM_FILES.metadata}`, sealed.metadataBytes);
    entryFiles.set(`${root}/evidence/${PACKAGE_ITEM_FILES.auditExtract}`, readFileSync(join(stageAssets, pkg.files.auditExtract.path)));
    const listed = [...entryFiles.entries()].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256Hex(bytes) }));
    const record = {
      schema: 'dems.export-record/1',
      demo: true,
      notice: NOTICE,
      export: { exportId, exportedAt: iso(exportedAt), exportingOperator: { id: exporter.id, displayName: exporter.displayName, role: exporter.role } },
      source: { deviceId: DEVICE_ID, deviceSerialNumber: DEVICE_IDENTITY.serialNumber, sessionId: item.sessionId, evidenceId: item.id, caseNumber: item.caseNumber },
      destination: { id: destination },
      authorization: { purpose: reason, reference: exportRow.id, permission: 'EVIDENCE_EXPORT', role: exporter.role },
      sourceVerification: { at: iso(exportedAt - 20_000), result: 'PASS', checks: sourceChecks },
      entries: listed,
      verify: 'Hash each entry and compare with this list; hash evidence/manifest.json and verify evidence/signature.sig (Ed25519 over the digest) with evidence/device-certificate.pem.',
    };
    entryFiles.set(`${root}/export-record.json`, jsonBytes(record));
    const names = [...entryFiles.keys()].sort();
    const mtimeSec = Math.floor(exportedAt / 2_000) * 2; // DOS times have 2 s resolution
    for (const name of names) {
      const path = join(zipStage, name);
      writeBytes(path, entryFiles.get(name) ?? Buffer.alloc(0));
      chmodSync(path, 0o644);
      utimesSync(path, mtimeSec, mtimeSec);
    }
    const zipName = `${exportId}.zip`;
    const zipTemp = join(zipStage, zipName);
    runZip(zipStage, zipTemp, names);
    const zipBytes = readFileSync(zipTemp);
    const exportDir = `${pkg.folder}/export`;
    writeBytes(join(stageAssets, exportDir, zipName), zipBytes);

    // export-manifest.json: the 8 §19.2 items; it records the zip hash, so it sits beside the zip.
    const exportItems: Record<(typeof EXPORT_MANIFEST_ITEMS)[number]['key'], unknown> = {
      payload: {
        representation: 'Original track files (DEMO excerpts, unencrypted)',
        files: pkg.tracks.map((track) => ({
          trackId: track.trackId,
          path: `${root}/payload/${track.file}`,
          bytes: track.stored.bytes,
          sha256: track.sealedSha256,
        })),
      },
      sessionManifest: {
        path: `${root}/evidence/${PACKAGE_ITEM_FILES.manifest}`,
        sha256: pkg.signature.signedDigest,
        tracks: pkg.tracks.map((track) => ({ trackId: track.trackId, sha256: track.sealedSha256 })),
      },
      signature: {
        path: `${root}/evidence/${PACKAGE_ITEM_FILES.signature}`,
        algorithm: 'Ed25519',
        keyId: KEY_ID,
        certificate: `${root}/evidence/${PACKAGE_ITEM_FILES.certificate}`,
        certificateSha256: certificate.info.sha256,
        chain: ['Self-signed DEMO device certificate (no CA)'],
      },
      export: {
        exportId,
        exportedAt: iso(exportedAt),
        exportingOperator: { id: exporter.id, displayName: exporter.displayName, role: exporter.role },
      },
      source: {
        device: { id: DEVICE_ID, name: DEVICE_NAME, serialNumber: DEVICE_IDENTITY.serialNumber, certificateSha256: certificate.info.sha256 },
        sessionId: item.sessionId,
        evidenceId: item.id,
        caseNumber: item.caseNumber,
      },
      destination: { id: destination, type: 'CASE_FILE_TRANSFER' },
      package: {
        file: zipName,
        bytes: zipBytes.length,
        hashAlgorithm: 'SHA-256',
        sha256: sha256Hex(zipBytes),
        entries: names.length,
        verification: {
          sourceVerifiedAt: iso(exportedAt - 20_000),
          sourceResult: 'PASS',
          packageResult: 'PASS',
          note: 'Source tracks and manifest signature verified before export (§19.3 rule 3); package hash computed after the build.',
        },
      },
      authorization: {
        purpose: reason,
        reference: exportRow.id,
        permission: 'EVIDENCE_EXPORT',
        role: exporter.role,
      },
    };
    const exportManifest = {
      schema: 'dems.export-manifest/1',
      demo: true,
      notice: NOTICE,
      ...Object.fromEntries(EXPORT_MANIFEST_ITEMS.map((entry) => [entry.key, exportItems[entry.key]])),
    };
    const exportManifestBytes = jsonBytes(exportManifest);
    writeBytes(join(stageAssets, exportDir, 'export-manifest.json'), exportManifestBytes);
    const exportDigest = sha256(exportManifestBytes);
    const exportSignature = signDigest(key, exportDigest);
    const exportSignatureDoc = {
      schema: 'dems.detached-signature/1',
      demo: true,
      notice: 'DEMO SIGNATURE - made with the published DEMO key; it demonstrates the mechanism and proves nothing.',
      algorithm: 'Ed25519',
      keyId: KEY_ID,
      purpose: 'EXPORT',
      signedFile: 'export-manifest.json',
      digestAlgorithm: 'SHA-256',
      digest: exportDigest.toString('hex'),
      message: 'The 32 raw bytes of the digest',
      signature: exportSignature.toString('base64'),
      signedAt: iso(exportedAt),
      certificate: `../${PACKAGE_ITEM_FILES.certificate}`,
      certificateSha256: certificate.info.sha256,
    };
    writeBytes(join(stageAssets, exportDir, 'export-manifest.sig'), jsonBytes(exportSignatureDoc));
    log('info', 'export', `${item.id}: ${zipName} ${zipBytes.length} B, ${names.length} entries`, { exportId, sha256: sha256Hex(zipBytes) });
    return {
      exportId,
      exportedAt: iso(exportedAt),
      exportedBy: exporter.id,
      exportedByName: exporter.displayName,
      exportedByRole: exporter.role,
      destination,
      reason,
      authorizationRef: exportRow.id,
      zip: fileRef(stageAssets, `${exportDir}/${zipName}`),
      manifest: fileRef(stageAssets, `${exportDir}/export-manifest.json`),
      signature: fileRef(stageAssets, `${exportDir}/export-manifest.sig`),
      signatureHex: exportSignature.toString('hex'),
      entries: names.length,
    };
  } finally {
    rmSync(zipStage, { recursive: true, force: true });
  }
}

// ── Independent verification with Node crypto (the precomputed results) ────────────────────────
function nodeVerify(stageAssets: string, pkg: DemoEvidencePackage, key: DemoKey, certInfo: DemoCertificateInfo): DemoCheckResult[] {
  const read = (path: string): Buffer => readFileSync(resolveAsset(stageAssets, path));
  const checks: DemoCheckResult[] = [];
  const add = (id: DemoCheckResult['id'], ok: boolean, expected: string | null, actual: string | null, detail?: string): void => {
    checks.push(detail === undefined || ok ? { id, ok, expected, actual, source: 'precomputed' } : { id, ok, expected, actual, source: 'precomputed', detail });
  };
  const manifest = JSON.parse(read(pkg.files.manifest.path).toString('utf8')) as { tracks: { trackId: string; sha256: string }[] };
  for (const track of pkg.tracks) {
    const expected = manifest.tracks.find((entry) => entry.trackId === track.trackId)?.sha256 ?? null;
    const actual = sha256Hex(read(track.stored.path));
    add(`track:${track.trackId}`, actual === expected, expected, actual, 'Stored media differs from the sealed hash');
  }
  const manifestBytes = read(pkg.files.manifest.path);
  const signatureDoc = JSON.parse(read(pkg.files.signature.path).toString('utf8')) as { digest: string; signature: string };
  const manifestDigest = sha256Hex(manifestBytes);
  add('manifest', manifestDigest === signatureDoc.digest, signatureDoc.digest, manifestDigest, 'manifest.json differs from the signed digest');
  const x509 = new X509Certificate(read(pkg.files.certificate.path));
  const signatureOk = verifySignature(null, sha256(manifestBytes), x509.publicKey, Buffer.from(signatureDoc.signature, 'base64'));
  add('signature', signatureOk, 'VALID', signatureOk ? 'VALID' : 'INVALID', 'Signature does not verify');
  const certSha = sha256Hex(x509.raw);
  const keyRaw = Buffer.from((x509.publicKey.export({ format: 'jwk' }) as { x?: string }).x ?? '', 'base64url');
  const signedAt = Date.parse(pkg.signature.signedAt);
  const certOk =
    certSha === certInfo.sha256 &&
    x509.verify(x509.publicKey) &&
    keyRaw.equals(key.publicRaw) &&
    x509.subject.includes('DEMO — NOT FOR PRODUCTION') &&
    signedAt >= x509.validFromDate.getTime() &&
    signedAt <= x509.validToDate.getTime();
  add('certificate', certOk, certInfo.sha256, certSha, 'Certificate check failed');
  const rows = read(pkg.files.auditExtract.path).toString('utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as AuditRow);
  let chainOk = rows.length === pkg.audit.rows;
  rows.forEach((row, index) => {
    // The simulator's chain rule (step 31): hash = sha256(prevHash ‖ canonicalJSON(body)).
    if (chainHash(row.prevHash, auditBody(row)) !== row.hash) chainOk = false;
    const previous = rows[index - 1];
    if (previous && (row.seq <= previous.seq || (row.seq === previous.seq + 1 && row.prevHash !== previous.hash))) chainOk = false;
  });
  const head = rows[rows.length - 1]?.hash ?? null;
  add('auditChain', chainOk && head === pkg.audit.lastHash, pkg.audit.lastHash, head, 'Audit extract does not verify');
  if (pkg.export) {
    const exportManifestBytes = read(pkg.export.manifest.path);
    const recorded = (JSON.parse(exportManifestBytes.toString('utf8')) as { package: { sha256: string } }).package.sha256;
    const zipSha = sha256Hex(read(pkg.export.zip.path));
    add('exportPackage', zipSha === recorded, recorded, zipSha, 'Export zip differs from its export manifest');
    const exportSig = JSON.parse(read(pkg.export.signature.path).toString('utf8')) as { signature: string };
    const exportSigOk = verifySignature(null, sha256(exportManifestBytes), x509.publicKey, Buffer.from(exportSig.signature, 'base64'));
    add('exportSignature', exportSigOk, 'VALID', exportSigOk ? 'VALID' : 'INVALID', 'Export signature does not verify');
  }
  return checks;
}

// ── Generated TypeScript modules ────────────────────────────────────────────────────────────────
const GENERATED_HEADER = [
  '// GENERATED by packages/shared/scripts/gen-demo-evidence.ts (blueprint step 93). Do not edit: re-run the generator.',
  '// DEMO data: synthetic evidence packages signed with a DEMO key derived from a published seed (D51).',
].join('\n');

function indexModule(index: DemoEvidenceIndex): string {
  return `${GENERATED_HEADER}
import type { DemoEvidenceIndex } from './types';

export const DEMO_EVIDENCE_INDEX: DemoEvidenceIndex = ${JSON.stringify(index, null, 2)};
`;
}

function documentsModule(certificatePem: string, documents: Record<string, DemoEvidenceDocuments>): string {
  return `${GENERATED_HEADER}
import type { DemoEvidenceDocuments } from './types';

/** The DEMO device certificate (identical in every package). */
export const DEMO_DEVICE_CERTIFICATE_PEM: string = ${JSON.stringify(certificatePem)};

/** Package texts by evidence suffix. \`manifestJson\` is byte-exact: its SHA-256 is the signed digest. */
export const DEMO_EVIDENCE_DOCUMENTS: Readonly<Record<string, DemoEvidenceDocuments>> = ${JSON.stringify(documents, null, 2)};
`;
}

function readmeText(index: DemoEvidenceIndex): string {
  const rows = index.packages
    .map(
      (pkg) =>
        `| ${pkg.evidenceSuffix} | ${pkg.sessionId} | ${pkg.status} | ${pkg.finalizationStatus} | ${pkg.origin === 'RECORDING_SCENARIO' ? 'recording scenario (sealed at run time)' : 'dataset'} | ${pkg.tampered ? `**TAMPERED** (${pkg.tamperedTrackId ?? ''})` : ''}${pkg.export ? `export ${pkg.export.exportId}` : ''} | ${pkg.verification.result} |`,
    )
    .join('\n');
  return `# DEMO evidence packages (step 93)

**DEMO ONLY - NOT EVIDENCE - NOT FOR PRODUCTION.** Every package here is synthetic and is signed with a DEMO
Ed25519 key that anyone can re-derive from the published phrase below. A valid signature proves nothing.

Generated by \`${GENERATOR}\` for \`--as-of ${index.asOf}\` (WIB). Do not edit by hand: regenerate.

## Layout (design book §11.2)

Each \`SESSION-<session ID>/\` folder holds:

| File | Content |
|---|---|
| \`evidence-container.json\` | Stands in for the encrypted media payload. Points to the step-92 media in \`../demo-media/\` (paths relative to \`packages/shared/assets/\`). The demo keeps the media unencrypted so it can be played |
| \`metadata.json\` | Descriptive record: session, subject, investigator, device, status, custody. Not signed (status and custody change after sealing) |
| \`manifest.json\` | The 13 §11.3 fields, including the SHA-256 of each of the four track files (VIDEO-01, VIDEO-02, AUDIO-01 = MIC 1, AUDIO-02 = MIC 2) |
| \`signature.sig\` | JSON: detached Ed25519 signature over the 32-byte SHA-256 digest of \`manifest.json\` (\`purpose\` SEAL, or RECOVERY_ATTESTATION for the incomplete session) |
| \`device-certificate.pem\` | Self-signed X.509 v3 certificate of the DEMO key, subject \`${index.certificate.subject}\` |
| \`audit-session-extract.jsonl\` | The session's rows of the simulator audit chain at \`--as-of\` (global \`seq\`, \`prevHash\`, \`hash\`; rule \`hash = sha256(prevHash ‖ canonicalJSON(body))\`). Rows of other sessions are left out, so \`seq\` may jump |
| \`media/AUDIO-02.m4a\` | Only in the TAMPERED package: MIC 2 altered after sealing |
| \`export/\` | Only for exported items: \`EXP-<id>.zip\`, \`export-manifest.json\` (the 8 §19.2 items, including the zip's SHA-256) and \`export-manifest.sig\` |

## Items

| Evidence | Session | Status | Finalization | Origin | Notes | Precomputed |
|---|---|---|---|---|---|---|
${rows}

- Join packages to the simulator by the **evidence suffix** (D61). Session suffixes are a separate namespace.
- The recording-scenario item (session ${index.liveSession.sessionSuffix} → evidence ${index.liveSession.evidenceSuffixWhenSealed}) is built from the simulator's \`finalizing\` scenario at \`--as-of\`; in a live demo its times come from the simulator.
- The TAMPERED package (evidence ${index.tamperedEvidenceSuffix}) fails exactly one check: \`track:AUDIO-02\`. Its manifest, signature, certificate and audit extract all verify.

## DEMO key

- Algorithm Ed25519, key ID \`${index.key.keyId}\`, public key \`${index.key.publicKeyHex}\`.
- Seed = SHA-256 of the UTF-8 bytes of the published phrase:
  \`${index.key.seedPhrase}\`
- The private key exists only in memory while the generator runs. No private-key file is written.

## Verify by hand

\`\`\`sh
cd packages/shared/assets/demo-evidence/SESSION-<id>
shasum -a 256 manifest.json                  # equals "digest" in signature.sig
openssl x509 -in device-certificate.pem -noout -subject -dates -fingerprint -sha256
\`\`\`

The typed index and the pure verify helper are in \`packages/shared/src/demo-data/\` (\`@dems/shared/demo-data\`);
\`packages/shared/test/demo-evidence.test.ts\` recomputes every hash and signature.

## Regenerate

\`\`\`sh
cd packages/shared
node --import tsx scripts/gen-demo-evidence.ts --as-of ${index.asOf}
\`\`\`

- \`--as-of\` (WIB; a date alone means 10:00) re-dates IDs, times, audit rows and signatures; media hashes stay the same.
- Use the same \`--as-of\` as the step-92 media, and regenerate after any step-92 regeneration.
- The output is deterministic: the same \`--as-of\` gives the same bytes.
`;
}

// ── Publishing ──────────────────────────────────────────────────────────────────────────────────
function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(posix(relative(root, path)));
    }
  };
  walk(root);
  return out;
}

function removeEmptyDirs(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      removeEmptyDirs(path);
      if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
    }
  }
}

function publish(stageRoot: string, outRoot: string): { written: number; pruned: number } {
  const stagedEvidence = join(stageRoot, 'assets', DEMO_EVIDENCE_FOLDER);
  const targetEvidence = join(outRoot, 'assets', DEMO_EVIDENCE_FOLDER);
  const staged = listFiles(stagedEvidence);
  const existing = new Set(listFiles(targetEvidence));
  let pruned = 0;
  for (const path of existing) {
    if (!staged.includes(path)) {
      rmSync(join(targetEvidence, path));
      pruned += 1;
    }
  }
  removeEmptyDirs(targetEvidence);
  for (const path of staged) writeBytes(join(targetEvidence, path), readFileSync(join(stagedEvidence, path)));
  for (const name of ['packages.generated.ts', 'documents.generated.ts']) {
    writeBytes(join(outRoot, 'src', 'demo-data', name), readFileSync(join(stageRoot, 'src', 'demo-data', name)));
  }
  return { written: staged.length + 2, pruned };
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const started = Date.now();
  const options = parseOptions(process.argv.slice(2));
  const media = readMediaIndex();
  if (media.asOf !== options.asOf) {
    log('warn', 'main', `Step-92 media were generated for --as-of ${media.asOf}; packages use ${options.asOf} (burned-in OSD dates may differ)`, {
      mediaAsOf: media.asOf,
      asOf: options.asOf,
    });
  }
  const { base, items } = loadSimulatorItems(options.now);
  const key = deriveDemoKey();
  const certificate = buildCertificate(key);
  const stageRoot = mkdtempSync(join(tmpdir(), 'dems-demo-evidence-'));
  const stageAssets = join(stageRoot, 'assets');
  log('info', 'main', `as-of ${options.asOf}; ${items.length} items; stage ${stageRoot}; out ${options.outRoot}`, {
    asOf: options.asOf,
    items: items.length,
    preview: options.preview,
  });
  try {
    const ctx: BuildContext = { options, media, base, key, certificate, stageAssets };
    const built = items.map((source) => buildPackage(ctx, source));
    const certificateInfo: DemoCertificateInfo = {
      ...certificate.info,
      path: built[0]?.entry.files.certificate.path ?? fail('No package built'),
    };

    // Precomputed verification (Node crypto), cross-checked with the pure helper (noble + WebCrypto).
    const trust = { certificateSha256: certificateInfo.sha256, publicKeyHex: key.publicRaw.toString('hex') };
    const loader = async (assetPath: string): Promise<Uint8Array> => new Uint8Array(readFileSync(resolveAsset(stageAssets, assetPath)));
    for (const { entry } of built) {
      const checks = nodeVerify(stageAssets, entry, key, certificateInfo);
      const report = buildReport(entry, checks, DEMO_PRECOMPUTED_LABEL);
      entry.verification = {
        ...report,
        verifiedAt: iso(options.now),
        verifiedBy: 'gen-demo-evidence.ts with Node crypto at generation time (DEMO precomputation)',
      };
      const order = checkOrder(entry);
      if (order.join() !== checks.map((check) => check.id).join()) fail(`${entry.evidenceId}: check order differs from checkOrder()`);
      const pure = await verifyDemoPackage(entry, loader, { subtle: webcrypto.subtle, trust });
      const disagreement = pure.checks.find((check, index) => {
        const node = checks[index];
        return !node || node.id !== check.id || node.ok !== check.ok || check.source !== 'computed';
      });
      if (disagreement) fail(`${entry.evidenceId}: pure helper and Node crypto disagree on ${disagreement.id}`);
      const expectedFailures = entry.tampered ? [`track:${TAMPERED_TRACK}`] : [];
      if (report.failed.join() !== expectedFailures.join()) {
        fail(`${entry.evidenceId}: failed checks [${report.failed.join(', ')}], expected [${expectedFailures.join(', ')}]`);
      }
    }
    const tamperedCount = built.filter(({ entry }) => entry.tampered).length;
    if (tamperedCount !== 1) fail(`Expected exactly one TAMPERED package, built ${tamperedCount}`);

    const liveItem = items.find((source) => source.origin === 'RECORDING_SCENARIO') ?? fail('No recording-scenario item');
    const exported = built.map(({ entry }) => entry).filter((entry) => entry.export !== null);
    const firstExport = exported[0]?.export ?? fail('No exported item in the dataset');
    const apiExamples: DemoApiExamplePayloads = {
      sessionCreate: {
        request: {
          caseNumber: liveItem.item.caseNumber,
          subjectType: liveItem.item.subjectType,
          subjectName: liveItem.item.subjectName,
          investigatorId: liveItem.item.investigatorId,
          room: liveItem.item.room,
          profileId: liveItem.item.profileId,
        },
      },
      evidenceExport: {
        evidenceId: exported[0]?.evidenceId ?? '',
        request: { reason: firstExport.reason, destination: firstExport.destination },
        response: { exportId: firstExport.exportId, evidenceId: exported[0]?.evidenceId ?? '', status: 'QUEUED' },
      },
    };
    const keyInfo: DemoSigningKeyInfo = {
      keyId: KEY_ID,
      algorithm: 'Ed25519',
      publicKeyHex: key.publicRaw.toString('hex'),
      seedPhrase: DEMO_SEED_PHRASE,
      derivation: 'seed = SHA-256(UTF-8 bytes of seedPhrase); Ed25519 private key = seed (RFC 8032); held in memory only, never written',
      notice: 'DEMO key: anyone can re-derive it from the published phrase, so its signatures prove nothing.',
    };
    const index: DemoEvidenceIndex = {
      schema: DEMO_EVIDENCE_INDEX_SCHEMA,
      demo: true,
      notice: NOTICE,
      generator: GENERATOR,
      asOf: options.asOf,
      datasetNow: iso(options.now),
      timezone: '+07:00',
      joinKey: DEMO_EVIDENCE_JOIN_KEY,
      assetRoot: 'packages/shared/assets',
      folder: DEMO_EVIDENCE_FOLDER,
      key: keyInfo,
      certificate: certificateInfo,
      tamperedEvidenceSuffix: formatSeq(TAMPERED_EVIDENCE_SEQ),
      exportedEvidenceSuffixes: exported.map((entry) => entry.evidenceSuffix),
      liveSession: { sessionSuffix: formatSeq(RECORDING_SCENARIO.sessionSeq), evidenceSuffixWhenSealed: formatSeq(IDLE_COUNTERS.evidence) },
      packages: built.map(({ entry }) => entry),
      apiExamples,
    };
    const documents = Object.fromEntries(built.map(({ entry, documents: docs }) => [entry.evidenceSuffix, docs]));
    writeBytes(join(stageAssets, DEMO_EVIDENCE_FOLDER, 'README.md'), Buffer.from(readmeText(index), 'utf8'));
    writeBytes(join(stageRoot, 'src', 'demo-data', 'packages.generated.ts'), Buffer.from(indexModule(index), 'utf8'));
    writeBytes(join(stageRoot, 'src', 'demo-data', 'documents.generated.ts'), Buffer.from(documentsModule(certificate.pem, documents), 'utf8'));

    const leaked = listFiles(stageRoot).filter((path) => readFileSync(join(stageRoot, path)).includes('PRIVATE KEY'));
    if (leaked.length > 0) fail(`Private key material found in the output: ${leaked.join(', ')}`);

    const result = publish(stageRoot, options.outRoot);
    rmSync(stageRoot, { recursive: true, force: true });
    log('info', 'main', `done in ${((Date.now() - started) / 1_000).toFixed(1)} s: ${result.written} files written, ${result.pruned} pruned`, {
      ...result,
      packages: built.length,
      exports: exported.length,
      tampered: formatSeq(TAMPERED_EVIDENCE_SEQ),
    });
  } catch (error) {
    log('error', 'main', `failed; staging kept at ${stageRoot}`, { stageRoot }, error);
    throw error;
  }
}

main().catch((error: unknown) => {
  log('error', 'main', error instanceof Error ? error.message : String(error), {}, error);
  process.exitCode = 1;
});
