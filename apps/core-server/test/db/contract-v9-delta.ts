/**
 * The schema-v9 delta of the database contract (task 4 package X-C, contract revision `dbc-10`),
 * composed after the v8 delta by `contract-inventory.ts` (ruling D44 R1: a closed contract is
 * never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - the value `CREDENTIAL_REPLACED` in `SESSION_END_REASON` and in `BIO_REVOKE_REASON`: design
 *     `docs/2026-10-12_input_av_core_adapter_plan/masterplan/05_design_x1_x2.md` section 3.6
 *     (the name is that document's), ruled by security review SX-12 of
 *     `verification/07_security_x1_x2.md`; decision U19;
 *   - both sets are stated here IN FULL, in their stored order with the new value LAST: the
 *     composer replaces the list the closed contract states (section 2.4);
 *   - the two CHECKs keep their names and change their value list - the composer replaces a
 *     constraint of the same name; each definition is the statement text of the generated
 *     `0019_credential_replaced_reason.sql`.
 * No table, no column, no key, no index and no grant is added: the totals stay 47 tables, 484
 * columns, 217 CHECKs, 46 foreign keys, 47 primary keys, 16 unique constraints, 6 unique indexes,
 * 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

const SESSION_END_REASON = ['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'TOKEN_REUSE', 'CREDENTIAL_REPLACED'] as const;
const BIO_REVOKE_REASON = ['DISABLED', 'REENROLLED', 'TOKEN_REUSE', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'USER_DISABLED', 'CREDENTIAL_REPLACED'] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export const V9: {
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  changedTables: [
    {
      name: 'auth_sessions',
      addColumns: [],
      // Same name, one value more: the composer replaces a constraint of the same name.
      addConstraints: [
        {
          name: 'auth_sessions_end_reason_check',
          kind: 'CHECK',
          definition: `"auth_sessions"."end_reason" IS NULL OR "auth_sessions"."end_reason" IN (${list(SESSION_END_REASON)})`,
        },
      ],
      dropConstraints: [],
    },
    {
      name: 'biometric_tokens',
      addColumns: [],
      addConstraints: [
        {
          name: 'biometric_tokens_revoke_check',
          kind: 'CHECK',
          definition: `("biometric_tokens"."revoked_at" IS NULL) = ("biometric_tokens"."revoke_reason" IS NULL) AND ("biometric_tokens"."revoke_reason" IS NULL OR "biometric_tokens"."revoke_reason" IN (${list(BIO_REVOKE_REASON)}))`,
        },
      ],
      dropConstraints: [],
    },
  ],
  valueSets: {
    SESSION_END_REASON: [...SESSION_END_REASON],
    BIO_REVOKE_REASON: [...BIO_REVOKE_REASON],
  },
};
