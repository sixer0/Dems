// The code of an `ApiFailure` is typed by the error-code vocabulary of the shared contract
// (checkpoint CP-B1, finding CPB1-9; fix round B2b item 5). No app, no database.
//
// Before, `code` was a `string`: a module could answer a code that no client knows, and its
// module gate passed, because the contract's `ApiErrorSchema` checks a code by pattern only.
// Now the constructor takes an `ApiErrorCode`, so such a code does not compile. The type
// assertions below are checked by `npm run typecheck` (this file is part of the program); the
// runtime half ties the eight envelope-level names to the contract's values.
import { API_ERROR_CODES, ApiErrorCode } from '@dems/shared/api';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ApiFailure, EnvelopeCode, type ErrorBody } from '../api-failure';

describe('CPB1-9: the code of an ApiFailure is the contract\'s vocabulary', () => {
  it('by its type: the member, the constructor\'s parameter and the body of the answer', () => {
    expectTypeOf<ApiFailure['code']>().toEqualTypeOf<ApiErrorCode>();
    expectTypeOf<ConstructorParameters<typeof ApiFailure>[1]>().toEqualTypeOf<ApiErrorCode>();
    expectTypeOf<ErrorBody['error']['code']>().toEqualTypeOf<ApiErrorCode>();
    // Not the type it had: a plain string is wider than the vocabulary.
    expectTypeOf<ApiFailure['code']>().not.toEqualTypeOf<string>();
    expectTypeOf<EnvelopeCode>().toExtend<ApiErrorCode>();
  });

  it('every code of the contract can be thrown, and arrives as it was given', () => {
    expect(API_ERROR_CODES).toHaveLength(41); // audit row 143 (D5): + AUDIO_SOURCE_FIXED_BY_PAIRING
    for (const code of API_ERROR_CODES) expect(new ApiFailure(400, code, 'A refusal.').code).toBe(code);
  });

  it('the envelope-level codes are eight of the contract\'s, each under its own name', () => {
    expect(Object.keys(EnvelopeCode)).toEqual(['INVALID_PATH', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'PAYLOAD_TOO_LARGE', 'INVALID_JSON', 'INVALID_INPUT', 'INTERNAL_ERROR', 'NOT_READY']);
    for (const [name, value] of Object.entries(EnvelopeCode)) {
      expect(value).toBe(name);
      expect(value).toBe(ApiErrorCode[name as keyof typeof ApiErrorCode]);
      expect(API_ERROR_CODES).toContain(value);
    }
  });
});
