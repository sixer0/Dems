/**
 * Demo media generator (blueprint step 92; decisions D46, D50, D51; Parallel Execution Protocol P6, P13).
 *
 * Writes packages/shared/assets/demo-media/ (and nothing else in the repository):
 *   evidence/<NNNN>/VIDEO-01.mp4, VIDEO-02.mp4     H.264 1280x720 25 fps, one excerpt per evidence item
 *   evidence/<NNNN>/AUDIO-01.m4a, AUDIO-02.m4a     AAC mono 48 kHz; MIC 1 (interviewer) and MIC 2 (subject)
 *   evidence/<NNNN>/VIDEO-0x.poster.jpg, .thumb.jpg 1280x720 poster and 320x180 thumbnail (frame at 1 s)
 *     <NNNN> is the evidence number suffix (EV-YYYYMMDD-NNNN), the join key for every consumer (D61).
 *   live/VIDEO-0x.loop.mp4, AUDIO-0x.loop.m4a        seamless live-feed loops for RECORDING_SCENARIO.sessionSeq
 *   live/VIDEO-0x.poster.jpg, .thumb.jpg
 *   mobile/*                                         640x360 subset with flat, lowercase, Android-safe names
 *   media-index.json                                 machine-readable index (IDs, durations, sizes, SHA-256)
 *   README.md                                        provenance, licences, voice, regeneration
 *
 * Sources (no new licensed source):
 *   - Pictures: the step-29 hero still packages/shared/assets/hero/room-2560.jpg (Pexels 3906592, Pexels License,
 *     recorded in THIRD_PARTY_NOTICES.md). Cam 1 is a wide 16:9 crop; Cam 2 a tighter, mirrored reverse-angle crop.
 *     Both get a dark-warm grade (D46), slow push-in and drift (03_motion_spec "Slow push-in"), temporal sensor
 *     noise, vignette, a scanline band and a burned-in OSD.
 *   - Voices: eSpeak NG (formant synthesis, `id` voice). D51 rules out macOS `say` (system-voice output is licensed
 *     for personal, non-commercial use) and Piper's only Indonesian model (licence not permissive: see README.md).
 *     The output of a GPL program is not covered by the program's licence (GNU GPL FAQ #GPLOutput); the input text
 *     is this file's own fictional script. If espeak-ng is missing, a speech-like synthetic voice is used instead.
 *   - OSD glyphs: a hand-authored 5x7 bitmap font in this file (the Homebrew ffmpeg has no drawtext/freetype, and
 *     no system font is embedded in the media).
 *
 * Canonical data: sessions, subjects, investigators and start times come from `buildHistory()` and
 * `RECORDING_SCENARIO` in src/sim/dataset.ts (steps 31 and 32), evaluated at the simulator time `--as-of` (WIB,
 * UTC+07:00, D28; default 2026-10-01T10:00). Each session gets a short excerpt from its recording start (full
 * durations are 13-68 min; the excerpt length follows the interview script). The recording scenario session gets
 * seamless loops instead, whose OSD carries no running clock and no REC (the UI overlays both from the simulator
 * clock, and idle tiles reuse the loops).
 *
 * Deterministic: no Math.random and no wall clock in any output; fixed seeds, fixed encoder threads and bitexact
 * muxing. The same --as-of on the same tool versions gives the same file list, durations and bytes.
 *
 * Tools: Node built-ins, the ffmpeg/ffprobe CLI (Homebrew `ffmpeg`) and the espeak-ng CLI (Homebrew `espeak-ng`).
 * No npm package, no package.json script (P1, D49).
 *
 * Run (from packages/shared): node --import tsx scripts/gen-demo-media.ts [--as-of YYYY-MM-DD[THH:MM]]
 *   [--voice auto|espeak|synthetic] [--out <dir>] [--only 0011,0024] [--keep-temp]
 * `--out` or `--only` write a preview elsewhere; only the default run replaces assets/demo-media.
 * A structured JSON-lines run log is written to $TMPDIR/dems-gen-demo-media/ (outside the repository).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { crc32, deflateSync } from 'node:zlib';
import { formatSeq, toWibIso, wibDateParts } from '../src/sim/clock';
import {
  buildHistory,
  DEVICE_ID,
  DEVICE_NAME,
  IDLE_COUNTERS,
  OPERATORS,
  RECORDING_SCENARIO,
  sessionIdFor,
} from '../src/sim/dataset';

// ── Paths and constants ─────────────────────────────────────────────────────────────────────────
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, '..');
const HERO_PATH = join(PKG_DIR, 'assets', 'hero', 'room-2560.jpg');
const DEFAULT_OUT = join(PKG_DIR, 'assets', 'demo-media');

const DEFAULT_AS_OF = '2026-10-01T10:00';
const FPS = 25;
const VIDEO_W = 1280;
const VIDEO_H = 720;
const MOBILE_W = 640;
const MOBILE_H = 360;
const BASE_W = 1920;
const BASE_H = 1080;
const TTS_RATE = 22_050;
const OUT_AUDIO_RATE = 48_000;
const OSD_SCALE = 3;
const OSD_MARGIN = 24;
const OSD_ROW_H = 64;
const BAND_H = 110;
const SCANLINE_PERIOD_FRAMES = 150; // 6 s (03_motion_spec `scanline`)
const SCANLINE_SWEEP_FRAMES = 30; // 1.2 s sweep
const ENCODER_THREADS = '4';

const X264_DESKTOP = [
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-profile:v', 'high', '-level:v', '3.1',
  '-pix_fmt', 'yuv420p', '-g', '125', '-keyint_min', '125', '-sc_threshold', '0', '-bf', '3',
  '-maxrate', '900k', '-bufsize', '1800k', '-threads', ENCODER_THREADS,
];
const X264_MOBILE = [
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-profile:v', 'main', '-level:v', '3.0',
  '-pix_fmt', 'yuv420p', '-g', '125', '-keyint_min', '125', '-sc_threshold', '0', '-bf', '3',
  '-maxrate', '380k', '-bufsize', '760k', '-threads', ENCODER_THREADS,
];
const MUX_BITEXACT = ['-fflags', '+bitexact', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart'];
const MOBILE_AUDIO_RATE = 24_000;
const AAC_DESKTOP = ['-c:a', 'aac', '-b:a', '48k', '-ac', '1', '-ar', String(OUT_AUDIO_RATE), '-flags:a', '+bitexact'];
const AAC_MOBILE = ['-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-ar', String(MOBILE_AUDIO_RATE), '-flags:a', '+bitexact'];

// ── Structured run log (persistent, outside the repository) ────────────────────────────────────
type LogLevel = 'info' | 'warn' | 'error';
const RUN_ID = `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const LOG_DIR = join(tmpdir(), 'dems-gen-demo-media');
const LOG_PATH = join(LOG_DIR, `${RUN_ID}.jsonl`);

function log(level: LogLevel, source: string, message: string, context: Record<string, unknown> = {}, error?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    source: `gen-demo-media.${source}`,
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

// ── Process helpers ────────────────────────────────────────────────────────────────────────────
class ToolError extends Error {
  readonly command: string;
  readonly stderrTail: string;

  constructor(message: string, command: string, stderrTail: string) {
    super(message);
    this.name = 'ToolError';
    this.command = command;
    this.stderrTail = stderrTail;
  }
}

function run(command: string, args: readonly string[], source: string): string {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    throw new ToolError(`${command} could not start: ${result.error.message}`, command, '');
  }
  if (result.status !== 0) {
    const stderrTail = (result.stderr ?? '').split('\n').slice(-12).join('\n');
    log('error', source, `${command} exited with ${String(result.status)}`, { args: args.slice(0, 40), stderrTail });
    throw new ToolError(`${command} failed in ${source} (exit ${String(result.status)})`, command, stderrTail);
  }
  return result.stdout ?? '';
}

function toolVersion(command: string, args: readonly string[], pattern: RegExp): string | null {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const match = pattern.exec(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  return match?.[1] ?? null;
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function probeDuration(path: string): number {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], 'probe');
  return Number.parseFloat(out.trim());
}

// ── Deterministic RNG (mulberry32) ─────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ── PNG encoder and a tiny RGBA canvas ─────────────────────────────────────────────────────────
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);
  return Buffer.concat([length, typed, crc]);
}

class Canvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  /** Source-over blend of one pixel (straight alpha, 0..1). */
  blend(x: number, y: number, rgb: readonly [number, number, number], alpha: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || alpha <= 0) return;
    const i = (y * this.width + x) * 4;
    const a = Math.min(1, alpha);
    const dstA = (this.data[i + 3] ?? 0) / 255;
    const outA = a + dstA * (1 - a);
    for (let c = 0; c < 3; c += 1) {
      const src = rgb[c] ?? 0;
      const dst = this.data[i + c] ?? 0;
      this.data[i + c] = Math.round(outA > 0 ? (src * a + dst * dstA * (1 - a)) / outA : 0);
    }
    this.data[i + 3] = Math.round(outA * 255);
  }

  fillRect(x: number, y: number, w: number, h: number, rgb: readonly [number, number, number], alpha: number): void {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) this.blend(xx, yy, rgb, alpha);
  }

  fillCircle(cx: number, cy: number, r: number, rgb: readonly [number, number, number], alpha: number): void {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y += 1) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const coverage = Math.max(0, Math.min(1, r + 0.5 - d));
        this.blend(x, y, rgb, alpha * coverage);
      }
    }
  }

  toPng(): Buffer {
    const stride = this.width * 4;
    const raw = Buffer.alloc((stride + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      raw[y * (stride + 1)] = 0;
      raw.set(this.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    return Buffer.concat([
      PNG_SIGNATURE,
      pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(raw, { level: 9 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

// ── 5x7 bitmap font (hand-authored; CCTV OSD style) ────────────────────────────────────────────
const FONT: Readonly<Record<string, readonly string[]>> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['.....', '....#', '...#.', '..#..', '.#...', '#....', '.....'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};
const GLYPH_W = 5;
const GLYPH_H = 7;
const OSD_WHITE: readonly [number, number, number] = [244, 244, 238];
const OSD_BLACK: readonly [number, number, number] = [0, 0, 0];
const REC_RED: readonly [number, number, number] = [239, 68, 68]; // --danger #EF4444 (research/04 §2)

function textWidth(text: string, scale: number): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_W + 1) - 1) * scale;
}

/** Draws `text` with its top-left at (x, y): black outline (`outline` px), then the white fill. */
function drawText(canvas: Canvas, text: string, x: number, y: number, scale: number, outline = 2): void {
  const w = textWidth(text, scale);
  const h = GLYPH_H * scale;
  const mask = new Uint8Array(w * h);
  [...text.toUpperCase()].forEach((ch, index) => {
    const glyph = FONT[ch] ?? FONT[' '] ?? [];
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < GLYPH_W; gx += 1) {
        if (row[gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            mask[(gy * scale + sy) * w + index * (GLYPH_W + 1) * scale + gx * scale + sx] = 1;
          }
        }
      }
    });
  });
  const inMask = (mx: number, my: number): boolean => mx >= 0 && my >= 0 && mx < w && my < h && mask[my * w + mx] === 1;
  for (let my = -outline; my < h + outline; my += 1) {
    for (let mx = -outline; mx < w + outline; mx += 1) {
      if (inMask(mx, my)) continue;
      let near = false;
      for (let dy = -outline; dy <= outline && !near; dy += 1) {
        for (let dx = -outline; dx <= outline && !near; dx += 1) near = inMask(mx + dx, my + dy);
      }
      if (near) canvas.blend(x + mx, y + my, OSD_BLACK, 0.82);
    }
  }
  for (let my = 0; my < h; my += 1) {
    for (let mx = 0; mx < w; mx += 1) if (inMask(mx, my)) canvas.blend(x + mx, y + my, OSD_WHITE, 1);
  }
}

// ── Domain model ───────────────────────────────────────────────────────────────────────────────
type TrackId = 'VIDEO-01' | 'VIDEO-02' | 'AUDIO-01' | 'AUDIO-02';
type Speaker = 'interviewer' | 'subject';

interface MediaSession {
  seq: number;
  suffix: string;
  sessionId: string;
  evidenceId: string | null;
  evidenceSuffix: string | null;
  subjectName: string;
  subjectType: string;
  investigatorId: string;
  investigatorName: string;
  startedAt: number | null;
  sessionDurationMs: number | null;
  outcome: string;
  live: boolean;
}

interface Voice {
  variant: string;
  pitch: number;
  speed: number;
  female: boolean;
}

interface ScriptLine {
  speaker: Speaker;
  text: string;
}

interface Camera {
  track: 'VIDEO-01' | 'VIDEO-02';
  deviceId: string;
  label: string;
  /** Crop of the 2560x1706 still before the working-size scale, plus mirror and grade. */
  crop: { w: number; h: number; x: number; y: number };
  mirror: boolean;
  grade: { brightness: number; sepia: number; saturate: number; contrast: number; gamma: number };
  phase: number;
}

const CAMERAS: readonly Camera[] = [
  {
    track: 'VIDEO-01',
    deviceId: 'CAM-01',
    label: 'Camera 1 (wide)',
    // Full-width 16:9 band of the 3:2 still at object-position ~62% 45% (D46): y = (1706 - 1440) x 0.45.
    crop: { w: 2560, h: 1440, x: 0, y: 120 },
    mirror: false,
    grade: { brightness: 0.84, sepia: 0.22, saturate: 0.8, contrast: 1.05, gamma: 0.97 },
    phase: 0,
  },
  {
    track: 'VIDEO-02',
    deviceId: 'CAM-02',
    label: 'Camera 2 (reverse angle, mirrored crop)',
    crop: { w: 1792, h: 1008, x: 640, y: 144 },
    mirror: true,
    grade: { brightness: 0.78, sepia: 0.16, saturate: 0.72, contrast: 1.07, gamma: 0.95 },
    phase: 1.9,
  },
];

// Voices (eSpeak NG `id` + variant). Interviewers are keyed by operator ID; a subject's voice follows the gender
// of the first name (table below) and the session sequence, so a dataset revision never needs a code change.
const INTERVIEWER_VOICES: Readonly<Record<string, Voice>> = {
  'OPR-001': { variant: 'm3', pitch: 38, speed: 148, female: false },
  'OPR-002': { variant: 'm7', pitch: 44, speed: 152, female: false },
};
const DEFAULT_INTERVIEWER: Voice = { variant: 'm3', pitch: 40, speed: 150, female: false };
const FEMALE_FIRST_NAMES = new Set(['Siti', 'Maya', 'Dewi', 'Nur', 'Sri', 'Indah', 'Rina', 'Ayu', 'Putri']);
// Only variants without `breath` (eSpeak NG seeds breath noise from the wall clock: f2, f3, f5, Alicia and
// whisperf render differently from one second to the next). Each listed variant was rendered twice, 1.3 s apart,
// with identical SHA-256.
const SUBJECT_VARIANTS = { female: ['f4', 'Annie', 'Andrea'], male: ['m2', 'm4', 'm6'] } as const;

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

function isFemale(name: string): boolean {
  return FEMALE_FIRST_NAMES.has(firstName(name));
}

function interviewerVoice(session: MediaSession): Voice {
  return INTERVIEWER_VOICES[session.investigatorId] ?? DEFAULT_INTERVIEWER;
}

function subjectVoice(session: MediaSession): Voice {
  const female = isFemale(session.subjectName);
  const variants = female ? SUBJECT_VARIANTS.female : SUBJECT_VARIANTS.male;
  const variant = variants[session.seq % variants.length] ?? variants[0];
  const pitch = (female ? 54 : 46) + ((session.seq * 7) % 12);
  const speed = 144 + ((session.seq * 5) % 14);
  return { variant, pitch, speed, female };
}

// ── Interview scripts: fictional, neutral, non-sensitive; names only from the canonical dataset ──
// No greeting or date is spoken, so the audio does not depend on --as-of (only the video OSD does).
const OPENING = 'Rekaman ini adalah simulasi untuk demonstrasi.';

interface ScriptContext {
  /** "Pak Rudi" / "Ibu Siti". */
  address: string;
  /** "Bapak" / "Ibu" (you). */
  you: string;
  /** "Pak" / "Bu" (closing). */
  short: string;
  intro: string;
  followUp: string;
}

function contextFor(s: MediaSession): ScriptContext {
  const female = isFemale(s.subjectName);
  return {
    address: `${female ? 'Ibu' : 'Pak'} ${firstName(s.subjectName)}`,
    you: female ? 'Ibu' : 'Bapak',
    short: female ? 'Bu' : 'Pak',
    intro: `${OPENING} Saya ${s.investigatorName}. Silakan sebutkan nama Anda.`,
    followUp: `${OPENING} Ini pemeriksaan lanjutan. Silakan sebutkan nama Anda.`,
  };
}

type ScriptBuilder = (s: MediaSession, c: ScriptContext) => ScriptLine[];

const SCRIPTS: Readonly<Record<number, ScriptBuilder>> = {
  // Previous two days (step 31 history).
  11: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, silakan ceritakan apa yang ${c.you} lihat di pasar pagi itu.` },
    { speaker: 'subject', text: 'Sekitar jam delapan, saya melihat sebuah dompet cokelat jatuh di dekat kios sayur.' },
    { speaker: 'interviewer', text: `Apa yang ${c.you} lakukan setelah itu?` },
    { speaker: 'subject', text: 'Saya mengambilnya dan langsung menyerahkannya ke pos keamanan pasar.' },
    { speaker: 'interviewer', text: `Baik, terima kasih. Keterangan ${c.you} sudah kami catat.` },
  ],
  12: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, apa yang ${c.you} lihat di area parkir?` },
    { speaker: 'subject', text: 'Sebuah mobil putih mundur pelan dan menyenggol spion sepeda motor.' },
    { speaker: 'interviewer', text: 'Apakah ada yang terluka?' },
    { speaker: 'subject', text: 'Tidak ada. Pengemudinya langsung turun dan meminta maaf kepada pemilik motor.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} sudah kami catat.` },
  ],
  13: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, kami meminta klarifikasi tentang kejadian di halaman parkir kantor pos.` },
    { speaker: 'subject', text: 'Benar, Pak. Saat memundurkan mobil, bemper belakang saya menyentuh pagar besi.' },
    { speaker: 'interviewer', text: `Apakah ${c.you} melaporkannya kepada petugas?` },
    { speaker: 'subject', text: 'Ya, saya langsung melapor ke petugas parkir dan bersedia mengganti biaya perbaikan.' },
    { speaker: 'interviewer', text: `Baik. Keterangan ${c.you} kami catat untuk proses selanjutnya.` },
  ],
  14: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, ceritakan kembali kejadian di dalam bus kota.` },
    { speaker: 'subject', text: 'Seorang penumpang lupa membawa telepon genggamnya ketika turun di halte terminal.' },
    { speaker: 'interviewer', text: 'Lalu apa yang terjadi dengan telepon itu?' },
    { speaker: 'subject', text: 'Saya memberikannya kepada sopir bus, dan sopir menyimpannya di kotak barang temuan.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} sudah kami catat.` },
  ],
  15: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}, pengelola gedung.` },
    { speaker: 'interviewer', text: `${c.address}, bagaimana dua paket kiriman itu bisa tertukar?` },
    { speaker: 'subject', text: 'Kurir meletakkan dua paket dengan nama yang mirip di meja resepsionis.' },
    { speaker: 'interviewer', text: 'Apakah paket tersebut sudah dikembalikan?' },
    { speaker: 'subject', text: 'Sudah, Pak. Kedua paket diterima oleh pemiliknya masing-masing pada sore itu.' },
    { speaker: 'interviewer', text: 'Baik, terima kasih atas keterangannya.' },
  ],
  16: (s, c) => [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, apa yang ${c.you} lihat di parkiran swalayan?` },
    { speaker: 'subject', text: 'Sebuah troli belanja terdorong angin dan menggores pintu mobil biru.' },
    { speaker: 'interviewer', text: 'Apakah pemilik mobil ada di lokasi?' },
    { speaker: 'subject', text: 'Ada, Pak. Petugas swalayan membantu mencatat kejadian itu bersama pemilik mobil.' },
    { speaker: 'interviewer', text: 'Terima kasih. Kita lanjutkan dengan beberapa pertanyaan tambahan.' },
  ],
  // Today's follow-up interviews in the existing cases (step 32, D54 b).
  17: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}, petugas parkir kantor pos.` },
    { speaker: 'interviewer', text: `${c.address}, apa yang ${c.you} lihat saat itu?` },
    { speaker: 'subject', text: 'Mobil itu mundur pelan dan menyentuh pagar besi. Pengemudinya langsung melapor kepada saya.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} kami catat.` },
  ],
  18: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}, petugas pos keamanan pasar.` },
    { speaker: 'interviewer', text: `${c.address}, apa yang terjadi dengan dompet yang diserahkan kepada ${c.you}?` },
    { speaker: 'subject', text: 'Dompet itu kami simpan di loker, lalu pemiliknya datang mengambilnya siang harinya.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} kami catat.` },
  ],
  19: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, kami meminta klarifikasi tentang posisi mobil ${c.you} di halaman parkir kantor pos.` },
    { speaker: 'subject', text: 'Mobil saya diparkir di dekat pagar. Saya tidak melihat kejadiannya secara langsung.' },
    { speaker: 'interviewer', text: `Baik. Keterangan ${c.you} kami catat.` },
  ],
  20: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}, resepsionis gedung.` },
    { speaker: 'interviewer', text: `${c.address}, bagaimana paket-paket itu dicatat di meja resepsionis?` },
    { speaker: 'subject', text: 'Setiap paket dicatat di buku tamu. Dua nama penerimanya memang hampir sama.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} kami catat.` },
  ],
  21: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}, pemilik sepeda motor itu.` },
    { speaker: 'interviewer', text: `${c.address}, bagaimana kondisi spion motor ${c.you}?` },
    { speaker: 'subject', text: 'Hanya tergores sedikit. Pengemudi mobil sudah meminta maaf, dan masalahnya selesai dengan baik.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} kami catat.` },
  ],
  22: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}. Telepon yang tertinggal itu milik saya.` },
    { speaker: 'interviewer', text: `${c.address}, bagaimana telepon itu kembali kepada ${c.you}?` },
    { speaker: 'subject', text: 'Saya menghubungi terminal, lalu mengambilnya di kotak barang temuan keesokan harinya.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} kami catat.` },
  ],
  23: (s, c) => [
    { speaker: 'interviewer', text: c.followUp },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, kami meminta klarifikasi tentang troli belanja di parkiran swalayan.` },
    { speaker: 'subject', text: 'Troli itu saya tinggalkan sebentar di dekat mobil saya, lalu terdorong angin.' },
    { speaker: 'interviewer', text: `Baik. Keterangan ${c.you} kami catat untuk proses selanjutnya.` },
  ],
};

/** The recording scenario (live loop): a new case, the interview already under way. */
const LIVE_SCRIPT: ScriptBuilder = (s, c) => [
  { speaker: 'interviewer', text: `${OPENING} ${c.address}, mohon jelaskan kejadian di persimpangan kemarin sore.` },
  { speaker: 'subject', text: 'Lampu sudah hijau, Pak. Motor saya bergerak pelan, lalu menyentuh bemper mobil di depan saya.' },
  { speaker: 'interviewer', text: `Apakah ${c.you} dan pengemudi mobil sudah bertemu setelah kejadian itu?` },
  { speaker: 'subject', text: 'Sudah. Kami sepakat mengurus perbaikan bersama dan saling bertukar nomor telepon.' },
  { speaker: 'interviewer', text: `Baik. Keterangan ${s.subjectName} kami catat.` },
];

const GENERIC_INCIDENTS = [
  'sebuah payung yang tertinggal di ruang tunggu stasiun',
  'sepeda yang terjatuh di depan toko buku',
  'kunci motor yang ditemukan di taman kota',
];

/** Fallback for sessions a later dataset revision may add (step 32 owns the simulator). */
const GENERIC_SCRIPT: ScriptBuilder = (s, c) => {
  const incident = GENERIC_INCIDENTS[s.seq % GENERIC_INCIDENTS.length] ?? GENERIC_INCIDENTS[0] ?? '';
  return [
    { speaker: 'interviewer', text: c.intro },
    { speaker: 'subject', text: `Nama saya ${s.subjectName}.` },
    { speaker: 'interviewer', text: `${c.address}, silakan ceritakan tentang ${incident}.` },
    { speaker: 'subject', text: 'Saya melihatnya sendiri, lalu melaporkannya kepada petugas di lokasi.' },
    { speaker: 'interviewer', text: `Terima kasih, ${c.short}. Keterangan ${c.you} sudah kami catat.` },
  ];
};

function scriptFor(session: MediaSession): ScriptLine[] {
  const builder = session.live ? LIVE_SCRIPT : (SCRIPTS[session.seq] ?? GENERIC_SCRIPT);
  return builder(session, contextFor(session));
}

/** Text as spoken by the TTS (the transcript keeps the written form). */
function spokenText(text: string): string {
  return text.replace(/\bAKP\b/g, 'a ka pe');
}

// ── Speech synthesis ───────────────────────────────────────────────────────────────────────────
function readWav(path: string): Float32Array {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a RIFF/WAVE file: ${path}`);
  }
  let offset = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    let size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (body + size > buf.length || size === 0) size = buf.length - body;
      if (rate !== TTS_RATE || channels !== 1 || bits !== 16) {
        throw new Error(`Unexpected WAV format ${rate} Hz / ${channels} ch / ${bits} bit in ${path}`);
      }
      const count = Math.floor(size / 2);
      const out = new Float32Array(count);
      for (let i = 0; i < count; i += 1) out[i] = buf.readInt16LE(body + i * 2) / 32768;
      return out;
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`No data chunk in ${path}`);
}

