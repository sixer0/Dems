// The two value sets `@dems/capture-protocol` restates from `@dems/shared` (fix round 1 of row 57,
// navigator finding F-8). The protocol package deliberately does not depend on the shared package
// (the C worker implements it by hand), so the Core server, which depends on both, holds them equal.
import { CaptureMicRole, CaptureWarningCode } from '@dems/capture-protocol';
import { MicRole } from '@dems/shared/domain';
import { FaultKind } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';

describe('what the capture protocol restates from the shared vocabulary', () => {
  it('the mic roles are exactly the shared MicRole, name by name', () => {
    expect(CaptureMicRole).toEqual(MicRole);
  });

  it('every warning code is a shared fault kind of the same name, and they are the two capture faults of schema v2', () => {
    const shared: Record<string, string> = FaultKind;
    for (const [name, value] of Object.entries(CaptureWarningCode)) expect(shared[name], name).toBe(value);
    // The last two of the shared list, in its order (`sim/vocabulary.ts`: appended for schema v2).
    expect(Object.values(CaptureWarningCode)).toEqual(Object.values(FaultKind).slice(-2));
  });
});
