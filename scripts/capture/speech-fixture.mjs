// The SPEECH FIXTURE of the development speech microphone (fix wave H, driver E; ruling D198 on
// gate 81 condition C1; capture spec §A.7.1 "Fake microphone"; transcript spec §B.6).
//
// WHY. A generated microphone that plays a tone carries no speech: the voice-activity stage plans
// no chunk and the speech engine never starts, so a development session can never show a transcript
// with segments. `DEMS_CAPTURE_DEV_FAKE_MIC=speech` makes the first generated microphone play THIS
// file instead of its tone (development capture only; `apps/core-server/src/capture/fence/fake-mic.ts`).
//
// WHAT IT IS. SYNTHETIC speech made on this machine: a short two-speaker dialogue in Indonesian
// (the one language of the product's transcription, decision OD-20), the first turns of the row-12
// script. No recording of a person, no network, no cloud service, no speech server: each turn is
// spoken into a file by the macOS speech synthesiser (`/usr/bin/say`, voice `Damayanti`, the one
// Indonesian voice of this system). Speaker B is that voice as it is; speaker A is the SAME voice
// lowered in pitch by the helper FFmpeg (rate change + tempo correction), so that the two turns of
// the dialogue differ in timbre. Nothing is ever played: `say -o` writes a file.
//
// WHERE. `<repository>/.data/dev-fixtures/speech-mic/` (git-ignored), directory mode 0700:
//   dialogue.wav              mono, signed 16-bit, 48,000 Hz - mode 0600
//   dialogue.reference.json   the KNOWN TEXT of every turn, the method, the hash of the WAV - mode 0600
// Never committed. The Core holds the WAV to the helper-program path rule AND to its format (RIFF /
// WAVE, integer PCM, mono, 16 bit, 48 kHz) before it plays it; this set-up holds it to the same
// format rule (`speechFixtureWavProblem`): a wrong file is DEV_SPEECH_FIXTURE_UNUSABLE with the reason.
//
// NOT THE ROW-12 FIXTURE. `.cache/spikes/stt-check/fixture-two-speaker-id.wav` (sealed, 65.72 s,
// 24 kHz) was made with a speech server's voice cloning; this set-up neither calls that server nor
// copies that file. The two share the script, not the bytes.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SPEECH_FIXTURE_FOLDER = join('dev-fixtures', 'speech-mic');
export const SPEECH_FIXTURE_FILE = 'dialogue.wav';
export const SPEECH_FIXTURE_REFERENCE = 'dialogue.reference.json';

const SAY = '/usr/bin/say';
const VOICE = 'Damayanti';
const RATE_HZ = 48_000;
/** Silence between two turns. */
const GAP_MS = 400;
/** Silence before the first and after the last turn, so that a looped play does not join two words. */
const EDGE_MS = 600;
/** Speaker A: the voice's sample rate is read as this fraction (lower pitch), then the tempo is put back. */
const SPEAKER_A_PITCH = 0.82;

