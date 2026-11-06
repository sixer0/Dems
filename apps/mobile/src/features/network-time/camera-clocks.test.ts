/** Camera clock rows of Network & Time (task 3 row 68; register MB-10; C3 §3 op 57 `cameraOffsets`). Pure model. */
import { describe, expect, it } from '@jest/globals';
import { cameraClockRows, signedOffset } from './network-time-model';

describe('camera clock rows (MB-10)', () => {
  it('one row per configured camera in selector order; a camera on both tracks appears once', () => {
    expect(cameraClockRows(['CAM-02', 'CAM-01', 'CAM-02'], []).map((row) => row.deviceId)).toEqual(['CAM-02', 'CAM-01']);
    expect(cameraClockRows([], [{ deviceId: 'CAM-01', offsetMs: 1, measuredAt: 1, source: 'NTP_ONVIF' }])).toEqual([]);
  });

  it('a camera without a record is unknown (null), never 0 ms', () => {
    const [row] = cameraClockRows(['CAM-01'], [{ deviceId: 'CAM-09', offsetMs: 4, measuredAt: 10, source: 'NTP_ONVIF' }]);
    expect(row).toEqual({ deviceId: 'CAM-01', offsetMs: null, measuredAt: null, source: null });
  });

  it('takes the newest record of a camera, and a real 0 ms stays 0', () => {
    const rows = cameraClockRows(
      ['CAM-01', 'CAM-02'],
      [
        { deviceId: 'CAM-01', offsetMs: 12.34, measuredAt: 100, source: 'NTP_ONVIF' },
        { deviceId: 'CAM-01', offsetMs: -3.5, measuredAt: 200, source: 'RTCP_TELEMETRY' },
        { deviceId: 'CAM-02', offsetMs: 0, measuredAt: 150, source: 'NTP_ONVIF' },
      ],
    );
    expect(rows[0]).toEqual({ deviceId: 'CAM-01', offsetMs: -3.5, measuredAt: 200, source: 'RTCP_TELEMETRY' });
    expect(rows[1]!.offsetMs).toBe(0);
  });

  it('writes the sign explicitly: ahead +, behind -, none for zero', () => {
    expect(signedOffset(12.34)).toBe('+12.3');
    expect(signedOffset(-3.5)).toBe('-3.5');
    expect(signedOffset(0)).toBe('0.0');
    expect(signedOffset(-0.04)).toBe('0.0');
  });
});