function writeWav(path: string, samples: Float32Array, rate: number): void {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

/** Trims leading and trailing near-silence, keeping 40 ms, and normalises the peak to `peak`. */
function trimAndNormalise(samples: Float32Array, peak: number): Float32Array {
  const threshold = 0.012;
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start] ?? 0) < threshold) start += 1;
  while (end > start && Math.abs(samples[end] ?? 0) < threshold) end -= 1;
  const keep = Math.round(0.04 * TTS_RATE);
  const out = samples.slice(Math.max(0, start - keep), Math.min(samples.length, end + keep + 1));
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) * (peak / max);
  return out;
}

function espeakLine(text: string, voice: Voice, wavPath: string): Float32Array {
  run(
    'espeak-ng',
    ['-v', `id+${voice.variant}`, '-p', String(voice.pitch), '-s', String(voice.speed), '-a', '120', '-g', '2', '-w', wavPath, spokenText(text)],
    'tts.espeak',
  );
  return readWav(wavPath);
}

/**
 * Speech-like synthetic fallback (no TTS engine): a glottal pulse train through three formant resonators, one
 * vowel per syllable, with consonant noise onsets, word gaps and sentence pauses. Deterministic per seed.
 */
function syntheticLine(text: string, voice: Voice, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const vowels: readonly (readonly [number, number, number])[] = [
    [730, 1090, 2440], // a
    [270, 2290, 3010], // i
    [300, 870, 2240], // u
    [530, 1840, 2480], // e
    [570, 840, 2410], // o
  ];
  const units: { kind: 'syl' | 'gap'; dur: number }[] = [];
  const syllableSec = 0.19 * (150 / voice.speed);
  for (const word of text.split(/\s+/)) {
    const letters = word.replace(/[^a-zA-Z]/g, '').length;
    const syllables = Math.max(1, Math.round(letters / 2.4));
    for (let i = 0; i < syllables; i += 1) units.push({ kind: 'syl', dur: syllableSec * (0.8 + 0.4 * rng()) });
    units.push({ kind: 'gap', dur: /[.?!]$/.test(word) ? 0.34 : 0.06 });
  }
  const total = Math.ceil(units.reduce((sum, u) => sum + u.dur, 0) * TTS_RATE);
  const out = new Float32Array(total);
  const baseF0 = (voice.female ? 205 : 118) * (1 + (0.1 * (voice.pitch - 50)) / 50);
  let phase = 0;
  let cursor = 0;
  const state = [0, 0, 0, 0, 0, 0];
  units.forEach((unit, index) => {
    const n = Math.round(unit.dur * TTS_RATE);
    if (unit.kind === 'gap') {
      cursor += n;
      return;
    }
    const formants = vowels[Math.floor(rng() * vowels.length)] ?? vowels[0] ?? [500, 1500, 2500];
    const consonant = Math.round(n * (0.15 + 0.15 * rng()));
    const declination = 1 - (0.12 * index) / Math.max(1, units.length);
    for (let i = 0; i < n && cursor + i < total; i += 1) {
      const t = i / n;
      const f0 = baseF0 * declination * (1 + 0.06 * Math.sin(Math.PI * t) + 0.01 * (rng() - 0.5));
      phase += f0 / TTS_RATE;
      if (phase >= 1) phase -= 1;
      const voiced = (1 - phase) ** 2 - 1 / 3;
      const noise = rng() * 2 - 1;
      const excitation = i < consonant ? noise * 0.35 : voiced;
      let sample = 0;
      formants.forEach((freq, k) => {
        const bw = 80 + 40 * k;
        const r = Math.exp((-Math.PI * bw) / TTS_RATE);
        const b1 = 2 * r * Math.cos((2 * Math.PI * freq) / TTS_RATE);
        const b2 = -r * r;
        const y1 = state[k * 2] ?? 0;
        const y2 = state[k * 2 + 1] ?? 0;
        const y = (1 - r) * excitation + b1 * y1 + b2 * y2;
        state[k * 2 + 1] = y1;
        state[k * 2] = y;
        sample += y / (k + 1);
      });
      const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.2);
      out[cursor + i] = sample * env;
    }
    cursor += n;
  });
  return out;
}

