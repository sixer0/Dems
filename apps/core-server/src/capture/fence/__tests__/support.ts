// Test support of the capture fence (blueprint row 136): an in-memory stand-in of the two capture
// tables behind the fence's three statements, sinks that keep what they were told, and
// configurations. Not a test file; nothing here is shipped.
import type { CaptureAdapterKind, CaptureOperation } from '../../adapters';
import type { CaptureFenceBootDeps, CaptureFenceSinks, CaptureFenceUnit } from '../boot';
import type { CaptureOperationInput } from '../operation';
import type { StoredCaptureDevice } from '../registration';
import { CORRECT_GENERATED_SOURCE_PROFILES } from '../fake-profile';
import { READ_ASSIGNED_SOURCES, READ_STORED_DEVICES, REGISTER_LOCAL_DEVICE } from '../statements';

/** One member per slot. `null` is an UNASSIGNED slot (task 4 row 33; schema set A made the columns nullable): the statement's JOIN yields no row for it. D60 (2026-11-04): the two further camera lines are OPTIONAL - absent means unassigned, as the seed leaves them. D61 (2026-11-04): the two mic roles became the four numbered CHANNELS (`mic_01_id`..`mic_04_id`), all OPTIONAL. */
export interface Selector {
  readonly video01: string | null;
  readonly video02: string | null;
  readonly video03?: string | null;
  readonly video04?: string | null;
  readonly mic01?: string | null;
  readonly mic02?: string | null;
  readonly mic03?: string | null;
  readonly mic04?: string | null;
}

const device = (id: string, kind: StoredCaptureDevice['kind'], adapterKind: CaptureAdapterKind, model: string | null = null): StoredCaptureDevice => ({ id, kind, adapterKind, model });

/** The five built-ins of the seed: all `FAKE`. */
export const SEEDED: readonly StoredCaptureDevice[] = [device('CAM-01', 'CAMERA', 'FAKE'), device('CAM-02', 'CAMERA', 'FAKE'), device('MIC-01', 'MIC', 'FAKE'), device('MIC-02', 'MIC', 'FAKE'), device('POE-SWITCH', 'POE', 'FAKE')];
export const SEEDED_SELECTOR: Selector = { video01: 'CAM-01', video02: 'CAM-02', mic01: 'MIC-01', mic02: 'MIC-02' };
/** A site with adopted production devices, assigned. D60 (2026-11-04): four adopted cameras - every video line can name its own device. */
export const PRODUCTION: readonly StoredCaptureDevice[] = [device('CAM-11', 'CAMERA', 'ONVIF_RTSP'), device('CAM-12', 'CAMERA', 'ONVIF_RTSP'), device('CAM-13', 'CAMERA', 'ONVIF_RTSP'), device('CAM-14', 'CAMERA', 'ONVIF_RTSP'), device('MIC-11', 'MIC', 'USB_AUDIO'), device('MIC-12', 'MIC', 'USB_AUDIO'), device('MIC-13', 'MIC', 'USB_AUDIO'), device('MIC-14', 'MIC', 'USB_AUDIO')]; // D61 (2026-11-04): the four channels of a commissioned room
/** Two further generated test sources of a development site (D60, 2026-11-04): the third and fourth camera lines of a fully assigned selector. */
export const EXTRA: readonly StoredCaptureDevice[] = [device('CAM-04', 'CAMERA', 'FAKE'), device('CAM-05', 'CAMERA', 'FAKE'), device('MIC-04', 'MIC', 'FAKE')]; // D60: the third and fourth camera lines; D61: the fourth microphone channel
export const PRODUCTION_SELECTOR: Selector = { video01: 'CAM-11', video02: 'CAM-12', mic01: 'MIC-11', mic02: 'MIC-12' };
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
          // D60 (2026-11-04): the two further camera lines join the read (an absent member is an unassigned slot, as the seed leaves it).
          // D61 (2026-11-04): the read holds EIGHT slots - the two mic roles became the four numbered channels.
          const slots: readonly (readonly [string, string | null])[] = [['MIC-01', tables.selector.mic01 ?? null], ['MIC-02', tables.selector.mic02 ?? null], ['MIC-03', tables.selector.mic03 ?? null], ['MIC-04', tables.selector.mic04 ?? null], ['VIDEO-01', tables.selector.video01], ['VIDEO-02', tables.selector.video02], ['VIDEO-03', tables.selector.video03 ?? null], ['VIDEO-04', tables.selector.video04 ?? null]];
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