/** The first nine turns of the row-12 script (`TWO_SPEAKER_SCRIPT` of `apps/transcriber/src/fixtures/tts-fixture-provider.ts`). */
export const SPEECH_FIXTURE_TURNS = Object.freeze([
  { id: 'A1', speaker: 'A', text: 'Selamat pagi, terima kasih sudah hadir pada wawancara hari ini.' },
  { id: 'B1', speaker: 'B', text: 'Selamat pagi, terima kasih atas undangannya.' },
  { id: 'A2', speaker: 'A', text: 'Sebelum kita mulai, tolong jelaskan peran Anda di gudang.' },
  { id: 'B2', speaker: 'B', text: 'Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman.' },
  { id: 'A3', speaker: 'A', text: 'Berapa lama proses penerimaan biasanya berlangsung?' },
  { id: 'B3', speaker: 'B', text: 'Umumnya sekitar satu jam, tergantung padatnya kiriman.' },
  { id: 'A4', speaker: 'A', text: 'Apa harapan Anda terhadap sistem yang baru?' },
  { id: 'B4', speaker: 'B', text: 'Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi.' },
  { id: 'A5', speaker: 'A', text: 'Sekarang saya ingin mendengar kendala teknis yang Anda alami sehari-hari.' },
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const silence = (ms) => Buffer.alloc(Math.round((RATE_HZ * ms) / 1000) * 2);

function wavOf(data) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // integer PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE_HZ, 24);
  header.writeUInt32LE(RATE_HZ * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * THE FORMAT RULE OF THE FIXTURE (wave H closing pass Z1; driver E decision 5, ruling D201 (5)):
 * little-endian RIFF of form WAVE, a `fmt ` chunk that says integer PCM, mono, 48,000 Hz, 16 bit,
 * and a `data` chunk with at least one sample. Returns null for a file that passes, else the reason
 * - the SAME reasons the Core's boot names (`apps/core-server/src/capture/fence/fake-mic.ts`
 * `speechFixtureFormatProblem`; one test holds the two to the same vectors). A file at the fixture
 * path that is not such audio (a text file renamed `.wav`) used to pass the set-up and the boot and
 * fail only at the first session start, as a lost microphone.
 */
export function speechFixtureWavProblem(bytes) {
  if (!(bytes instanceof Uint8Array)) return 'UNREADABLE';
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => (at + 4 <= view.length ? view.toString('latin1', at, at + 4) : '');
  if (view.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return 'NOT_WAV';
  let at = 12;
  let format = null;
  while (at + 8 <= view.length) {
    const id = tag(at);
    const size = view.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > view.length) return 'NOT_WAV';
      let code = view.readUInt16LE(body);
      if (code === 0xfffe && size >= 40 && body + 26 <= view.length) code = view.readUInt16LE(body + 24);
      format = { code, channels: view.readUInt16LE(body + 2), rate: view.readUInt32LE(body + 4), bits: view.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (format === null) return 'NOT_WAV';
      if (size === 0) return 'WAV_NO_AUDIO';
      break;
    }
    at = body + size + (size % 2);
  }
  if (format === null) return 'NOT_WAV';
  if (format.code !== 1) return 'WAV_NOT_PCM';
  if (format.channels !== 1) return 'WAV_NOT_MONO';
  if (format.rate !== RATE_HZ) return 'WAV_NOT_48KHZ';
  if (format.bits !== 16) return 'WAV_NOT_16BIT';
  return null;
}

/** The answer for a fixture file that is not the audio the helper is given. */
const unusable = (problem, how) => ({ status: 'NOT_CREATED', reason: `DEV_SPEECH_FIXTURE_UNUSABLE (${problem}: the file is not mono 16-bit 48 kHz PCM WAVE audio; ${how})` });

/** The fixture that is there, when its bytes are the ones its reference file names; null otherwise. */
function existing(dir) {
  try {
    const reference = JSON.parse(readFileSync(join(dir, SPEECH_FIXTURE_REFERENCE), 'utf8'));
    const bytes = readFileSync(join(dir, SPEECH_FIXTURE_FILE));
    return reference.sha256 === sha256(bytes) && reference.bytes === bytes.length ? { ...reference, wavProblem: speechFixtureWavProblem(bytes) } : null;
  } catch {
    return null;
  }
}

/**
 * Makes the fixture, or keeps the one that is there. Returns `{ status: 'CREATED' | 'KEPT', dir,
 * wav, reference, durationMs, sha256 }` or `{ status: 'NOT_CREATED', reason }` - a reason, never a
 * throw: the helper program this set-up copied is good without the fixture.
 */
export function prepareSpeechFixture({ dataDir, ffmpeg, renew = false }) {
  const dir = join(dataDir, SPEECH_FIXTURE_FOLDER);
  const wav = join(dir, SPEECH_FIXTURE_FILE);
  const referencePath = join(dir, SPEECH_FIXTURE_REFERENCE);
  if (process.platform !== 'darwin' || !existsSync(SAY)) return { status: 'NOT_CREATED', reason: 'NO_SPEECH_SYNTHESISER (this step needs /usr/bin/say of macOS)' };

  mkdirSync(join(dataDir, 'dev-fixtures'), { recursive: true, mode: 0o700 });
  chmodSync(join(dataDir, 'dev-fixtures'), 0o700);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  if (!renew) {
    const kept = existing(dir);
    if (kept !== null) {
      // Kept only as what it must be (closing pass Z1): a file that is not that audio is named, never kept and never silently replaced.
      if (kept.wavProblem !== null) return unusable(kept.wavProblem, 'run the set-up again with --renew-speech-fixture to make it anew');
      chmodSync(wav, 0o600);
      chmodSync(referencePath, 0o600);
      return { status: 'KEPT', dir, wav, reference: referencePath, durationMs: kept.durationMs, sha256: kept.sha256 };
    }
  }

  let voices;
  try {
    voices = execFileSync(SAY, ['-v', '?'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 });
  } catch {
    return { status: 'NOT_CREATED', reason: 'VOICE_LIST_UNAVAILABLE' };
  }
  if (!voices.split('\n').some((line) => line.startsWith(`${VOICE} `) && line.includes('id_ID'))) return { status: 'NOT_CREATED', reason: `VOICE_NOT_INSTALLED (${VOICE}, id_ID)` };

  const work = join(dir, 'work');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { mode: 0o700 });
  try {
    const parts = [silence(EDGE_MS)];
    for (const [index, turn] of SPEECH_FIXTURE_TURNS.entries()) {
      const spoken = join(work, `${turn.id}.wav`);
      const raw = join(work, `${turn.id}.s16`);
      // Written to a file, never played. The text is an argument of its own (`--`): it cannot become an option.
      execFileSync(SAY, ['-v', VOICE, '--file-format=WAVE', `--data-format=LEI16@${RATE_HZ}`, '-o', spoken, '--', turn.text], { stdio: 'ignore', timeout: 60_000 });
      const filter = turn.speaker === 'A' ? ['-af', `asetrate=${Math.round(RATE_HZ * SPEAKER_A_PITCH)},aresample=${RATE_HZ},atempo=${(1 / SPEAKER_A_PITCH).toFixed(4)}`] : [];
      execFileSync(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'error', '-f', 'wav', '-i', spoken, ...filter, '-vn', '-ac', '1', '-ar', String(RATE_HZ), '-c:a', 'pcm_s16le', '-f', 's16le', '-y', raw], { stdio: 'ignore', env: {}, timeout: 60_000 });
      const samples = readFileSync(raw);
      // A synthesiser that could not reach its service writes a header and no sample, and still exits 0.
      if (samples.length < RATE_HZ) return { status: 'NOT_CREATED', reason: `TURN_EMPTY (${turn.id}: the speech synthesiser wrote no audio; run this set-up from a Terminal of the logged-in user)` };
      if (index > 0) parts.push(silence(GAP_MS));
      parts.push(samples.subarray(0, samples.length - (samples.length % 2)));
    }
    parts.push(silence(EDGE_MS));
    const file = wavOf(Buffer.concat(parts));
    // Held to the same rule before it is written: this set-up never leaves a file the boot would refuse.
    const made = speechFixtureWavProblem(file);
    if (made !== null) return unusable(made, 'the set-up made a file of another format - a defect of this script');
    const durationMs = Math.round(((file.length - 44) / 2 / RATE_HZ) * 1000);
    const reference = {
      form: 'dems.dev-speech-fixture/1',
      note: 'SYNTHETIC speech made on this machine for the development speech microphone. Not a recording of a person. Never committed.',
      file: SPEECH_FIXTURE_FILE,
      sha256: sha256(file),
      bytes: file.length,
      durationMs,
      sampleRateHz: RATE_HZ,
      channels: 1,
      sampleFormat: 'S16LE',
      language: 'id',
      method: {
        synthesiser: `${SAY} -v ${VOICE} (macOS, local; id_ID)`,
        speakerA: `the same voice lowered in pitch by the helper FFmpeg (asetrate x${SPEAKER_A_PITCH}, tempo restored)`,
        speakerB: 'the voice as it is',
        gapMs: GAP_MS,
        edgeMs: EDGE_MS,
        script: 'the first nine turns of the row-12 script (TWO_SPEAKER_SCRIPT)',
      },
      turns: SPEECH_FIXTURE_TURNS,
      text: SPEECH_FIXTURE_TURNS.map((turn) => turn.text).join(' '),
    };
    // Written beside the targets and moved over them: a fixture is replaced whole, the reference last.
    writeFileSync(`${wav}.new`, file, { mode: 0o600 });
    writeFileSync(`${referencePath}.new`, `${JSON.stringify(reference, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${wav}.new`, wav);
    renameSync(`${referencePath}.new`, referencePath);
    chmodSync(wav, 0o600);
    chmodSync(referencePath, 0o600);
    if (statSync(wav).size !== file.length) return { status: 'NOT_CREATED', reason: 'WRITE_INCOMPLETE' };
    return { status: 'CREATED', dir, wav, reference: referencePath, durationMs, sha256: reference.sha256 };
  } catch {
    return { status: 'NOT_CREATED', reason: 'SYNTHESIS_FAILED (say or the helper FFmpeg ended with an error)' };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