// ── Interview audio: two separate MIC tracks ───────────────────────────────────────────────────
interface TranscriptLine {
  speaker: Speaker;
  track: 'AUDIO-01' | 'AUDIO-02';
  text: string;
  startSec: number;
  endSec: number;
}

interface InterviewAudio {
  seconds: number;
  transcript: TranscriptLine[];
  mic1: string;
  mic2: string;
}

/** Room tone: brownish noise at about -52 dBFS RMS; loops cross-fade the tail into the head. */
function roomTone(length: number, seed: number, loop: boolean): Float32Array {
  const fade = loop ? Math.round(1.5 * TTS_RATE) : 0;
  const rng = mulberry32(seed);
  const raw = new Float32Array(length + fade);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const white = rng() * 2 - 1;
    lp1 += 0.06 * (white - lp1);
    lp2 += 0.02 * (white - lp2);
    raw[i] = lp1 * 0.7 + lp2 * 1.6 + white * 0.015;
  }
  let sumSq = 0;
  for (const v of raw) sumSq += v * v;
  const gain = 0.0025 / Math.sqrt(sumSq / raw.length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (raw[i] ?? 0) * gain;
  for (let i = 0; i < fade; i += 1) {
    // Equal-power cross-fade: the head blends from the tail's continuation, so sample L-1 flows into sample 0.
    const w = i / fade;
    out[i] = (raw[i] ?? 0) * gain * Math.sin((Math.PI / 2) * w) + (raw[length + i] ?? 0) * gain * Math.cos((Math.PI / 2) * w);
  }
  return out;
}

