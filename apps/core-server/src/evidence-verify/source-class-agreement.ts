/**
 * M7-DEVSRC-BUILD-1 (blueprint row 141; evidence package spec §B.12 rule 2; `dbc-4` §N.2): the
 * adapter kinds of the Core and the adapter kinds the PACKAGE maps to a manifest source class are
 * the same set, held at COMPILE TIME.
 *
 * Two mappings exist, each the one of its side:
 *   - the Core:    `capture/adapters/kinds.ts`, kind -> PRODUCTION | DEVELOPMENT (the device shapes);
 *   - the package: `MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND` of `@dems/shared/evidence-package`,
 *                  kind -> PRODUCTION | LOCAL_DEVICE | FAKE (manifest fields 124, 125).
 * A kind added to the Core without a class in the package mapping - or the other way round - makes
 * the two constants below fail to type-check, so the workspace does not build: the kind can never
 * reach `BUILD_MANIFEST` and be refused only there (or, worse, be given a class by hand).
 *
 * TYPE IMPORTS ONLY from the adapter layer: this file loads nothing of it at run time (its index
 * loads the camera adapter's network modules). That the two mappings also AGREE on the class of
 * every kind (PRODUCTION <-> PRODUCTION, DEVELOPMENT <-> LOCAL_DEVICE | FAKE) is a value-level
 * fact and is held by `__tests__/source-class-agreement.test.ts`, through `disagreeingKinds`.
 */
import { MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND, ManifestSourceClass, type MappedAdapterKind } from '@dems/shared/evidence-package';
import type { CaptureAdapterKind, CaptureSourceClass } from '../capture/adapters';

type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Compile-time: the two kind sets are the same set. `true` is assignable only when they are. */
export const ADAPTER_KIND_SETS_AGREE: Exactly<CaptureAdapterKind, MappedAdapterKind> = true;

/** Compile-time: every kind of the Core has a manifest class. A kind without one is a missing member here. */
export const MANIFEST_CLASS_OF_CORE_KIND: Readonly<Record<CaptureAdapterKind, ManifestSourceClass>> = MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND;

/**
 * The kinds on which two mappings disagree: a kind only one of them knows, or a kind the Core
 * calls PRODUCTION while the package does not (and the reverse). Empty when they agree.
 */
export function disagreeingKinds(coreClassOfKind: Readonly<Record<string, CaptureSourceClass>>, manifestClassOfKind: Readonly<Record<string, ManifestSourceClass>> = MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND): readonly string[] {
  const kinds = [...new Set([...Object.keys(coreClassOfKind), ...Object.keys(manifestClassOfKind)])].sort();
  return Object.freeze(
    kinds.filter((kind) => {
      const core = Object.hasOwn(coreClassOfKind, kind) ? coreClassOfKind[kind] : undefined;
      const manifest = Object.hasOwn(manifestClassOfKind, kind) ? manifestClassOfKind[kind] : undefined;
      if (core === undefined || manifest === undefined) return true;
      return (core === 'PRODUCTION') !== (manifest === ManifestSourceClass.PRODUCTION);
    }),
  );
}
