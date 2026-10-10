// Fix pass F-M5, review R74-03: EVERY reason the capture protocol defines has a sentence that is
// its own in the shared wording source. A reason added to the protocol without a sentence fails here.
import { ADVISORY_WARNING_REASONS, CaptureWarningReason, FINAL_CRASH_CODES, MIC_WARNING_REASONS } from '@dems/capture-protocol';
import { CAPTURE_ADVISORY_REASONS, CAPTURE_FAULT_SENTENCES, CAPTURE_REASON_SEVERITY, CAPTURE_FAULT_UNKNOWN_SENTENCES, captureFaultSentence, isCaptureFaultReason } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { FAILED_START_REASON_UNKNOWN } from '../../engine/capture-session';
import { NO_CAMERA_CONNECTED, SESSION_LEFT_RECORDING, STOP_NOT_CLEAN } from '../../capture-session';

const PROTOCOL_REASONS: readonly string[] = [...Object.values(CaptureWarningReason), ...FINAL_CRASH_CODES];
/** The codes the Core itself ends a capture with and shows as a reason. */
const CORE_REASONS: readonly string[] = [FAILED_START_REASON_UNKNOWN, NO_CAMERA_CONNECTED, SESSION_LEFT_RECORDING, STOP_NOT_CLEAN];

describe('the wording of capture faults covers the protocol', () => {
  it.each([...PROTOCOL_REASONS, ...CORE_REASONS])('%s has its own sentence and a severity', (reason) => {
    expect(isCaptureFaultReason(reason), `no sentence for ${reason} in packages/shared/src/sim/capture-fault-wording.ts`).toBe(true);
    const sentence = captureFaultSentence(reason, 'Camera 2 (CAM-02)');
    expect(sentence).not.toContain(`(${reason})`);
    expect(sentence).not.toMatch(/stopped growing|\{\{/);
    expect(['CRITICAL', 'WARNING', 'INFO']).toContain(CAPTURE_REASON_SEVERITY[reason as keyof typeof CAPTURE_REASON_SEVERITY]);
  });

  it('every sentence is different: no two reasons read alike', () => {
    const sentences = Object.values(CAPTURE_FAULT_SENTENCES);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('a reason about a device names it; the protocol says which reasons are about a microphone', () => {
    for (const reason of Object.values(CaptureWarningReason)) {
      const sentence = captureFaultSentence(reason, 'DEVICE-NAME');
      expect(sentence, reason).toContain('DEVICE-NAME');
    }
    for (const reason of MIC_WARNING_REASONS) expect(captureFaultSentence(reason, 'X'), reason).toMatch(/audio|silent|sample rate/);
    for (const reason of Object.values(CaptureWarningReason).filter((entry) => !MIC_WARNING_REASONS.includes(entry))) expect(captureFaultSentence(reason, 'X'), reason).toMatch(/video|clock|keyframes|connect|fragment/);
  });

  it('the advisory reasons of the protocol are advice here too (INFO, never a fault)', () => {
    for (const reason of ADVISORY_WARNING_REASONS) expect(CAPTURE_ADVISORY_REASONS, reason).toContain(reason);
  });

  it('CONTROL: a reason the table does not hold is detected and worded neutrally with its code', () => {
    expect(isCaptureFaultReason('A_REASON_OF_PROTOCOL_5')).toBe(false);
    expect(captureFaultSentence('A_REASON_OF_PROTOCOL_5', 'CAM-01')).toBe(CAPTURE_FAULT_UNKNOWN_SENTENCES.device.replace('{{device}}', 'CAM-01').replace('{{reason}}', 'A_REASON_OF_PROTOCOL_5'));
  });
});