function onePoleLowpass(samples: Float32Array, cutoffHz: number): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / TTS_RATE);
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i += 1) {
    y += a * ((samples[i] ?? 0) - y);
    out[i] = y;
  }
  return out;
}

function buildInterview(
  session: MediaSession,
  engine: 'espeak' | 'synthetic',
  workDir: string,
): InterviewAudio {
  const voices = { interviewer: interviewerVoice(session), subject: subjectVoice(session) };
  const script = scriptFor(session);
  const rng = mulberry32(0x5eed0000 + session.seq);

  const segments = script.map((line, index) => {
    const voice = voices[line.speaker];
    const raw =
      engine === 'espeak'
        ? espeakLine(line.text, voice, join(workDir, `line-${String(index).padStart(2, '0')}.wav`))
        : syntheticLine(spokenText(line.text), voice, session.seq * 100 + index);
    return { line, samples: trimAndNormalise(raw, line.speaker === 'interviewer' ? 0.6 : 0.56) };
  });

  const lead = Math.round(0.8 * TTS_RATE);
  const tail = Math.round(1.1 * TTS_RATE);
  const placements: { start: number; index: number }[] = [];
  let cursor = lead;
  segments.forEach((segment, index) => {
    placements.push({ start: cursor, index });
    const gap = segment.line.speaker === 'interviewer' ? 0.5 + 0.3 * rng() : 0.65 + 0.35 * rng();
    cursor += segment.samples.length + (index < segments.length - 1 ? Math.round(gap * TTS_RATE) : 0);
  });
  const seconds = Math.ceil((cursor + tail) / TTS_RATE);
  const length = seconds * TTS_RATE;

  const dry = { interviewer: new Float32Array(length), subject: new Float32Array(length) };
  const transcript: TranscriptLine[] = [];
  for (const { start, index } of placements) {
    const segment = segments[index];
    if (!segment) continue;
    dry[segment.line.speaker].set(segment.samples, start);
    transcript.push({
      speaker: segment.line.speaker,
      track: segment.line.speaker === 'interviewer' ? 'AUDIO-01' : 'AUDIO-02',
      text: segment.line.text,
      startSec: Number((start / TTS_RATE).toFixed(3)),
      endSec: Number(((start + segment.samples.length) / TTS_RATE).toFixed(3)),
    });
  }

  // Each MIC hears its own talker, a faint, darker bleed of the other talker (-24 dB, 3 ms later) and room tone.
  const bleedDelay = Math.round(0.003 * TTS_RATE);
  const mix = (own: Float32Array, other: Float32Array, seed: number): Float32Array => {
    const bleed = onePoleLowpass(other, 2400);
    const tone = roomTone(length, seed, session.live);
    const out = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = (own[i] ?? 0) + 0.063 * (bleed[i - bleedDelay] ?? 0) + (tone[i] ?? 0);
    }
    return out;
  };
  const mic1 = join(workDir, 'mic1.wav');
  const mic2 = join(workDir, 'mic2.wav');
  writeWav(mic1, mix(dry.interviewer, dry.subject, 0x1000 + session.seq), TTS_RATE);
  writeWav(mic2, mix(dry.subject, dry.interviewer, 0x2000 + session.seq), TTS_RATE);
  return { seconds, transcript, mic1, mic2 };
}

/** MIC chain: band-limit, a mic-specific presence EQ, light room reverb, resample; desktop and mobile AAC. */
function encodeAudio(input: string, micIndex: 1 | 2, seconds: number, desktopOut: string, mobileOut: string, title: string): void {
  const presence = micIndex === 1 ? 'equalizer=f=2800:t=q:w=1.2:g=2.5' : 'equalizer=f=3400:t=q:w=1.0:g=2';
  const body = micIndex === 1 ? 'equalizer=f=220:t=q:w=1.0:g=-2' : 'equalizer=f=260:t=q:w=1.0:g=-1';
  const graph = [
    `[0:a]highpass=f=90,${body},${presence},lowpass=f=7800,`,
    'aecho=0.9:0.8:17|33|53:0.09|0.05|0.03,',
    `asplit=2[d0][m0];[d0]aresample=${OUT_AUDIO_RATE}[desk];[m0]aresample=${MOBILE_AUDIO_RATE}[mob]`,
  ].join('');
  run(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-filter_complex', graph,
      '-map', '[desk]', ...AAC_DESKTOP, '-t', String(seconds), ...MUX_BITEXACT,
      '-metadata', `title=${title}`, '-metadata', 'comment=DEMS demo media - synthetic, DEMO', desktopOut,
      '-map', '[mob]', ...AAC_MOBILE, '-t', String(seconds), ...MUX_BITEXACT,
      '-metadata', `title=${title}`, '-metadata', 'comment=DEMS demo media - synthetic, DEMO', mobileOut,
    ],
    'audio.encode',
  );
}

