// `TtsFixtureProvider` (transcript spec §B.6): the sealed bytes are proven before they are handed
// out, and a generated fixture is a NEW file that never replaces the sealed one. The synthesis
// server is the in-process stand-in; no speech engine runs here.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createOmlxHttp } from '../backends/omlx-http';
import { SerialQueue } from '../cpu-priority';
import { FIXTURE_GAP_MS, TWO_SPEAKER_SCRIPT, createOmlxTtsSynthesiser, createTtsFixtureProvider, type FixtureTurn, type TurnSynthesiser } from '../fixtures/tts-fixture-provider';
import { credentialFromValue } from '../key-loader';
import { createMemoryLog } from '../log';
import { TranscriberErrorCode } from '../types';
import { encodeWavPcm16, readWavFacts } from '../wav';
import { createFakeOmlx, scratchDir } from './support';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const RATE = 24_000;
/** A turn of 0.1 s whose samples carry the index of the turn, so the join order is checkable. */
const turnWav = (value: number): Buffer => encodeWavPcm16(new Int16Array(RATE / 10).fill(value), RATE);

describe('TtsFixtureProvider.provide: the sealed bytes', () => {
  const dir = scratchDir('fixture');
  const path = join(dir, 'sealed.wav');
  const bytes = encodeWavPcm16(new Int16Array(RATE * 2).fill(7), RATE);
  writeFileSync(path, bytes);
  const seal = { sha256: sha(bytes), bytes: bytes.length };

  it('hands out the file when its size and SHA-256 are the sealed ones, with the facts of its header', async () => {
    expect(await createTtsFixtureProvider({ fixturePath: path, seal }).provide()).toEqual({
      path,
      sha256: seal.sha256,
      bytes: bytes.length,
      durationMs: 2_000,
      sampleRateHz: RATE,
      sealed: true,
      turns: TWO_SPEAKER_SCRIPT,
    });
  });

  it('negative control: one changed byte is FIXTURE_CORRUPT, with both hashes in the refusal', async () => {
    const corrupt = Buffer.from(bytes);
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 0x01;
    const corruptPath = join(dir, 'corrupt.wav');
    writeFileSync(corruptPath, corrupt);
    await expect(createTtsFixtureProvider({ fixturePath: corruptPath, seal }).provide()).rejects.toMatchObject({
      code: TranscriberErrorCode.FIXTURE_CORRUPT,
      detail: { reason: 'FIXTURE_HASH_MISMATCH', expectedSha256: seal.sha256, actualSha256: sha(corrupt), expectedBytes: bytes.length, actualBytes: bytes.length },
    });
  });

  it('negative control: a truncated file is FIXTURE_CORRUPT', async () => {
    const shortPath = join(dir, 'short.wav');
    writeFileSync(shortPath, bytes.subarray(0, bytes.length - 2));
    await expect(createTtsFixtureProvider({ fixturePath: shortPath, seal }).provide()).rejects.toMatchObject({ code: TranscriberErrorCode.FIXTURE_CORRUPT, detail: { actualBytes: bytes.length - 2 } });
  });

  it('without a seal override the row-12 seal applies: this small file is not it', async () => {
    await expect(createTtsFixtureProvider({ fixturePath: path }).provide()).rejects.toMatchObject({ code: TranscriberErrorCode.FIXTURE_CORRUPT, detail: { expectedBytes: 3_154_638 } });
  });
});

