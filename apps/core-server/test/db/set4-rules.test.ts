// The database-free half of migration set 4 (database contract dbc-4 §N.2, §N.10, §N.12;
// blueprint row 129). Unit project, so it runs in every later row's gate:
//
//   M4-MT-12 (rule half)   the mapping refuses a slice that changes the adapter of an existing
//                          id; the store's UPSERT names neither `adapter_kind` nor `kind` in its
//                          SET list (the D72(f) class: a missing grant stays invisible until the
//                          code path runs - the path itself runs as dems_app in
//                          `device-upsert.db.test.ts`);
//   SEC35-41 (c)           every INSERT into `capture_devices` names `adapter_kind`;
//   M4-SEC-RESET-1 (rule)  the exemption of the reset guard: `IS TRUE`, exactly four source rows,
//                          all of a development kind - everything else blocks.
import { DEFAULT_SEED, createIdleState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { MappingError, diffSlices, pickDurable, type DurableSlices } from '../../src/db/mapping';
import { DEFAULT_CAPTURE_ADAPTER_KIND, MAPPED_ADAPTER_KINDS_BY_DEVICE_KIND, captureDevicesToRows } from '../../src/db/mapping/rows';
import {
  DEVELOPMENT_ADAPTER_KINDS,
  REAL_SEALED_EVIDENCE_STATEMENT,
  SOURCE_ROWS_PER_SESSION,
  classifyRealSealedRows,
  developmentPackagesMessage,
  evaluateRealEvidence,
  realEvidenceMessage,
} from '../../src/db/reset/real-evidence';
import { CAPTURE_ADAPTER_KIND, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND, CAPTURE_PRODUCTION_ADAPTER_KINDS, CAPTURE_SOURCE_SLOT } from '../../src/db/schema/value-sets';
import { SET_ADOPTED_CAMERA_COLUMNS } from '../../src/modules/capture-discovery/adoption';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../static/scan';

const NOW = 1_790_823_600_000;
const durable = (): DurableSlices => pickDurable(createIdleState({ now: NOW, seed: DEFAULT_SEED }) as unknown as DurableSlices);

/** The durable slices with one member of one capture device changed (the slice type has no `adapter` yet). */
function withDevice(base: DurableSlices, id: string, change: Record<string, unknown>): DurableSlices {
  return {
    ...base,
    captureDevices: { devices: base.captureDevices.devices.map((device) => (device.id === id ? ({ ...device, ...change } as typeof device) : device)) },
  };
}

describe('dbc-4 §N.2: the adapter kind in the mapping', () => {
  it('the mapping states the same pairing table as the typed schema, over the same five kinds', () => {
    expect(MAPPED_ADAPTER_KINDS_BY_DEVICE_KIND).toEqual(CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND);
    expect([...new Set(Object.values(CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND).flat())].sort()).toEqual([...CAPTURE_ADAPTER_KIND].sort());
    expect(CAPTURE_ADAPTER_KIND).toEqual(['ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE']);
    // D60 (2026-11-04): the selector has six slots - four video tracks and the two microphones.
    expect(CAPTURE_SOURCE_SLOT).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61 (2026-11-04): the roles became the four numbered channels
  });

  it('a slice that names no adapter maps to FAKE (the safe default); a named adapter is carried into the row', () => {
    const base = durable();
    expect(DEFAULT_CAPTURE_ADAPTER_KIND).toBe('FAKE');
    // D60 (2026-11-04): the seed's seven built-ins - four cameras, two mics, one switch.
    expect(captureDevicesToRows(base.captureDevices, base.captureConfig).map((row) => row.adapterKind)).toEqual(['FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE', 'FAKE']); // D61 (2026-11-04): nine built-ins
    const local = withDevice(base, 'CAM-01', { adapter: 'LOCAL_DEVICE' });
    expect(captureDevicesToRows(local.captureDevices, local.captureConfig).find((row) => row.id === 'CAM-01')?.adapterKind).toBe('LOCAL_DEVICE');
  });

  it('an adapter outside the set, or one the device class may not carry, is refused by the mapping', () => {
    const base = durable();
    for (const [id, adapter] of [['CAM-01', 'RTMP'], ['CAM-01', 'USB_AUDIO'], ['MIC-01', 'ONVIF_RTSP'], ['POE-SWITCH', 'LOCAL_DEVICE'], ['CAM-02', 7]] as const) {
      const bad = withDevice(base, id, { adapter });
      expect(() => captureDevicesToRows(bad.captureDevices, bad.captureConfig), `${id} ${String(adapter)}`).toThrow(MappingError);
    }
  });

  it('M4-MT-12: a slice that changes the adapter of an existing id is refused; the same change without it is an upsert', () => {
    const before = withDevice(durable(), 'CAM-01', { adapter: 'FAKE' });
    const relabelled = withDevice(before, 'CAM-01', { adapter: 'LOCAL_DEVICE' });
    const error = (() => {
      try {
        diffSlices(before, relabelled, NOW + 1);
      } catch (thrown) {
        return thrown;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(MappingError);
    expect(error).toMatchObject({ code: 'NOT_WRITABLE', place: 'capture_devices' });
    expect((error as Error).message).toContain('the adapter kind of CAM-01 changed');
    // NEGATIVE CONTROL: another member of the same device changes and the diff is one upsert row.
    const offline = withDevice(before, 'CAM-01', { online: false, streamState: 'LOST' });
    const changes = diffSlices(before, offline, NOW + 1).filter((change) => change.table === 'captureDevices');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: 'insert', rows: [{ id: 'CAM-01', enabled: false, adapterKind: 'FAKE' }] });
  });
});

describe('M4-MT-12 and SEC35-41 (c): the statements of the production sources', () => {
  const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
  const store = production.filter((file) => file.path === 'src/db/store/store.ts');

  /** The property names of every `set: { ... }` of an `onConflictDoUpdate` on the device registry. */
  function upsertSetLists(files: readonly SourceFile[]): string[][] {
    return files.flatMap((file) =>
      [...file.text.matchAll(/onConflictDoUpdate\(\s*\{[^}]*?set:\s*\{([^}]*)\}/g)].map((match) =>
        [...(match[1] ?? '').matchAll(/([A-Za-z0-9_]+)\s*:/g)].map((property) => property[1] ?? ''),
      ),
    );
  }

  it("the device UPSERT's SET list is the six columns the engine state models: neither adapter_kind nor kind (nor id), and none of the four discovery columns", () => {
    const lists = upsertSetLists(store);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toEqual(['transport', 'model', 'firmware', 'address', 'poePort', 'enabled']);
    // Rule 1 (dbc-4 §N.2, D72(f), D83): written at INSERT, no UPDATE grant.
    for (const forbidden of ['adapterKind', 'adapter_kind', 'kind', 'id']) expect(lists[0], forbidden).not.toContain(forbidden);
    // Rule 2 (pair-58 A-11, D95): the engine state does not model these, so an update must not blank them.
    for (const unmodelled of ['mac', 'onvifUuid', 'profiles', 'lastSeenAt']) expect(lists[0], unmodelled).not.toContain(unmodelled);
  });

  it('positive control: a SET list that names the adapter kind is found', () => {
    const planted: SourceFile[] = [{ path: 'x.ts', text: 'await e.insert(d).values(row).onConflictDoUpdate({ target: d.id, set: { enabled: row.enabled, adapterKind: row.adapterKind } });' }];
    expect(upsertSetLists(planted)).toEqual([['enabled', 'adapterKind']]);
  });

  // The SET list only (pass D1a, D132): the search stops at WHERE, so a statement that FILTERS on
  // `kind` (adoption's `... WHERE id = $1 AND kind = 'CAMERA'`, which sets four discovery columns
  // of the row it has just inserted) is not a finding; one that ASSIGNS either column still is.
  const UPDATE_OF_REGISTRY = /\bUPDATE\s+(?:ONLY\s+)?(?:public\.)?capture_devices\b[^;`'"]*?\bSET\b(?:(?!\bWHERE\b)[^;`'"])*\b(?:adapter_kind|kind)\s*=/gi;
  const RAW_INSERT = /\bINSERT\s+INTO\s+(?:public\.)?capture_devices\b\s*\(([^)]*)\)/gi;

  it('no production statement updates adapter_kind or kind of capture_devices', () => {
    expect(occurrences(production, UPDATE_OF_REGISTRY)).toEqual([]);
    const planted: SourceFile[] = [{ path: 'y.ts', text: "await pool.query(\"UPDATE public.capture_devices SET enabled = true, adapter_kind = 'FAKE' WHERE id = $1\")" }];
    expect(occurrences(planted, UPDATE_OF_REGISTRY)).toEqual(['y.ts:1']);
    // Each column, alone and after other assignments, with and without a WHERE that also names it.
    const assigns = ["UPDATE capture_devices SET kind = $2 WHERE id = $1", "UPDATE ONLY public.capture_devices SET model = $2, kind = $3", "UPDATE public.capture_devices SET adapter_kind = $2 WHERE id = $1 AND kind = $3"];
    expect(assigns.map((text) => occurrences([{ path: 'z.ts', text: `q(\`${text}\`)` }], UPDATE_OF_REGISTRY))).toEqual(assigns.map(() => ['z.ts:1']));
    // A filter on the column is not an assignment: the statement of an adoption, and the plain form.
    const filters = [SET_ADOPTED_CAMERA_COLUMNS, 'UPDATE public.capture_devices SET enabled = $2 WHERE id = $1 AND adapter_kind = $3'];
    expect(filters.flatMap((text) => occurrences([{ path: 'z.ts', text: `q(\`${text}\`)` }], UPDATE_OF_REGISTRY))).toEqual([]);
    // What an adoption's statement sets, column by column: the four discovery columns and no other.
    expect(/\bSET\b(.*?)\bWHERE\b/.exec(SET_ADOPTED_CAMERA_COLUMNS)?.[1]?.split(',').map((assignment) => assignment.split('=')[0]?.trim())).toEqual(['transport', 'onvif_uuid', 'profiles', 'last_seen_at']);
  });

  it('SEC35-41 (c): every INSERT into capture_devices names adapter_kind', () => {
    // A statement written as SQL text must list the column.
    const raw = production.flatMap((file) => [...file.text.matchAll(RAW_INSERT)].map((match) => ({ path: file.path, columns: match[1] ?? '' })));
    expect(raw.filter((statement) => !/\badapter_kind\b/.test(statement.columns)).map((statement) => statement.path)).toEqual([]);
    // A typed INSERT takes the SELECT shape of the row (`CaptureDeviceRow`), in which the compiler
    // requires `adapterKind`. The insert shape, where the column is optional, is used by no
    // production source outside the file that declares it.
    expect(occurrences(production, /\bNewCaptureDeviceRow\b/g, (path) => path !== 'src/db/schema/capture.ts')).toEqual([]);
    expect(occurrences(production, /captureDevices\s*\.\s*\$inferInsert/g, (path) => path !== 'src/db/schema/capture.ts')).toEqual([]);
    // Positive controls.
    const planted: SourceFile[] = [{ path: 'z.ts', text: "INSERT INTO public.capture_devices (id, kind, transport) VALUES ($1, $2, $3)" }];
    expect([...((planted[0] as SourceFile).text.matchAll(RAW_INSERT))].map((match) => /\badapter_kind\b/.test(match[1] ?? ''))).toEqual([false]);
    expect(occurrences([{ path: 'w.ts', text: 'const row: NewCaptureDeviceRow = { id };' }], /\bNewCaptureDeviceRow\b/g)).toEqual(['w.ts:1']);
  });
});

describe('M4-SEC-RESET-1 (rule): the exemption of the reset guard', () => {
  const row = (session_id: string, development_flag: boolean | null | undefined, source_rows: number, development_rows: number) => ({ session_id, development_flag, source_rows, development_rows });

  it('the statement asks IS TRUE, counts development kinds, and stays a SELECT', () => {
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('(e.development_sources IS TRUE) AS development_flag');
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/IS\s+NOT\s+FALSE|<>\s*false|!=\s*false|COALESCE/i);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("s.adapter_kind IN ('FAKE', 'LOCAL_DEVICE')");
    // Pass E3: REAL items, and the demo items a seed really sealed (version 2, a signature that is not the stand-in); both sealed. Nothing else is read.
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("WHERE (e.integrity_source = 'REAL' OR (e.integrity_source = 'DEMO_PACKAGE' AND e.manifest_version = 2 AND e.signature_simulated IS FALSE)) AND e.sealed_at IS NOT NULL");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/);
    expect(SOURCE_ROWS_PER_SESSION).toBe(CAPTURE_SOURCE_SLOT.length);
    // The two development kinds are exactly the kinds that are not production kinds.
    expect([...DEVELOPMENT_ADAPTER_KINDS].sort()).toEqual(CAPTURE_ADAPTER_KIND.filter((kind) => !(CAPTURE_PRODUCTION_ADAPTER_KINDS as readonly string[]).includes(kind)).sort());
  });

  it('only flag = true with exactly eight development source rows is exempt (D61); every other row blocks', () => {
    const split = classifyRealSealedRows([
      row('S-NULL', null, 8, 8), // development_sources NULL: `IS TRUE` is false (D61: eight slots)
      row('S-FALSE', false, 8, 8),
      row('S-MISSING', undefined, 8, 8), // a row without the member at all (an older reader)
      row('S-ONE-PRODUCTION', true, 8, 7),
      row('S-THREE-ROWS', true, 3, 3),
      row('S-FIVE-ROWS', true, 5, 5),
      row('S-NO-ROWS', true, 0, 0),
      row('S-DEV', true, 8, 8),
    ]);
    expect(split.development).toEqual(['S-DEV']);
    expect(split.blocking).toEqual(['S-NULL', 'S-FALSE', 'S-MISSING', 'S-ONE-PRODUCTION', 'S-THREE-ROWS', 'S-FIVE-ROWS', 'S-NO-ROWS']);
    expect(split.unproven).toEqual(['S-ONE-PRODUCTION', 'S-THREE-ROWS', 'S-FIVE-ROWS', 'S-NO-ROWS']);
    // A truthy value that is not the boolean true is not the flag.
    expect(classifyRealSealedRows([{ session_id: 'S-TEXT', development_flag: 't' as unknown as boolean, source_rows: 8, development_rows: 8 }]).development).toEqual([]);
  });

  it('exempt items do not block and are counted; an unproven one blocks and the message says how many', () => {
    const scan = { root: '/store', present: false, packages: [] };
    const allowed = classifyRealSealedRows([row('S-DEV-1', true, 8, 8), row('S-DEV-2', true, 8, 8)]);
    const facts = evaluateRealEvidence('dems_lane_2', '/store', allowed.blocking, scan, allowed);
    expect(facts.blocked).toBe(false);
    expect(facts.developmentSessions).toEqual(['S-DEV-1', 'S-DEV-2']);
    expect(developmentPackagesMessage(facts)).toContain('this reset erases 2 development-source package record(s) of dems_lane_2 (S-DEV-1, S-DEV-2)');

    const refused = classifyRealSealedRows([row('S-DEV-1', true, 8, 8), row('S-BAD', true, 8, 7)]);
    const blockedFacts = evaluateRealEvidence('dems_lane_2', '/store', refused.blocking, scan, refused);
    expect(blockedFacts.blocked).toBe(true);
    expect(realEvidenceMessage(blockedFacts)).toContain('1 REAL sealed item(s), 1 of them flagged as development sources without eight development source rows');
    expect(developmentPackagesMessage(evaluateRealEvidence('dems_lane_2', '/store', [], scan))).toBe('');
  });

  it('the disk side is unchanged: a REAL package on disk blocks even when its row is exempt', () => {
    const exempt = classifyRealSealedRows([row('S-DEV', true, 6, 6)]);
    const scan = { root: '/store', present: true, packages: [{ sessionId: 'S-DEV', directory: 'SESSION-S-DEV', integrity: 'REAL' as const }] };
    expect(evaluateRealEvidence('dems_lane_2', '/store', exempt.blocking, scan, exempt).blocked).toBe(true);
  });
});