// ── Pictures: base stills, OSD layers and the video filter graph ────────────────────────────────
type Matrix = readonly [number, number, number, number, number, number, number, number, number];

function multiply(a: Matrix, b: Matrix): Matrix {
  const at = (m: Matrix, r: number, c: number): number => m[r * 3 + c] ?? 0;
  const out: number[] = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) out.push(at(a, r, 0) * at(b, 0, c) + at(a, r, 1) * at(b, 1, c) + at(a, r, 2) * at(b, 2, c));
  }
  return out as unknown as Matrix;
}

/** CSS filter chain brightness → sepia → saturate as one RGB matrix (the D46 dark-warm grade). */
function gradeMatrix(grade: Camera['grade']): Matrix {
  const b = grade.brightness;
  const brightness: Matrix = [b, 0, 0, 0, b, 0, 0, 0, b];
  const s = grade.sepia;
  const sepia: Matrix = [
    1 - s + s * 0.393, s * 0.769, s * 0.189,
    s * 0.349, 1 - s + s * 0.686, s * 0.168,
    s * 0.272, s * 0.534, 1 - s + s * 0.131,
  ];
  const k = grade.saturate;
  const saturate: Matrix = [
    0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k,
    0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k,
    0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k,
  ];
  return multiply(saturate, multiply(sepia, brightness));
}

function prepareBaseStill(camera: Camera, outPath: string): void {
  const m = gradeMatrix(camera.grade).map((v) => v.toFixed(4));
  const mixer = `colorchannelmixer=rr=${m[0]}:rg=${m[1]}:rb=${m[2]}:gr=${m[3]}:gg=${m[4]}:gb=${m[5]}:br=${m[6]}:bg=${m[7]}:bb=${m[8]}`;
  const { w, h, x, y } = camera.crop;
  const filters = [
    `crop=${w}:${h}:${x}:${y}`,
    ...(camera.mirror ? ['hflip'] : []),
    `scale=${BASE_W}:${BASE_H}:flags=lanczos`,
    'format=rgb24',
    mixer,
    `eq=contrast=${camera.grade.contrast}:gamma=${camera.grade.gamma}`,
  ].join(',');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', HERO_PATH, '-vf', filters, '-frames:v', '1', '-flags', '+bitexact', outPath], 'video.base');
}

function writeScanlineBand(path: string): void {
  const band = new Canvas(VIDEO_W, BAND_H);
  for (let y = 0; y < BAND_H; y += 1) {
    const d = (y - BAND_H / 2) / (BAND_H / 2);
    const alpha = 0.08 * Math.exp(-4 * d * d) + (Math.abs(y - BAND_H / 2) < 1 ? 0.05 : 0);
    for (let x = 0; x < VIDEO_W; x += 1) band.blend(x, y, [226, 232, 240], alpha);
  }
  writeFileSync(path, band.toPng());
}

