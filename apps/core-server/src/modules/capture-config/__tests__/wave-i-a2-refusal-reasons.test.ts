// FIX WAVE I, DRIVER A2 - finding G70b-01, second half (re-gate 70): every refusal of the adapter
// registry is answered under ITS OWN reason. Before the fix `routes.ts` answered every one of them
// as `DEVELOPMENT_SOURCE_NOT_ALLOWED`, so a camera the registry did not serve yet read "this source
// can only be used in the development configuration" on a Core in that very configuration.
import { describe, expect, it } from 'vitest';
import { CaptureAdapterRefusal, CaptureOperation } from '../../../capture/adapters';
import { CaptureAssignmentRefusal, DEVELOPMENT_SOURCE_NOT_ALLOWED, captureAssignmentRefusalOf } from '../index';

describe('G70b-01: the reason of a refused assignment (operations 78 / 79)', () => {
  it('a device the registry does not serve is CAPTURE_DEVICE_NOT_SERVED - on a development Core never the development reason', () => {
    // The gate's case: an adopted FAKE camera (stored class DEVELOPMENT) on REAL_DEVELOPMENT, unknown to the registry.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_NOT_SERVED');
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).not.toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
    // A production camera on a production Core of this phase: no adapter (class C), not a class refusal.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'PRODUCTION', CaptureOperation.REAL_PRODUCTION)).toBe('CAPTURE_DEVICE_NOT_SERVED');
    // A built-in carries no stored class in the slice; a registry that does not say its operation.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, undefined, CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_NOT_SERVED');
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', undefined)).toBe('CAPTURE_DEVICE_NOT_SERVED');
  });

  it('a class refusal names the class of the DEVICE, in both directions', () => {
    // C3 §4: a DEVELOPMENT device named while the Core does not run development sources.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, 'DEVELOPMENT', CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
    // The other direction: a production device on a development Core.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, 'PRODUCTION', CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'PRODUCTION', CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
    // A registry that states no operation and a device with no stored class: the earlier reading stands.
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, undefined)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
  });

  it('a class mismatch and every other refusal keep their own word; the four reasons are four different codes', () => {
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
    expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('SOURCE_KIND_NOT_RECORDABLE');
    expect(new Set(Object.values(CaptureAssignmentRefusal)).size).toBe(4);
    for (const reason of Object.values(CaptureAssignmentRefusal)) expect(reason).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });
});
