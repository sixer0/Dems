// Task 3 blueprint row 90 (C3 §2.4; SEC35-13; E-31; check M8-BLK-1): log-blanking list 2 of 2, the
// mobile runtime log. A signed media URL of operation 88 that reaches a record - in its message,
// its stack or its context - is stored with the token blanked (`mts_***`), never as it came.
import { describe, expect, it } from '@jest/globals';
import { redactCredentials, toRuntimeLogRecord } from './log';

// A synthetic token of the real form: nothing here was ever issued.
const TOKEN = ['mts_', 'AQEBnyfKXzCA', 'MARKER', 'x9_-Zq7Lm2Xw8Rt5Kd0Pu3Vb6Nc1Hy4Gj'].join('');
const URL_TEXT = `http://127.0.0.1:4420/media/${TOKEN}`;

describe('M8-BLK-1: the media session token in the mobile runtime log', () => {
  it('blanks the token in a text', () => {
    expect(redactCredentials(`player failed for ${URL_TEXT}`)).toBe('player failed for http://127.0.0.1:4420/media/mts_***');
  });

  it('a record holds no part of the token: message, stack and context', () => {
    const error = new Error(`load failed: ${URL_TEXT}`);
    error.stack = `Error: load failed: ${URL_TEXT}\n    at play (player.tsx:1:1)`;
    const record = toRuntimeLogRecord({ level: 'error', source: 'evidence.player', error, context: { src: URL_TEXT, note: `uri=${URL_TEXT}` }, at: 0 });
    const kept = JSON.stringify(record);
    expect(kept).toContain('mts_***');
    expect(kept).not.toContain('MARKER');
    expect(kept).not.toMatch(/mts_(?!\*\*\*)/);
  });

  it('control: the same text under a prefix that is no token of this server is kept as it came', () => {
    const other = URL_TEXT.replace('mts_', 'xyz_');
    expect(redactCredentials(other)).toBe(other);
  });
});
