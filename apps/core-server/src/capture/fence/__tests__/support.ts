// Test support of the capture fence (blueprint row 136): an in-memory stand-in of the two capture
// tables behind the fence's three statements, sinks that keep what they were told, and
// configurations. Not a test file; nothing here is shipped.
import type { CaptureAdapterKind, CaptureOperation } from '../../adapters';
import type { CaptureFenceBootDeps, CaptureFenceSinks, CaptureFenceUnit } from '../boot';
import type { CaptureOperationInput } from '../operation';
import type { StoredCaptureDevice } from '../registration';
import { CORRECT_GENERATED_SOURCE_PROFILES } from '../fake-profile';
import { READ_ASSIGNED_SOURCES, READ_STORED_DEVICES, REGISTER_LOCAL_DEVICE } from '../statements';

/** One member per slot. `null` is an UNASSIGNED slot (task 4 row 33; schema set A made the columns nullable): the statement's JOIN yields no row for it. */
export interface Selector {
  readonly video01: string | null;
  readonly video02: string | null;
  readonly primary: string | null;
  readonly standby: string | null;
}

const device = (id: string, kind: StoredCaptureDevice['kind'], adapterKind: CaptureAdapterKind, model: string | null = null): StoredCaptureDevice => ({ id, kind, adapterKind, model });

/** The five built-ins of the seed: all `FAKE`. */
export const SEEDED: readonly StoredCaptureDevice[] = [device('CAM-01', 'CAMERA', 'FAKE'), device('CAM-02', 'CAMERA', 'FAKE'), device('MIC-01', 'MIC', 'FAKE'), device('MIC-02', 'MIC', 'FAKE'), device('POE-SWITCH', 'POE', 'FAKE')];
export const SEEDED_SELECTOR: Selector = { video01: 'CAM-01', video02: 'CAM-02', primary: 'MIC-01', standby: 'MIC-02' };
/** A site with adopted production devices, assigned. */
export const PRODUCTION: readonly StoredCaptureDevice[] = [device('CAM-11', 'CAMERA', 'ONVIF_RTSP'), device('CAM-12', 'CAMERA', 'ONVIF_RTSP'), device('MIC-11', 'MIC', 'USB_AUDIO'), device('MIC-12', 'MIC', 'USB_AUDIO')];
export const PRODUCTION_SELECTOR: Selector = { video01: 'CAM-11', video02: 'CAM-12', primary: 'MIC-11', standby: 'MIC-12' };
export const LOCAL: readonly StoredCaptureDevice[] = [device('CAM-03', 'CAMERA', 'LOCAL_DEVICE', 'MacBook Air Camera'), device('MIC-03', 'MIC', 'LOCAL_DEVICE', 'MacBook Air Microphone')];

export interface FakeTables {
  readonly devices: StoredCaptureDevice[];
  selector: Selector | null;
  /** The `enabled` each registered row was inserted with, by id. */
  readonly enabled: Map<string, boolean>;
  /** The `captureOperation` of every boot audit row, in order. */
  readonly bootAudits: CaptureOperation[];
  /** Every statement text that ran, in order. */
  readonly statements: string[];
  readonly unit: CaptureFenceUnit;
  inUnit: CaptureFenceBootDeps['inUnit'];
}

/** The two tables, and a unit that answers the fence's three statements as PostgreSQL does. Any other statement throws. */
export function fakeTables(devices: readonly StoredCaptureDevice[], selector: Selector | null): FakeTables {
  const tables: FakeTables = {
    devices: [...devices],
    selector,
    enabled: new Map(),
    bootAudits: [],
    statements: [],
    unit: {
      async query<Row extends Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{ rows: Row[] }> {
        tables.statements.push(text);
        const sorted = [...tables.devices].sort((left, right) => (left.id < right.id ? -1 : 1));
        if (text === READ_STORED_DEVICES) return { rows: sorted.map((row) => ({ ...row })) as unknown as Row[] };
        if (text === READ_ASSIGNED_SOURCES) {
          if (tables.selector === null) return { rows: [] };
          const slots: readonly (readonly [string, string | null])[] = [['MIC-PRIMARY', tables.selector.primary], ['MIC-STANDBY', tables.selector.standby], ['VIDEO-01', tables.selector.video01], ['VIDEO-02', tables.selector.video02]];
          return { rows: slots.flatMap(([slot, id]) => sorted.filter((row) => row.id === id).map((row) => ({ slot, id, kind: row.kind, adapterKind: row.adapterKind }))) as unknown as Row[] };
        }
        if (text === REGISTER_LOCAL_DEVICE) {
          const [kind, prefix, , model, listed] = values as [StoredCaptureDevice['kind'], string, string, string, boolean];
          if (sorted.some((row) => row.kind === kind && row.adapterKind === 'LOCAL_DEVICE')) return { rows: [] };
          const next = Math.max(0, ...sorted.filter((row) => row.kind === kind).map((row) => Number(/-([0-9]+)$/.exec(row.id)?.[1] ?? 0))) + 1;
          const id = `${prefix}${String(next).padStart(2, '0')}`;
          tables.devices.push(device(id, kind, 'LOCAL_DEVICE', model));
          tables.enabled.set(id, listed);
          return { rows: [{ id }] as unknown as Row[] };
        }
        // Fix wave K (G89b-01): the double holds no profile column - nothing to correct, as on a database whose lines already state it.
        if (text === CORRECT_GENERATED_SOURCE_PROFILES) return { rows: [] };
        throw new Error(`a statement the fence does not own: ${text.slice(0, 40)}`);
      },
      async appendBootAudit(operation) {
        tables.bootAudits.push(operation);
      },
    },
    inUnit: (work) => work(tables.unit),
  };
  return tables;
}

export interface KeptSinks extends CaptureFenceSinks {
  readonly lines: { readonly level: 'info' | 'warn' | 'error'; readonly fields: Record<string, unknown>; readonly message: string }[];
  readonly persisted: Parameters<CaptureFenceSinks['persist']>[0][];
}

export function keptSinks(): KeptSinks {
  const sinks: KeptSinks = {
    lines: [],
    persisted: [],
    info: (fields, message) => void sinks.lines.push({ level: 'info', fields, message }),
    warn: (fields, message) => void sinks.lines.push({ level: 'warn', fields, message }),
    error: (fields, message) => void sinks.lines.push({ level: 'error', fields, message }),
    persist: (entry) => void sinks.persisted.push(entry),
  };
  return sinks;
}

export type FenceConfig = CaptureOperationInput & { readonly captureHelperFfmpegPath: string | null };

/** A configuration of the fence; the default is today's demo (row 1 of the table). */
export const configOf = (patch: Partial<FenceConfig> = {}): FenceConfig => ({ captureMode: 'simulated', demoControls: true, captureDevSources: false, host: '127.0.0.1', captureHelperFfmpegPath: null, ...patch });

/** A helper program path of the tests. It is never started: the inspector below vouches for it. */
export const HELPER = '/opt/dems/helpers/ffmpeg';