describe('TtsFixtureProvider.generate: the row-12 recipe', () => {
  const sealedPath = join(scratchDir('fixture'), 'sealed.wav');
  writeFileSync(sealedPath, turnWav(1));

  it('synthesises the 13 turns in script order, each with the reference voice of its speaker, and joins them with the gap', async () => {
    const asked: { turn: FixtureTurn; voice: string | null }[] = [];
    const synthesiser: TurnSynthesiser = {
      synthesise: async (turn, voice) => {
        asked.push({ turn, voice: voice?.text ?? null });
        return turnWav(TWO_SPEAKER_SCRIPT.indexOf(turn) + 1);
      },
    };
    const voices = { A: { audio: new Uint8Array([1]), text: 'voice A' }, B: { audio: new Uint8Array([2]), text: 'voice B' } };
    const out = join(scratchDir('generated'), 'generated.wav');
    const made = await createTtsFixtureProvider({ fixturePath: sealedPath, synthesiser, voices }).generate(out);

    expect(asked.map((entry) => entry.turn.id)).toEqual(TWO_SPEAKER_SCRIPT.map((turn) => turn.id));
    expect(asked.map((entry) => entry.voice)).toEqual(TWO_SPEAKER_SCRIPT.map((turn) => `voice ${turn.speaker}`));
    const file = readFileSync(out);
    const facts = readWavFacts(file);
    const turnSamples = RATE / 10;
    const gapSamples = (RATE * FIXTURE_GAP_MS) / 1000;
    expect(facts).toMatchObject({ sampleRateHz: RATE, channels: 1, bitsPerSample: 16, dataBytes: (13 * turnSamples + 12 * gapSamples) * 2 });
    const sampleAt = (index: number): number => file.readInt16LE(facts.dataOffset + index * 2);
    expect(sampleAt(0)).toBe(1);
    expect(sampleAt(turnSamples)).toBe(0); // the first gap
    expect(sampleAt(turnSamples + gapSamples)).toBe(2); // the second turn
    expect(sampleAt(12 * (turnSamples + gapSamples))).toBe(13); // the last turn
    expect(made).toMatchObject({ path: out, sealed: false, sha256: sha(file), bytes: file.length, sampleRateHz: RATE });
  });

  it('never writes over the sealed fixture, nor over any existing file', async () => {
    const synthesiser: TurnSynthesiser = { synthesise: async () => turnWav(1) };
    const provider = createTtsFixtureProvider({ fixturePath: sealedPath, synthesiser });
    const before = sha(readFileSync(sealedPath));
    await expect(provider.generate(sealedPath)).rejects.toMatchObject({ code: TranscriberErrorCode.CONFIG_INVALID, detail: { reason: 'WOULD_OVERWRITE_SEALED_FIXTURE' } });
    await expect(provider.generate(join(sealedPath, '..', 'sealed.wav'))).rejects.toMatchObject({ detail: { reason: 'WOULD_OVERWRITE_SEALED_FIXTURE' } });
    const existing = join(scratchDir('generated'), 'existing.wav');
    writeFileSync(existing, 'keep me');
    await expect(provider.generate(existing)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(readFileSync(existing, 'utf8')).toBe('keep me');
    expect(sha(readFileSync(sealedPath))).toBe(before);
  });

  it('refuses to generate without a synthesiser, and refuses turns of mixed formats', async () => {
    await expect(createTtsFixtureProvider({ fixturePath: sealedPath }).generate(join(scratchDir('generated'), 'x.wav'))).rejects.toMatchObject({ detail: { reason: 'SYNTHESISER_MISSING' } });
    let call = 0;
    const mixed: TurnSynthesiser = { synthesise: async () => encodeWavPcm16(new Int16Array(100), (call += 1) === 2 ? 16_000 : RATE) };
    await expect(createTtsFixtureProvider({ fixturePath: sealedPath, synthesiser: mixed }).generate(join(scratchDir('generated'), 'y.wav'))).rejects.toMatchObject({
      code: TranscriberErrorCode.BAD_ENGINE_OUTPUT,
      detail: { reason: 'TURN_FORMAT_MISMATCH', turn: 'B1' },
    });
  });
});

describe('the synthesiser of the installed server', () => {
  const KEY = 'unit-test-key-tts-9a2';
  const turn = TWO_SPEAKER_SCRIPT[0]!;

  it('posts one turn as JSON to the speech path on loopback, with the key as a header and the reference voice as base64', async () => {
    const wav = turnWav(5);
    const omlx = createFakeOmlx({ key: KEY, models: [], speechWav: wav });
    const log = createMemoryLog();
    const http = createOmlxHttp({ endpoint: 'http://127.0.0.1:8000', credential: credentialFromValue(KEY), timeoutMs: 5_000, fetchImpl: omlx.fetchImpl });
    const synthesiser = createOmlxTtsSynthesiser({ http, model: 'speech-model', log, queue: new SerialQueue() });
    const bytes = await synthesiser.synthesise(turn, { audio: new Uint8Array([1, 2, 3]), text: 'reference text' });
    expect(sha(bytes)).toBe(sha(wav));
    expect(omlx.calls).toHaveLength(1);
    expect(omlx.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/audio/speech',
      host: '127.0.0.1:8000',
      authorization: `Bearer ${KEY}`,
      json: { model: 'speech-model', input: turn.text, language: 'id', response_format: 'wav', ref_audio: 'AQID', ref_text: 'reference text' },
    });
    await synthesiser.synthesise(turn, null);
    expect(omlx.calls[1]!.json).toEqual({ model: 'speech-model', input: turn.text, language: 'id', response_format: 'wav' });
  });

  it('serialises the turns on the shared server and logs a failed turn without the key', async () => {
    const queue = new SerialQueue();
    const ok = createFakeOmlx({ key: KEY, models: [], speechWav: turnWav(1) });
    const http = createOmlxHttp({ endpoint: 'http://127.0.0.1:8000', credential: credentialFromValue(KEY), timeoutMs: 5_000, fetchImpl: ok.fetchImpl });
    const synthesiser = createOmlxTtsSynthesiser({ http, model: 'speech-model', log: createMemoryLog(), queue });
    await Promise.all(TWO_SPEAKER_SCRIPT.slice(0, 5).map((each) => synthesiser.synthesise(each, null)));
    expect(ok.maxInFlight()).toBe(1);

    const failing = createFakeOmlx({ key: KEY, models: [], status: 500 });
    const log = createMemoryLog();
    const credential = credentialFromValue(KEY);
    log.protect(credential);
    const broken = createOmlxTtsSynthesiser({ http: createOmlxHttp({ endpoint: 'http://127.0.0.1:8000', credential, timeoutMs: 5_000, fetchImpl: failing.fetchImpl }), model: 'speech-model', log, queue });
    await expect(broken.synthesise(turn, null)).rejects.toMatchObject({ code: TranscriberErrorCode.ENGINE_FAILED, detail: { status: 500, turn: 'A1' } });
    expect(log.records()).toHaveLength(1);
    expect(log.records()[0]).toMatchObject({ level: 'error', source: 'transcriber.ttsFixture.synthesise', context: { turn: 'A1' } });
    expect(log.lines.join('\n')).not.toContain(KEY);
  });
});