function wibStamp(ms: number): string {
  const p = wibDateParts(ms);
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}  ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}  UTC+07:00`;
}

/** Sprite of the top OSD row per half second: running WIB timestamp (left) and a blinking REC (right). */
function writeTimestampSprite(path: string, startedAt: number, seconds: number): void {
  const rows = seconds * 2;
  const sprite = new Canvas(VIDEO_W, OSD_ROW_H * rows);
  const recText = 'REC';
  const recX = VIDEO_W - OSD_MARGIN - textWidth(recText, OSD_SCALE);
  const dotR = 8;
  for (let row = 0; row < rows; row += 1) {
    const top = row * OSD_ROW_H;
    drawText(sprite, wibStamp(startedAt + Math.floor(row / 2) * 1_000), OSD_MARGIN, top + OSD_MARGIN, OSD_SCALE);
    drawText(sprite, recText, recX, top + OSD_MARGIN, OSD_SCALE);
    if (row % 2 === 0) {
      const cx = recX - 12 - dotR;
      const cy = top + OSD_MARGIN + (GLYPH_H * OSD_SCALE) / 2;
      sprite.fillCircle(cx, cy, dotR + 2, OSD_BLACK, 0.8);
      sprite.fillCircle(cx, cy, dotR, REC_RED, 1);
    }
  }
  writeFileSync(path, sprite.toPng());
}

function writeStaticOsd(path: string, camera: Camera, live: boolean): void {
  const canvas = new Canvas(VIDEO_W, VIDEO_H);
  const camNo = camera.track === 'VIDEO-01' ? '1' : '2';
  const baseline = VIDEO_H - OSD_MARGIN - GLYPH_H * OSD_SCALE;
  if (live) {
    const text = `${camera.deviceId} | ${camera.track} | LIVE | DEMO`;
    drawText(canvas, text, Math.round((VIDEO_W - textWidth(text, OSD_SCALE)) / 2), baseline, OSD_SCALE);
  } else {
    drawText(canvas, `CAM ${camNo} ${camera.track} | ${DEVICE_NAME}`, OSD_MARGIN, baseline, OSD_SCALE);
    const right = `${DEVICE_ID} | DEMO`;
    drawText(canvas, right, VIDEO_W - OSD_MARGIN - textWidth(right, OSD_SCALE), baseline, OSD_SCALE);
  }
  writeFileSync(path, canvas.toPng());
}

/** Frame-exact period for the scanline sweep that divides a loop evenly (seamless). */
function scanlinePeriod(frames: number, loop: boolean): number {
  if (!loop) return SCANLINE_PERIOD_FRAMES;
  let best = frames;
  for (let k = 1; k <= frames; k += 1) {
    if (frames % k !== 0) continue;
    const p = frames / k;
    if (Math.abs(p - SCANLINE_PERIOD_FRAMES) < Math.abs(best - SCANLINE_PERIOD_FRAMES)) best = p;
  }
  return best;
}

/** Perspective corner expressions: slow push-in (03_motion_spec) plus drift that stays inside the frame. */
function motion(frames: number, loop: boolean, phase: number): string {
  const seconds = frames / FPS;
  const t = `(in/${FPS})`;
  const scale = loop
    ? `(1.02+0.04*(1-cos(2*PI*${t}/${seconds}))/2)`
    : `(1.02+0.05*(1-cos(PI*${t}/${seconds}))/2)`;
  const periodX = loop ? seconds : 41;
  const periodY = loop ? seconds : 29;
  const margin = `(1-1/${scale})`;
  const cx = `(W/2+0.6*(W/2)*${margin}*sin(2*PI*${t}/${periodX}+${phase}))`;
  const cy = `(H/2+0.45*(H/2)*${margin}*sin(2*PI*${t}/${periodY}+${(phase * 1.7).toFixed(3)}))`;
  const hw = `(W/(2*${scale}))`;
  const hh = `(H/(2*${scale}))`;
  const corners: Record<string, string> = {
    x0: `${cx}-${hw}`, y0: `${cy}-${hh}`,
    x1: `${cx}+${hw}`, y1: `${cy}-${hh}`,
    x2: `${cx}-${hw}`, y2: `${cy}+${hh}`,
    x3: `${cx}+${hw}`, y3: `${cy}+${hh}`,
  };
  const params = Object.entries(corners).map(([key, expr]) => `${key}='${expr}'`).join(':');
  return `perspective=${params}:interpolation=cubic:sense=source:eval=frame`;
}

interface VideoJob {
  camera: Camera;
  frames: number;
  loop: boolean;
  seed: number;
  baseStill: string;
  band: string;
  staticOsd: string;
  timestampSprite: string | null;
  desktopOut: string;
  mobileOut: string;
  title: string;
}

function renderVideo(job: VideoJob): void {
  const period = scanlinePeriod(job.frames, job.loop);
  // Each still is decoded once and repeated by the `loop` filter (an image2 `-loop 1` input re-decodes per frame).
  const images = [job.baseStill, job.band, job.staticOsd, ...(job.timestampSprite ? [job.timestampSprite] : [])];
  const inputs = images.flatMap((path) => ['-i', path]);
  const still = (index: number, format: string): string =>
    `[${index}:v]loop=loop=${job.frames - 1}:size=1:start=0,setpts=N/(${FPS}*TB),format=${format}`;
  const scanY = `if(lt(mod(n,${period}),${SCANLINE_SWEEP_FRAMES}),-${BAND_H}+${VIDEO_H + BAND_H}*mod(n,${period})/${SCANLINE_SWEEP_FRAMES},-${BAND_H * 3})`;
  const halfSecondFrames = FPS / 2;
  const graph = [
    `${still(0, 'yuv444p')},${motion(job.frames, job.loop, job.camera.phase)},scale=${VIDEO_W}:${VIDEO_H}:flags=bicubic,format=yuv420p,`,
    `noise=c0s=5:c0f=t+u:c1s=2:c1f=t+u:c2s=2:c2f=t+u:all_seed=${job.seed},vignette=angle=0.62[v0];`,
    `${still(1, 'rgba')}[band];[v0][band]overlay=x=0:y='${scanY}':format=yuv420[v1];`,
    `${still(2, 'rgba')}[static];[v1][static]overlay=x=0:y=0:format=yuv420[v2];`,
    job.timestampSprite
      ? `${still(3, 'rgba')},crop=w=${VIDEO_W}:h=${OSD_ROW_H}:x=0:y='${OSD_ROW_H}*floor((n+0.5)/${halfSecondFrames})'[ts];[v2][ts]overlay=x=0:y=0:format=yuv420[v3];`
      : '[v2]null[v3];',
    `[v3]split=2[hi][lo0];[lo0]scale=${MOBILE_W}:${MOBILE_H}:flags=area[lo]`,
  ].join('');
  run(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph,
      '-map', '[hi]', ...X264_DESKTOP, '-frames:v', String(job.frames), '-flags:v', '+bitexact', '-an', ...MUX_BITEXACT,
      '-metadata', `title=${job.title}`, '-metadata', 'comment=DEMS demo media - synthetic, DEMO', job.desktopOut,
      '-map', '[lo]', ...X264_MOBILE, '-frames:v', String(job.frames), '-flags:v', '+bitexact', '-an', ...MUX_BITEXACT,
      '-metadata', `title=${job.title}`, '-metadata', 'comment=DEMS demo media - synthetic, DEMO', job.mobileOut,
    ],
    'video.render',
  );
}

function grabStill(video: string, out: string, width: number | null, quality: number): void {
  run(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', video, '-frames:v', '1',
      ...(width ? ['-vf', `scale=${width}:-2:flags=area`] : []),
      '-q:v', String(quality), '-flags', '+bitexact', '-fflags', '+bitexact', out,
    ],
    'video.poster',
  );
}

// ── Sessions from the canonical dataset ────────────────────────────────────────────────────────
function operatorDisplayName(id: string): string {
  return OPERATORS.find((operator) => operator.id === id)?.displayName ?? id;
}

function suffixOf(id: string | null): string | null {
  const match = id ? /-(\d{4})$/.exec(id) : null;
  return match?.[1] ?? null;
}

function datasetSessions(now: number): MediaSession[] {
  const history = buildHistory(now).sessionHistory.map<MediaSession>((entry) => {
    const suffix = suffixOf(entry.id) ?? entry.id;
    return {
      seq: Number.parseInt(suffix, 10),
      suffix,
      sessionId: entry.id,
      evidenceId: entry.evidenceId,
      evidenceSuffix: suffixOf(entry.evidenceId),
      subjectName: entry.subjectName,
      subjectType: entry.subjectType,
      investigatorId: entry.investigatorId,
      investigatorName: operatorDisplayName(entry.investigatorId),
      startedAt: entry.startedAt,
      sessionDurationMs: entry.durationMs,
      outcome: entry.outcome,
      live: false,
    };
  });
  history.sort((a, b) => a.seq - b.seq);
  const liveSeq = RECORDING_SCENARIO.sessionSeq;
  const liveId = sessionIdFor(liveSeq, now);
  history.push({
    seq: liveSeq,
    suffix: suffixOf(liveId) ?? String(liveSeq),
    sessionId: liveId,
    evidenceId: null,
    evidenceSuffix: null,
    subjectName: RECORDING_SCENARIO.subjectName,
    subjectType: RECORDING_SCENARIO.subjectType,
    investigatorId: RECORDING_SCENARIO.investigatorId,
    investigatorName: operatorDisplayName(RECORDING_SCENARIO.investigatorId),
    startedAt: null,
    sessionDurationMs: null,
    outcome: 'RECORDING',
    live: true,
  });
  return history;
}

// ── File layout ────────────────────────────────────────────────────────────────────────────────
interface SessionFiles {
  desktop: Record<TrackId, string>;
  posters: Record<'VIDEO-01' | 'VIDEO-02', string>;
  thumbnails: Record<'VIDEO-01' | 'VIDEO-02', string>;
  mobile: Record<TrackId, string>;
  mobilePosters: Record<'VIDEO-01' | 'VIDEO-02', string>;
}

function mediaKey(session: MediaSession): string {
  return session.evidenceSuffix ?? session.suffix;
}

function layoutFor(session: MediaSession): SessionFiles {
  if (session.live) {
    return {
      desktop: {
        'VIDEO-01': 'live/VIDEO-01.loop.mp4',
        'VIDEO-02': 'live/VIDEO-02.loop.mp4',
        'AUDIO-01': 'live/AUDIO-01.loop.m4a',
        'AUDIO-02': 'live/AUDIO-02.loop.m4a',
      },
      posters: { 'VIDEO-01': 'live/VIDEO-01.poster.jpg', 'VIDEO-02': 'live/VIDEO-02.poster.jpg' },
      thumbnails: { 'VIDEO-01': 'live/VIDEO-01.thumb.jpg', 'VIDEO-02': 'live/VIDEO-02.thumb.jpg' },
      mobile: {
        'VIDEO-01': 'mobile/live_video_01_loop.mp4',
        'VIDEO-02': 'mobile/live_video_02_loop.mp4',
        'AUDIO-01': 'mobile/live_audio_01_loop.m4a',
        'AUDIO-02': 'mobile/live_audio_02_loop.m4a',
      },
      mobilePosters: { 'VIDEO-01': 'mobile/live_video_01_poster.jpg', 'VIDEO-02': 'mobile/live_video_02_poster.jpg' },
    };
  }
  // Joined on the evidence number (D61): evidence/<EV suffix>/ and mobile/evidence_<EV suffix>_*. A session
  // without evidence (none in the step-32 dataset) falls back to its session suffix.
  const key = mediaKey(session);
  const dir = session.evidenceSuffix ? `evidence/${key}` : `sessions/${key}`;
  const flat = session.evidenceSuffix ? `mobile/evidence_${key}` : `mobile/session_${key}`;
  return {
    desktop: {
      'VIDEO-01': `${dir}/VIDEO-01.mp4`,
      'VIDEO-02': `${dir}/VIDEO-02.mp4`,
      'AUDIO-01': `${dir}/AUDIO-01.m4a`,
      'AUDIO-02': `${dir}/AUDIO-02.m4a`,
    },
    posters: { 'VIDEO-01': `${dir}/VIDEO-01.poster.jpg`, 'VIDEO-02': `${dir}/VIDEO-02.poster.jpg` },
    thumbnails: { 'VIDEO-01': `${dir}/VIDEO-01.thumb.jpg`, 'VIDEO-02': `${dir}/VIDEO-02.thumb.jpg` },
    mobile: {
      'VIDEO-01': `${flat}_video_01.mp4`,
      'VIDEO-02': `${flat}_video_02.mp4`,
      'AUDIO-01': `${flat}_audio_01.m4a`,
      'AUDIO-02': `${flat}_audio_02.m4a`,
    },
    mobilePosters: { 'VIDEO-01': `${flat}_video_01_poster.jpg`, 'VIDEO-02': `${flat}_video_02_poster.jpg` },
  };
}

// ── Index and README ───────────────────────────────────────────────────────────────────────────
/** How consumers map a position in the full recording onto the media (D61: document a loop/trim rule). */
const EXCERPT_RULE =
  'Media cover [0, excerpt.durationMs) of each recording (the full length is sessionDurationMs). A player that ' +
  'shows the full timeline maps position p to p mod excerpt.durationMs and labels playback as a DEMO excerpt. ' +
  'The four tracks of an item always share one duration, so VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02 stay in ' +
  'sync under that rule. Live loops (live.excerpt.loop = true) repeat seamlessly. Join media to the simulator by ' +
  'evidenceSuffix (the numeric suffix of EV-YYYYMMDD-NNNN); the live loop by live.sessionSeq, which equals ' +
  'RECORDING_SCENARIO.sessionSeq, and by live.evidenceSuffixWhenSealed once the scenario session is sealed.';
interface FileRecord {
  path: string;
  bytes: number;
  sha256: string;
  durationSec?: number;
}

function fileRecord(stage: string, path: string, withDuration: boolean): FileRecord {
  const full = join(stage, path);
  const record: FileRecord = { path, bytes: statSync(full).size, sha256: sha256File(full) };
  if (withDuration) record.durationSec = Number(probeDuration(full).toFixed(3));
  return record;
}

function readmeText(meta: { asOf: string; engine: string; ffmpeg: string; espeak: string | null; totalBytes: number; sessions: MediaSession[] }): string {
  const rows = meta.sessions
    .map((s) => {
      const folder = s.live ? 'live/ (loops)' : `${dirname(layoutFor(s).desktop['VIDEO-01'])}/`;
      const evidence = s.live ? `(${formatSeq(IDLE_COUNTERS.evidence)} when sealed)` : (s.evidenceSuffix ?? '-');
      return `| ${evidence} | ${s.suffix} | ${folder} | ${s.subjectName} (${s.subjectType}) | ${s.investigatorName} | ${s.live ? 'RECORDING (scenario)' : s.outcome} |`;
    })
    .join('\n');
  return `# Demo media (DEMO, synthetic)

