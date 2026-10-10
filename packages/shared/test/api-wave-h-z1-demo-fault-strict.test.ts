// Fix wave H, closing pass Z1, item 5 (ruling D206 (3); gate findings G70-09 / G75-14): the request
// body of operations 73 / 74 is STRICT. A member the contract does not name - the gate sent a
// top-level `cameraId` instead of `target.cameraId` - is refused, not silently dropped (the fault
// was then raised on the DEFAULT camera). The shapes the clients send stay accepted: the live
// binding of `inject` / `clearFault` builds `{ kind, target? }` (`src/live/source/bindings.ts`).
import { describe, expect, it } from 'vitest';
import { DemoFaultRequestSchema } from '../src/api';

describe('DemoFaultRequestSchema is strict', () => {
  it.each([
    ['a top-level cameraId', { kind: 'CAMERA_LOSS', cameraId: 'VIDEO-02' }],
    ['an unknown member beside a right target', { kind: 'CAMERA_LOSS', target: { cameraId: 'VIDEO-02' }, note: 'x' }],
    ['an unknown member inside the target', { kind: 'CAMERA_LOSS', target: { camera: 'VIDEO-02' } }],
  ])('refuses %s', (_name, body) => {
    const parsed = DemoFaultRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.code)).toContain('unrecognized_keys');
  });

  it.each([
    ['the kind alone', { kind: 'FAN_STALL' }],
    ['a camera target', { kind: 'CAMERA_LOSS', target: { cameraId: 'VIDEO-02' } }],
    ['every member of the target', { kind: 'TAMPER', target: { channel: 'AUDIO-01', cameraId: 'VIDEO-01', auditIndex: 3, fallback: 'RTC', evidenceId: 'EV-20261001-0001', trackId: 'AUDIO-02' } }],
  ])('CONTROL - accepts %s', (_name, body) => {
    expect(DemoFaultRequestSchema.safeParse(body).success).toBe(true);
  });
});
