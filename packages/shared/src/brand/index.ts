/**
 * `@dems/shared/brand`: the brand emblem as data (SCR-03) and the topographic texture (SCR-06).
 * Framework-free; shared by apps/core-web and apps/mobile. Not re-exported from the root barrel,
 * so Node consumers such as mock-core never load the texture string.
 */
export * from './emblem';
export * from './topo';
