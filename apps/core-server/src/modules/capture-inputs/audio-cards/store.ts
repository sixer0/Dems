/**
 * The stored side of the microphone registration (task 4, blueprint row 70): the statements of
 * `statements.ts` behind one interface, so that the service can be checked without a database and
 * a test can make ONE write fail to show that the unit rolls back as a whole.
 *
 * Every function takes the connection to run on. A read may run on the pool; every write runs on
 * the unit of work of the registration and on nothing else. The registry row itself
 * (`capture_devices`) is NOT written here: it is the registrar's (`service.ts`).
 */
import type { QueryResultRow } from 'pg';
import { INSERT_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS, REFRESH_AUDIO_INPUT } from './statements';

/** A connection that runs one parameterised statement: the pool for a read, a unit of work for a write. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** Which input of which card: the unique key of `capture_audio_inputs`. Three values, no device text. */
export interface AudioInputKey {
  readonly cardId: string;
  readonly cardDevice: number;
  readonly inputNumber: number;
}

/** A registered input, as operation 98 lists it. */
export interface RegisteredAudioInput extends AudioInputKey {
  readonly deviceId: string;
}

/** The stored row of one input, as a registration finds it. */
export interface StoredAudioInput {
  readonly deviceId: string;
  readonly usbId: string | null;
  /**
   * The USB port path the input was registered on, where the store holds one (task 4 row 156,
   * AD-07 (4)). Absent or null: NOT STORED - `capture_audio_inputs` has no port column (schema set
   * A), so the store of this file answers none; the identity rule then says what it cannot tell.
   */
  readonly usbPort?: string | null;
  readonly enabled: boolean;
}

/** The card facts a registration stores, all taken from the Core's own listing. */
export interface AudioInputFacts {
  readonly deviceId: string;
  readonly usbId: string | null;
  /** The USB port path of the listing, or null when the system offers none. Handed to every store; written by one that has a column for it (row 156). */
  readonly usbPort?: string | null;
  readonly nativeChannels: number;
  readonly sampleBits: 16 | 24 | 32;
  readonly operatorId: string;
  readonly at: number;
}

export interface MicrophoneStore {
  registeredInputs(db: Queryable): Promise<RegisteredAudioInput[]>;
  inputOf(db: Queryable, key: AudioInputKey): Promise<StoredAudioInput | null>;
  /** The second write of a new registration, after the registrar's registry row. */
  insertInput(db: Queryable, input: AudioInputFacts & AudioInputKey): Promise<void>;
  refreshInput(db: Queryable, input: AudioInputFacts): Promise<void>;
}

/** A write that did not change exactly the one row it names. Thrown inside the unit: everything rolls back. */
export class MicrophoneRowMissing extends Error {
  readonly code = 'CAPTURE_AUDIO_INPUT_ROW_MISSING';
  readonly statement: 'INSERT_INPUT' | 'REFRESH_INPUT';
  constructor(statement: 'INSERT_INPUT' | 'REFRESH_INPUT') {
    super('a write of the microphone registration did not change exactly one row');
    this.name = 'MicrophoneRowMissing';
    this.statement = statement;
  }
}

/**
 * THE CARD IDENTITY VALUES OF AN INPUT ROW, in the order both write statements bind them from
 * `$2` on (task 4 row 190). TODAY one value, the USB id: the committed table (schema set A) has no
 * other identity column. When the serial and the port-path columns of row 192 are committed, the
 * two values are added HERE, in this one line (`input.usbPort ?? null` and the serial member the
 * facts then carry), with their two columns in `INSERT_AUDIO_INPUT` and `REFRESH_AUDIO_INPUT` of
 * `statements.ts`; no other line of the store binds an identity value.
 */
export function cardIdentityValuesOf(input: AudioInputFacts): readonly (string | null)[] {
  return [input.usbId];
}

export function createMicrophoneStore(): MicrophoneStore {
  const one =(rowCount: number | null, statement: MicrophoneRowMissing['statement']): void => {
    if (rowCount !== 1) throw new MicrophoneRowMissing(statement);
  };
  return {
    async registeredInputs(db) {
      const { rows } = await db.query<{ deviceId: string; cardId: string; cardDevice: number; inputNumber: number }>(READ_REGISTERED_AUDIO_INPUTS);
      return rows.map((row) => ({ deviceId: row.deviceId, cardId: row.cardId, cardDevice: Number(row.cardDevice), inputNumber: Number(row.inputNumber) }));
    },
    async inputOf(db, key) {
      const { rows } = await db.query<{ deviceId: string; usbId: string | null; enabled: boolean }>(READ_AUDIO_INPUT_OF_CARD, [key.cardId, key.cardDevice, key.inputNumber]);
      const row = rows[0];
      return row === undefined ? null : { deviceId: row.deviceId, usbId: row.usbId, enabled: row.enabled === true };
    },
    async insertInput(db, input) {
      const { rowCount } = await db.query(INSERT_AUDIO_INPUT, [input.deviceId, ...cardIdentityValuesOf(input), input.cardId, input.cardDevice, input.inputNumber, input.nativeChannels, input.sampleBits, input.operatorId, input.at]);
      one(rowCount, 'INSERT_INPUT');
    },
    async refreshInput(db, input) {
      const { rowCount } = await db.query(REFRESH_AUDIO_INPUT, [input.deviceId, ...cardIdentityValuesOf(input), input.nativeChannels, input.sampleBits, input.operatorId, input.at]);
      one(rowCount, 'REFRESH_INPUT');
    },
  };
}
