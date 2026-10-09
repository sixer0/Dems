// N-4 (fix round 1): the excerpt of the oMLX server log that is kept as evidence carries no
// duration, no clock time and no rate (D230). The figures in the lines below are made up.
import { describe, expect, it } from 'vitest';
import { excerptServerLog, holdsTimingFigure, stripTimingFields } from '../../test/real/log-excerpt';

const LOG = [
  '2026-01-02 03:04:05,678 - omlx.engine_core - INFO - MLX executor thread initialized: generation_stream = ThreadLocalStream(Device(gpu, 0), 4)',
  '2026-01-02 03:04:06,111 - omlx.server - INFO - Uvicorn running',
  '2026-01-02 03:04:07,222 - omlx.engine.stt - INFO - STT transcribe: model=/m/whisper-x, file=tmpabc.wav (3154638 bytes), language=id',
  '2026-01-02 03:04:16,333 - omlx.engine.stt - INFO - STT transcribe done: model=/m/whisper-x, 9.99s, 897 chars output',
  '2026-01-02 03:04:16,444 - omlx.server - WARNING - POST /v1/audio/transcriptions → 401: API key required',
  '2026-01-02 03:04:17,555 - omlx.engine.tts - INFO - TTS synthesize: model=/m/voice-x, text_len=44, voice=None, language=id, speed=1.0, ref_audio=no',
  '2026-01-02 03:04:19,666 - omlx.engine.tts - INFO - TTS synthesize done: model=/m/voice-x, 8.88s, 151724 bytes output',
  '2026-01-02 03:04:19,777 - omlx.server - INFO - POST /v1/audio/speech took 120 ms at 35.2 tokens/s (0.4x) Authorization: Bearer abcdef123456',
].join('\n');

describe('N-4: the server-log excerpt holds no timing figure', () => {
  it('negative control: the raw log does hold them, so the check below can fail', () => {
    expect(holdsTimingFigure(LOG)).toBe(true);
    expect(LOG).toContain('9.99s');
    expect(holdsTimingFigure('STT transcribe done: model=/m/x, 9.99s, 897 chars output')).toBe(true);
    expect(holdsTimingFigure('started at 03:04:05')).toBe(true);
    expect(holdsTimingFigure('35.2 tokens/s')).toBe(true);
  });

  it('keeps what happened and drops when and how long', () => {
    const excerpt = excerptServerLog(LOG);
    expect(excerpt).toEqual([
      'omlx.engine_core - INFO - MLX executor thread initialized: generation_stream = ThreadLocalStream(Device(gpu, 0), 4)',
      'omlx.engine.stt - INFO - STT transcribe: model=/m/whisper-x, file=tmpabc.wav (3154638 bytes), language=id',
      'omlx.engine.stt - INFO - STT transcribe done: model=/m/whisper-x, 897 chars output',
      'omlx.server - WARNING - POST /v1/audio/transcriptions → 401: API key required',
      'omlx.engine.tts - INFO - TTS synthesize: model=/m/voice-x, text_len=44, voice=None, language=id, speed=1.0, ref_audio=no',
      'omlx.engine.tts - INFO - TTS synthesize done: model=/m/voice-x, 151724 bytes output',
      'omlx.server - INFO - POST /v1/audio/speech at () Authorization: ***',
    ]);
    expect(excerpt.some(holdsTimingFigure)).toBe(false);
    expect(excerpt.join('\n')).not.toMatch(/9\.99|8\.88|120|35\.2|03:04|abcdef/);
  });

  it('sizes and counts are not durations: bytes, characters and the device index stay', () => {
    expect(stripTimingFields('file=tmp.wav (3154638 bytes), 897 chars output, Device(gpu, 0), 4)')).toBe('file=tmp.wav (3154638 bytes), 897 chars output, Device(gpu, 0), 4)');
    expect(holdsTimingFigure('whisper-large-v3-turbo, 17 segments, 6801 bytes')).toBe(false);
  });
});