Generated by \`packages/shared/scripts/gen-demo-media.ts\` (blueprint step 92, D50/D51). Do not edit by hand;
regenerate instead. Everything here is synthetic demo material for the DEMS demo stack.

## Regenerate

\`\`\`sh
cd packages/shared
node --import tsx scripts/gen-demo-media.ts --as-of ${meta.asOf}
\`\`\`

- \`--as-of\` is the simulator time the media is dated for, in WIB (a date alone means 10:00 WIB). The
  previous-day sessions depend only on its date; today's follow-up sessions are placed before it (step 32), so
  their burned-in OSD times match the simulator only when the demo loads near that time. The audio does not
  depend on it.
- Requires the Homebrew formulae \`ffmpeg\` and \`espeak-ng\` (host install and rollback: step 92 log,
  docs/2026-09-30_dems_demo_stack_setup/implementation/64_demo_media.md).
- The run is deterministic: the same \`--as-of\` and tool versions give the same files and SHA-256 values
  (listed in \`media-index.json\`). Regenerate step 93's evidence packages after regenerating media.

## Layout

| Evidence | Session | Folder | Subject | Investigator | Outcome |
|---|---|---|---|---|---|
${rows}

- Per evidence item (\`evidence/<evidence number>/\`, the join key): \`VIDEO-01.mp4\` (Camera 1, wide) and \`VIDEO-02.mp4\` (Camera 2, mirrored reverse-angle crop),
  H.264 ${VIDEO_W}x${VIDEO_H} at ${FPS} fps, no audio stream; \`AUDIO-01.m4a\` (MIC 1, interviewer) and
  \`AUDIO-02.m4a\` (MIC 2, subject), AAC mono ${OUT_AUDIO_RATE} Hz 48 kbps, two separate files (never mixed, design book §6.3).
  Each is an excerpt from the recording start; its length follows the interview script, not the full session
  duration. Posters (${VIDEO_W}x${VIDEO_H}) and thumbnails (320x180) are the frame at 1 s.
- Excerpt rule (\`media-index.json\` \`excerptRule\`): ${EXCERPT_RULE}
- \`live/\`: seamless loops for the recording scenario session (\`RECORDING_SCENARIO.sessionSeq\` = ${RECORDING_SCENARIO.sessionSeq}, ${RECORDING_SCENARIO.subjectName}); their OSD has no running clock and no
  REC because the UI overlays both from the simulator clock, and idle camera tiles reuse the loops.
- \`mobile/\`: ${MOBILE_W}x${MOBILE_H} subset (loops, per-session tracks, posters; audio AAC mono ${MOBILE_AUDIO_RATE} Hz 32 kbps) with
  flat, lowercase, Android-safe names.

## Provenance and licences

- Pictures: derived from \`packages/shared/assets/hero/room-2560.jpg\` (Pexels 3906592, Leandro Alamino, Pexels
  License; already recorded in THIRD_PARTY_NOTICES.md). No new licensed source.
- OSD text: a hand-authored 5x7 bitmap font inside the generator (no font files).
- Voices: ${meta.engine === 'espeak' ? `eSpeak NG ${meta.espeak ?? ''} (formant synthesis, \`id\` voice with variants; no MBROLA voice)` : 'speech-like synthetic fallback (no TTS engine)'}. The output of a
  GPL program is not covered by its licence (GNU GPL FAQ, #GPLOutput); the spoken text is the generator's own
  fictional script. macOS system voices (\`say\`) are not used (D51: personal, non-commercial output licence).
  Piper's only Indonesian model (\`id_ID-news_tts-medium\`) was not used: its model card gives no permissive
  licence ("See URL", a Kaggle notebook) and it is fine-tuned from \`lessac\` (Blizzard 2013, research-only).
- Interview content: fictional, neutral incidents (lost wallet, parking scrape, lost phone, parcel mix-up,
  shopping-trolley scratch, a slow-speed bumper touch) and their follow-ups;
  names only from the canonical dataset; every recording states that it is a simulation for demonstration.
- Encoded with ffmpeg ${meta.ffmpeg} (libx264, native AAC).

Media size (without this README and the index): ${(meta.totalBytes / 1_048_576).toFixed(2)} MiB.
`;
}

// ── Main ───────────────────────────────────────────────────────────────────────────────────────
function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(root, full).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
}

function removeEmptyDirs(dir: string, root: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name), root);
  }
  if (dir !== root && readdirSync(dir).length === 0) rmdirSync(dir);
}

