/**
 * The operation table with literal types (backend task: decisions D36, contract gap 1, and D51).
 *
 * `CORE_API_OPERATION_TABLE` is the registry's table as it is written, `as const`: operation IDs,
 * methods, paths and schema names are literal types, so a client built on it gets one typed
 * `call` per operation. It is the same array object as `CORE_API_OPERATIONS`, which stays the
 * widened view (`readonly CoreApiRegistryOperation[]`) for a loop over the registry.
 *
 * ```ts
 * const client = createCoreClient({ baseUrl, credentials, operations: CORE_API_OPERATION_TABLE });
 * const answer = await client.call('assignUserRole', { params: { id: 'OPR-003' }, body: { role: 'INVESTIGATOR' } });
 * const page = await client.call('listAuditRows', { query: { order: 'DESC', limit: 50 } });
 * ```
 *
 * The typed client takes its default table type from `CoreApiOperationTable` of `core-api.ts`
 * (D51), so a client made without `operations` is typed the same way; this module gives the table
 * as a value of that type. The table has 75 entries since contract C. A type function over it must
 * not intersect several unions of its entries: three of them are 75 * 75 * 75 combinations, more
 * than the compiler represents (implementation/27_contract_c.md, finding F-1).
 */
import { CORE_API_OPERATIONS, type CoreApiOperationTable } from './core-api';

export const CORE_API_OPERATION_TABLE = CORE_API_OPERATIONS as unknown as CoreApiOperationTable;
