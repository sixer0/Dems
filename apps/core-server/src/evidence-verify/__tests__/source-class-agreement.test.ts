// M7-DEVSRC-BUILD-1 (blueprint row 141; evidence package spec §B.12 rule 2): the adapter-kind ->
// source-class mapping of the Core (`capture/adapters/kinds.ts`) and of the package
// (`@dems/shared/evidence-package`) agree, and a new adapter kind without a class fails.
//
// Two layers. COMPILE TIME: `../source-class-agreement.ts` does not type-check when the two kind
// sets differ; the `@ts-expect-error` lines below are the negative control of that (they stop
// compiling the day the check stops refusing). RUN TIME: every kind is walked and the classes
// compared, with planted mappings as the negative control.
import { MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND, ManifestSourceClass, manifestSourceClassOfAdapterKind, sessionSourceClasses, type MappedAdapterKind } from '@dems/shared/evidence-package';
import { describe, expect, it } from 'vitest';
import { CAPTURE_ADAPTER_KINDS, CaptureAdapterKind, CaptureSourceClass, sourceClassOf } from '../../capture/adapters';
import { ADAPTER_KIND_SETS_AGREE, MANIFEST_CLASS_OF_CORE_KIND, disagreeingKinds } from '../source-class-agreement';

type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** The Core's mapping as a table, read through its one function. */
const coreTable = (): Record<string, CaptureSourceClass> => Object.fromEntries(CAPTURE_ADAPTER_KINDS.map((kind) => [kind, sourceClassOf(kind)]));

describe('M7-DEVSRC-BUILD-1: the two mappings are of the same kinds and agree on every class', () => {
  it('compile time: the kind sets are the same set (and the check refuses a set that is not)', () => {
    expect(ADAPTER_KIND_SETS_AGREE).toBe(true);
    // NEGATIVE CONTROLS of the compile-time check. A kind the package does not map:
    // @ts-expect-error a new adapter kind of the Core without a manifest class does not build
    const coreGrew: Exactly<CaptureAdapterKind | 'NEW_KIND', MappedAdapterKind> = true;
    // A kind the package maps and the Core does not have:
    // @ts-expect-error a mapped kind the Core does not know does not build
    const packageGrew: Exactly<CaptureAdapterKind, MappedAdapterKind | 'NEW_KIND'> = true;
    // A Core kind without a class in the table:
    // @ts-expect-error a record of the Core's kinds needs every kind
    const missing: Readonly<Record<CaptureAdapterKind | 'NEW_KIND', ManifestSourceClass>> = MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND;
    void [coreGrew, packageGrew, missing];
  });

  it('run time: every kind of the Core has exactly one manifest class, and PRODUCTION means PRODUCTION on both sides', () => {
    expect(Object.keys(MANIFEST_CLASS_OF_CORE_KIND).sort()).toEqual([...CAPTURE_ADAPTER_KINDS].sort());
    expect(disagreeingKinds(coreTable())).toEqual([]);
    for (const kind of CAPTURE_ADAPTER_KINDS) {
      const manifest = manifestSourceClassOfAdapterKind(kind);
      expect(manifest === ManifestSourceClass.PRODUCTION, kind).toBe(sourceClassOf(kind) === CaptureSourceClass.PRODUCTION);
    }
    // The development kinds keep their own name in the manifest (three values, not two).
    expect(manifestSourceClassOfAdapterKind(CaptureAdapterKind.LOCAL_DEVICE)).toBe('LOCAL_DEVICE');
    expect(manifestSourceClassOfAdapterKind(CaptureAdapterKind.FAKE)).toBe('FAKE');
  });

  it('NEGATIVE CONTROL: a new kind on one side, and a kind whose class differs, are each named', () => {
    const core = coreTable();
    expect(disagreeingKinds({ ...core, NEW_KIND: CaptureSourceClass.PRODUCTION })).toEqual(['NEW_KIND']);
    expect(disagreeingKinds(core, { ...MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND, NEW_KIND: ManifestSourceClass.FAKE })).toEqual(['NEW_KIND']);
    expect(disagreeingKinds({ ...core, FAKE: CaptureSourceClass.PRODUCTION })).toEqual(['FAKE']);
    expect(disagreeingKinds(core, { ...MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND, ONVIF_RTSP: ManifestSourceClass.LOCAL_DEVICE })).toEqual(['ONVIF_RTSP']);
    const { LOCAL_DEVICE: _dropped, ...withoutLocal } = core;
    expect(disagreeingKinds(withoutLocal)).toEqual(['LOCAL_DEVICE']);
  });

  it('fails closed at the build of a manifest: a kind without a class is refused, never written as PRODUCTION', () => {
    expect(() => manifestSourceClassOfAdapterKind('NEW_KIND')).toThrowError(expect.objectContaining({ code: 'SOURCE_CLASS_UNMAPPED' }));
    for (const inherited of ['toString', 'constructor', '__proto__', '']) expect(() => manifestSourceClassOfAdapterKind(inherited), inherited).toThrowError();
    const rows = [
      { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'NEW_KIND' },
      { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
      { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'FAKE' },
      { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
    ];
    expect(() => sessionSourceClasses(rows)).toThrowError(expect.objectContaining({ code: 'SOURCE_CLASS_UNMAPPED' }));
    // Fewer than four rows: no class is assumed for the missing slot.
    expect(() => sessionSourceClasses(rows.slice(1))).toThrowError(expect.objectContaining({ code: 'SOURCE_RECORD_MISSING' }));
  });
});