function main(): number {
  const { values } = parseArgs({
    options: {
      'as-of': { type: 'string', default: DEFAULT_AS_OF },
      voice: { type: 'string', default: 'auto' },
      out: { type: 'string' },
      only: { type: 'string' },
      'keep-temp': { type: 'boolean', default: false },
    },
  });
  const asOf = values['as-of'];
  // The simulator's `now` in WIB: a date means 10:00 WIB that day (step 31 measured its dataset at 10:00 WIB).
  // The previous-day sessions depend only on the date; today's follow-ups (step 32) are placed before `now`.
  const asOfMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(asOf);
  if (!asOfMatch) throw new Error(`--as-of must be YYYY-MM-DD or YYYY-MM-DDTHH:MM (WIB), got "${asOf}"`);
  const wibHour = asOfMatch[4] === undefined ? 10 : Number(asOfMatch[4]);
  const wibMinute = asOfMatch[5] === undefined ? 0 : Number(asOfMatch[5]);
  const now = Date.UTC(Number(asOfMatch[1]), Number(asOfMatch[2]) - 1, Number(asOfMatch[3]), wibHour - 7, wibMinute, 0);
  // Date.UTC rolls over out-of-range parts (month 13, day 99, 25:00), so the value must round-trip exactly.
  const check = wibDateParts(now);
  const roundTrips =
    !Number.isNaN(now) &&
    check.year === Number(asOfMatch[1]) &&
    check.month === Number(asOfMatch[2]) &&
    check.day === Number(asOfMatch[3]) &&
    check.hour === wibHour &&
    check.minute === wibMinute;
  if (!roundTrips) throw new Error(`--as-of is not a valid WIB date-time: "${asOf}"`);

  const ffmpegVersion = toolVersion('ffmpeg', ['-hide_banner', '-version'], /ffmpeg version (\S+)/);
  if (!ffmpegVersion || !toolVersion('ffprobe', ['-hide_banner', '-version'], /ffprobe version (\S+)/)) {
    throw new Error('ffmpeg/ffprobe not found on PATH (Homebrew: brew install ffmpeg; see step 92 log)');
  }
  const espeakVersion = toolVersion('espeak-ng', ['--version'], /text-to-speech:\s*(\S+)/);
  const voiceOption = values.voice;
  if (!['auto', 'espeak', 'synthetic'].includes(voiceOption)) throw new Error(`--voice must be auto, espeak or synthetic`);
  if (voiceOption === 'espeak' && !espeakVersion) throw new Error('--voice espeak requested but espeak-ng is not on PATH');
  const engine: 'espeak' | 'synthetic' = voiceOption === 'synthetic' || !espeakVersion ? 'synthetic' : 'espeak';
  if (voiceOption === 'auto' && !espeakVersion) log('warn', 'main', 'espeak-ng not found; using the speech-like synthetic voice');

  const only = values.only ? new Set(values.only.split(',').map((s) => s.trim())) : null;
  const outDir = resolve(values.out ?? DEFAULT_OUT);
  const preview = Boolean(values.out) || only !== null;
  if (preview && outDir === DEFAULT_OUT) throw new Error('--only needs --out <dir> (a partial run never replaces assets/demo-media)');

  const sessions = datasetSessions(now).filter((s) => !only || only.has(s.suffix));
  if (sessions.length === 0) throw new Error('No sessions selected');
  log('info', 'main', `as-of ${asOf}; ${sessions.length} sessions; voice ${engine}; ffmpeg ${ffmpegVersion}; out ${outDir}`, {
    asOf,
    sessions: sessions.map((s) => s.sessionId),
    engine,
    logPath: LOG_PATH,
  });

  const work = mkdtempSync(join(tmpdir(), 'dems-demo-media-'));
  const stage = join(work, 'stage');
  let current = 'setup';
  let succeeded = false;
  try {
    mkdirSync(stage, { recursive: true });
    const band = join(work, 'band.png');
    writeScanlineBand(band);
    const baseStills = CAMERAS.map((camera) => {
      const path = join(work, `base-${camera.deviceId}.png`);
      prepareBaseStill(camera, path);
      return path;
    });

    const indexEvidence: Record<string, unknown>[] = [];
    let indexLive: Record<string, unknown> | null = null;
    for (const session of sessions) {
      current = session.sessionId;
      const sessionWork = join(work, `s-${session.suffix}`);
      mkdirSync(sessionWork, { recursive: true });
      const files = layoutFor(session);
      for (const rel of [...Object.values(files.desktop), ...Object.values(files.mobile)]) mkdirSync(dirname(join(stage, rel)), { recursive: true });

      const audio = buildInterview(session, engine, sessionWork);
      const frames = audio.seconds * FPS;
      encodeAudio(audio.mic1, 1, audio.seconds, join(stage, files.desktop['AUDIO-01']), join(stage, files.mobile['AUDIO-01']), `DEMO ${session.sessionId} AUDIO-01 MIC 1 Interviewer`);
      encodeAudio(audio.mic2, 2, audio.seconds, join(stage, files.desktop['AUDIO-02']), join(stage, files.mobile['AUDIO-02']), `DEMO ${session.sessionId} AUDIO-02 MIC 2 Subject`);

      CAMERAS.forEach((camera, camIndex) => {
        const staticOsd = join(sessionWork, `osd-${camera.deviceId}.png`);
        writeStaticOsd(staticOsd, camera, session.live);
        let sprite: string | null = null;
        if (!session.live && session.startedAt !== null) {
          sprite = join(sessionWork, 'timestamps.png');
          if (camIndex === 0) writeTimestampSprite(sprite, session.startedAt, audio.seconds);
        }
        renderVideo({
          camera,
          frames,
          loop: session.live,
          seed: session.seq * 10 + camIndex + 1,
          baseStill: baseStills[camIndex] ?? '',
          band,
          staticOsd,
          timestampSprite: sprite,
          desktopOut: join(stage, files.desktop[camera.track]),
          mobileOut: join(stage, files.mobile[camera.track]),
          title: `DEMO ${session.sessionId} ${camera.track} ${camera.deviceId}`,
        });
        grabStill(join(stage, files.desktop[camera.track]), join(stage, files.posters[camera.track]), null, 3);
        grabStill(join(stage, files.desktop[camera.track]), join(stage, files.thumbnails[camera.track]), 320, 4);
        grabStill(join(stage, files.mobile[camera.track]), join(stage, files.mobilePosters[camera.track]), null, 4);
      });

      const track = (rel: string): FileRecord => fileRecord(stage, rel, true);
      const still = (rel: string): FileRecord => fileRecord(stage, rel, false);
      const entry: Record<string, unknown> = {
        mediaKey: mediaKey(session),
        sessionSeq: session.seq,
        sessionSuffix: session.suffix,
        sessionId: session.sessionId,
        evidenceId: session.evidenceId,
        evidenceSuffix: session.evidenceSuffix,
        // The recording scenario seals as the next evidence number (sim IDLE_COUNTERS; EV-…-0014 in step 32).
        ...(session.live ? { evidenceSuffixWhenSealed: formatSeq(IDLE_COUNTERS.evidence) } : {}),
        subjectName: session.subjectName,
        subjectType: session.subjectType,
        investigatorId: session.investigatorId,
        investigatorName: session.investigatorName,
        outcome: session.outcome,
        live: session.live,
        loop: session.live,
        startedAt: session.startedAt === null ? null : toWibIso(session.startedAt),
        sessionDurationMs: session.sessionDurationMs,
        excerpt: { offsetMs: 0, durationMs: audio.seconds * 1_000, loop: session.live },
        voices: {
          'AUDIO-01': { role: 'Interviewer', mic: 'MIC 1', engine, ...interviewerVoice(session) },
          'AUDIO-02': { role: 'Subject', mic: 'MIC 2', engine, ...subjectVoice(session) },
        },
        tracks: {
          'VIDEO-01': track(files.desktop['VIDEO-01']),
          'VIDEO-02': track(files.desktop['VIDEO-02']),
          'AUDIO-01': track(files.desktop['AUDIO-01']),
          'AUDIO-02': track(files.desktop['AUDIO-02']),
        },
        posters: { 'VIDEO-01': still(files.posters['VIDEO-01']), 'VIDEO-02': still(files.posters['VIDEO-02']) },
        thumbnails: { 'VIDEO-01': still(files.thumbnails['VIDEO-01']), 'VIDEO-02': still(files.thumbnails['VIDEO-02']) },
        mobile: {
          tracks: {
            'VIDEO-01': track(files.mobile['VIDEO-01']),
            'VIDEO-02': track(files.mobile['VIDEO-02']),
            'AUDIO-01': track(files.mobile['AUDIO-01']),
            'AUDIO-02': track(files.mobile['AUDIO-02']),
          },
          posters: { 'VIDEO-01': still(files.mobilePosters['VIDEO-01']), 'VIDEO-02': still(files.mobilePosters['VIDEO-02']) },
        },
        transcript: audio.transcript,
      };
      if (session.live) indexLive = entry;
      else indexEvidence.push(entry);
      log('info', 'session', `${session.sessionId} (${session.evidenceId ?? 'live'}): ${audio.seconds} s, ${audio.transcript.length} lines`, {
        seconds: audio.seconds,
        mediaKey: mediaKey(session),
      });
    }

    current = 'index';
    const mediaBytes = listFiles(stage).reduce((sum, rel) => sum + statSync(join(stage, rel)).size, 0);
    const index = {
      schema: 'dems.demo-media/1',
      demo: true,
      notice: 'DEMO - synthetic media for the DEMS demo stack; not evidence',
      generator: 'packages/shared/scripts/gen-demo-media.ts',
      asOf,
      datasetNow: toWibIso(now),
      timezone: '+07:00',
      tools: { ffmpeg: ffmpegVersion, voice: engine === 'espeak' ? `espeak-ng ${espeakVersion ?? ''}` : 'synthetic' },
      video: { codec: 'h264', profile: 'High', width: VIDEO_W, height: VIDEO_H, fps: FPS, audio: false },
      audio: { codec: 'aac', channels: 1, sampleRate: OUT_AUDIO_RATE, bitrateKbps: 48 },
      mobile: { width: MOBILE_W, height: MOBILE_H, fps: FPS, videoProfile: 'Main', audioSampleRate: MOBILE_AUDIO_RATE, audioBitrateKbps: 32 },
      source: {
        still: 'packages/shared/assets/hero/room-2560.jpg',
        licence: 'Pexels License (Pexels 3906592, Leandro Alamino; THIRD_PARTY_NOTICES.md)',
        cameras: CAMERAS.map((c) => ({ track: c.track, deviceId: c.deviceId, label: c.label })),
      },
      joinKey: 'evidenceSuffix',
      excerptRule: EXCERPT_RULE,
      evidence: indexEvidence,
      live: indexLive,
    };
    writeFileSync(join(stage, 'media-index.json'), `${JSON.stringify(index, null, 2)}\n`);
    writeFileSync(
      join(stage, 'README.md'),
      readmeText({ asOf, engine, ffmpeg: ffmpegVersion, espeak: espeakVersion, totalBytes: mediaBytes, sessions }),
    );

    current = 'publish';
    const produced = listFiles(stage);
    mkdirSync(outDir, { recursive: true });
    const previous = listFiles(outDir);
    if (!preview) {
      for (const rel of previous) if (!produced.includes(rel)) rmSync(join(outDir, rel));
    }
    for (const rel of produced) {
      mkdirSync(dirname(join(outDir, rel)), { recursive: true });
      // A fresh write, not copyFileSync: an APFS clone keeps ffmpeg's over-allocation (du -sk budget, row 92).
      writeFileSync(join(outDir, rel), readFileSync(join(stage, rel)));
    }
    if (!preview) removeEmptyDirs(outDir, outDir);
    const totalBytes = produced.reduce((sum, rel) => sum + statSync(join(outDir, rel)).size, 0);
    log('info', 'publish', `${produced.length} files, ${(totalBytes / 1_048_576).toFixed(2)} MiB in ${outDir}`, {
      files: produced.length,
      totalBytes,
    });
    succeeded = true;
    return 0;
  } catch (error) {
    log('error', 'main', `failed at ${current}: ${error instanceof Error ? error.message : String(error)}`, {
      step: current,
      workDir: work,
      stderrTail: error instanceof ToolError ? error.stderrTail : undefined,
    }, error);
    console.error(`Temporary files kept at ${work}; run log ${LOG_PATH}`);
    return 1;
  } finally {
    // The work folder is kept on failure (reported above) or on request.
    if (succeeded && !values['keep-temp']) rmSync(work, { recursive: true, force: true });
  }
}

try {
  process.exitCode = main();
} catch (error) {
  log('error', 'bootstrap', error instanceof Error ? error.message : String(error), {}, error);
  process.exitCode = 1;
}
