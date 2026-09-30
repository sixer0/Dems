/**
 * Branded entity identifier.
 *
 * `EntityId<'Session'>` is a plain string at runtime, but the brand stops an ID of one
 * entity from being passed where another entity's ID is expected.
 */
export type EntityId<TEntity extends string> = string & { readonly __entity: TEntity };

/** Cast a raw string to a branded ID (use only at trust boundaries: parsers and fixtures). */
export function entityId<TEntity extends string>(raw: string): EntityId<TEntity> {
  return raw as EntityId<TEntity>;
}
