// Fix F-M4 (code review row 69, findings R69-12 and R69-13; decision D178): the two OPTIONAL members
// the camera contract gained. `connectionTarget` is what the operator confirms before a test;
// `reason` keeps a camera whose sign-in method is not answered from being worded as a refused
// credential. Both are absent in Simulated capture: a candidate and a test without them stay valid.
import { describe, expect, it } from 'vitest';
import { CAPTURE_CONNECTION_TARGET_PATTERN, CaptureCandidateSchema, CaptureConnectionTestReason, CaptureConnectionTestSchema } from '../src/api';

const candidate = {
  candidateId: 'CND-0000000000AA',
  adapter: 'ONVIF_RTSP',
  sourceClass: 'PRODUCTION',
  host: '192.0.2.44',
  endpointRef: null,
  vendor: null,
  model: null,
  name: null,
  status: 'NEW',
  deviceId: null,
  testable: true,
  conflict: false,
  addressChanged: false,
  lastTest: null,
  adoptable: false,
};
const tested = { candidateId: 'CND-0000000000AA', outcome: 'AUTHENTICATION_FAILED', authenticated: true, testedAt: 5_000, usableProfileCount: 0, failedAttemptsRemaining: 1 };

describe('CaptureCandidate.connectionTarget (R69-12)', () => {
  it('is scheme, IPv4 host, a written port and a path; nothing with a user part, a name, a query or a fragment', () => {
    for (const target of ['http://192.0.2.44:80/onvif/device_service', 'https://192.0.2.44:8443/', 'http://127.0.0.1:8564/a/b-c_d.e~f']) {
      expect(CaptureCandidateSchema.safeParse({ ...candidate, connectionTarget: target }).success, target).toBe(true);
    }
    for (const target of ['http://192.0.2.44/onvif', 'http://user@192.0.2.44:80/x', 'http://user:pw@192.0.2.44:80/x', 'http://camera.local:80/x', 'rtsp://192.0.2.44:554/x', 'http://192.0.2.44:80/x?y=1', 'http://192.0.2.44:80/x#y', 'http://192.0.2.44:80', '192.0.2.44:80/x', '']) {
      expect(CaptureCandidateSchema.safeParse({ ...candidate, connectionTarget: target }).success, target).toBe(false);
      expect(CAPTURE_CONNECTION_TARGET_PATTERN.test(target), target).toBe(false);
    }
  });

  it('CONTROL - a candidate without the member is valid (Simulated capture, a candidate that is not testable)', () => {
    expect(CaptureCandidateSchema.safeParse(candidate).success).toBe(true);
  });
});

describe('the reason of an AUTHENTICATION_FAILED test (R69-13)', () => {
  it('a closed list of one code, on the test answer and on the candidate\'s last test; absent is valid; any other word is refused', () => {
    expect(Object.values(CaptureConnectionTestReason)).toEqual(['SCHEME_NOT_ALLOWED']);
    expect(CaptureConnectionTestSchema.safeParse(tested).success).toBe(true);
    expect(CaptureConnectionTestSchema.safeParse({ ...tested, reason: 'SCHEME_NOT_ALLOWED' }).success).toBe(true);
    expect(CaptureConnectionTestSchema.safeParse({ ...tested, reason: 'CREDENTIAL_REFUSED' }).success).toBe(false);
    const last = { outcome: 'AUTHENTICATION_FAILED', authenticated: true, testedAt: 5_000 };
    expect(CaptureCandidateSchema.safeParse({ ...candidate, lastTest: { ...last, reason: 'SCHEME_NOT_ALLOWED' } }).success).toBe(true);
    expect(CaptureCandidateSchema.safeParse({ ...candidate, lastTest: { ...last, reason: 'the camera said no' } }).success).toBe(false);
  });
});
