// Post-review fix pass FXR-S (backend task 2026-10-04; review findings W91-4, W91-12, W92-15;
// decision D241 DN-W91-2): the numbers and words the server enforces for pairing, biometric
// tokens, the demo rebuild and device commands are the contract's values (`@dems/shared/api`),
// not copies that could drift from the descriptions a client reads. No database.
//
// Each check compares the server name with the contract name by identity, so a server copy that
// is restated with another value fails here. The literals themselves stay pinned where they were
// (`pairing/__tests__/secrets.test.ts`, `test/api-closeout.test.ts` in the shared package).
import * as contract from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { PAIRING_CODE_CLOSE_REASONS } from '../../core';
import { ResetRefusal } from '../demo/reset';
import { DEVICE_COMMAND_OF_OPERATION } from '../devices';
import { PASSWORD_SESSION_REQUIRED, TokenRefusalReason } from '../identity/biometric';
import { BIOMETRIC_TOKEN_LIFETIME_MS, BIOMETRIC_TOKEN_PREFIX } from '../identity/biometric/tokens';
import { DEVICE_CREDENTIAL_PREFIX, PAIRING_CODE_LIFETIME_MS, PAIRING_CODE_MAX_FAILED_REDEEMS, PAIRING_QR_PREFIX } from '../pairing/limits';

describe('pairing: the server enforces the contract\'s values (W91-4, W83 ledger rows 11 and 59)', () => {
  it('code lifetime, failed redeems, QR prefix and credential prefix are the contract\'s', () => {
    expect(PAIRING_CODE_LIFETIME_MS).toBe(contract.PAIRING_CODE_LIFETIME_MS);
    expect(PAIRING_CODE_MAX_FAILED_REDEEMS).toBe(contract.PAIRING_CODE_MAX_FAILED_REDEEMS);
    expect(PAIRING_QR_PREFIX).toBe(contract.PAIRING_QR_PREFIX);
    expect(DEVICE_CREDENTIAL_PREFIX).toBe(contract.DEVICE_CREDENTIAL_PREFIX);
    expect(contract.DEVICE_CREDENTIAL_PATTERN.source.startsWith(`^${DEVICE_CREDENTIAL_PREFIX}`)).toBe(true);
  });

  it('the close reasons of a pairing code are exactly the contract\'s `PairingCodeCloseReason`, in the refusal message\'s order', () => {
    expect([...PAIRING_CODE_CLOSE_REASONS].sort()).toEqual(Object.values(contract.PairingCodeCloseReason).sort());
    expect(PAIRING_CODE_CLOSE_REASONS).toEqual(['CANCELLED', 'EXPIRED', 'EXHAUSTED']);
  });
});

describe('biometric tokens: the server enforces the contract\'s values (W91-4, W92-15, W83 §7.2)', () => {
  it('prefix and lifetime are the contract\'s; the prefix heads the contract\'s pattern', () => {
    expect(BIOMETRIC_TOKEN_PREFIX).toBe(contract.BIOMETRIC_TOKEN_PREFIX);
    expect(BIOMETRIC_TOKEN_LIFETIME_MS).toBe(contract.BIOMETRIC_TOKEN_LIFETIME_MS);
    expect(contract.BIOMETRIC_TOKEN_PATTERN.source.startsWith(`^${BIOMETRIC_TOKEN_PREFIX}`)).toBe(true);
  });

  it('the refusal reasons of a token and the enrolment\'s 403 reason are the contract\'s', () => {
    expect(TokenRefusalReason).toBe(contract.BiometricTokenRefusalReason);
    expect(PASSWORD_SESSION_REQUIRED).toBe(contract.PASSWORD_SESSION_REQUIRED_REASON);
  });
});

describe('demo rebuild and device commands: read from the contract (W92-15, W91-12)', () => {
  it('the 503 reasons of a refused or failed reset are the contract\'s `DemoRebuildRefusalReason`', () => {
    expect(ResetRefusal.IN_PROGRESS).toBe(contract.DemoRebuildRefusalReason.RESET_IN_PROGRESS);
    expect(ResetRefusal.FAILED).toBe(contract.DemoRebuildRefusalReason.RESET_FAILED);
    expect(Object.values(ResetRefusal).sort()).toEqual(Object.values(contract.DemoRebuildRefusalReason).sort());
  });

  it('the command of each device operation is the contract\'s table inverted, and agrees with its reverse lookup', () => {
    for (const [operationId, command] of Object.entries(DEVICE_COMMAND_OF_OPERATION)) {
      expect(contract.deviceCommandOfOperation(operationId), operationId).toBe(command);
      expect(contract.DEVICE_COMMAND_OPERATIONS[command], command).toBe(operationId);
    }
    expect(Object.keys(DEVICE_COMMAND_OF_OPERATION)).toHaveLength(Object.keys(contract.DEVICE_COMMAND_OPERATIONS).length);
    expect(Object.isFrozen(DEVICE_COMMAND_OF_OPERATION)).toBe(true);
  });
});
