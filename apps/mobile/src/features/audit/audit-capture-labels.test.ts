/**
 * Audit tab and the capture-phase audit types (task 3 row 68; register MB-12; C3 §5.2): every type the
 * Core can write has a label in the app's resources, and a capture-configuration change reads its
 * change from the row's own detail keys.
 */
import { describe, expect, it } from '@jest/globals';
import { AuditType, type AuditRow } from '@dems/shared/sim';
import { i18n } from '@/i18n';
import { captureChangeOf } from './audit-model';

const CAPTURE_TYPES = [
  'CAPTURE_CONFIG_CHANGED',
  'AUDIO_SOURCE_SWITCHED',
  'CAMERA_POE_CYCLED',
  'TRANSCRIPT_REVISED',
  'MIC_SILENT',
  'EVIDENCE_MEDIA_SERVED',
  'EVIDENCE_EXPORT_FAILED',
  'CAPTURE_CREDENTIAL_SET',
  'CAPTURE_CREDENTIAL_REVEALED',
  'STT_CONFIG_CHANGED',
] as const;

const row = (type: string, details: Record<string, unknown>) => ({ type, details }) as unknown as Pick<AuditRow, 'type' | 'details'>;

describe('audit labels (MB-12)', () => {
  it('every audit type of the vocabulary has a label; none falls back to its code', () => {
    for (const type of Object.values(AuditType)) {
      const key = `common.auditType.${type}`;
      expect(i18n.exists(key)).toBe(true);
      expect(i18n.t(key)).not.toBe(type);
    }
  });

  it('the capture-phase types are in the vocabulary and labelled in words', () => {
    for (const type of CAPTURE_TYPES) expect(Object.values(AuditType)).toContain(type);
    expect(i18n.t('common.auditType.CAPTURE_CONFIG_CHANGED')).toBe('Capture configuration changed');
    // Negative control: a type that does not exist has no label.
    expect(i18n.exists('common.auditType.NOT_A_TYPE')).toBe(false);
  });
});

describe('the change of a CAPTURE_CONFIG_CHANGED row', () => {
  it('reads the target and the two values from the detail keys of C3 §5.2', () => {
    expect(captureChangeOf(row('CAPTURE_CONFIG_CHANGED', { scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', from: 'CAM-02', to: 'CAM-01' }))).toEqual({ target: 'VIDEO-02', from: 'CAM-02', to: 'CAM-01' });
    expect(captureChangeOf(row('CAPTURE_CONFIG_CHANGED', { scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY' }))).toEqual({ target: 'MIC-02', from: 'STANDBY', to: 'PRIMARY' });
    expect(captureChangeOf(row('CAPTURE_CONFIG_CHANGED', { trackId: 'VIDEO-01', from: null, to: 'CAM-07' }))).toEqual({ target: 'VIDEO-01', from: null, to: 'CAM-07' });
  });

  it('is null for any other type and for a row without a new value', () => {
    expect(captureChangeOf(row('DEVICE_COMMAND', { from: 'A', to: 'B' }))).toBeNull();
    expect(captureChangeOf(row('CAPTURE_CONFIG_CHANGED', { trackId: 'VIDEO-01' }))).toBeNull();
    expect(captureChangeOf(row('CAPTURE_CONFIG_CHANGED', { to: 42 }))).toBeNull();
  });
});
