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
import { INSERT_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_BOUND_AUDIO_INPUTS, READ_REGISTERED_AUDIO_INPUTS, REFRESH_AUDIO_INPUT, REKEY_AUDIO_INPUT } from './statements';

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

/**
 * The stored identity of the card behind an input (task 4 rows 156, 192, 199; AD-07 (4)): the
 * three values the identity rule of `service.ts` (`matchStoredCard`) compares.
 */
export interface StoredCardIdentity {
  readonly usbId: string | null;
  /**
   * The serial number the card stated at the registration (`capture_audio_inputs.usb_serial`).
   * Null: it stated none - or the row was written before the column existed.
   */
  readonly usbSerial?: string | null;
  /**
   * The USB port path the input was registered on (`capture_audio_inputs.usb_port`). Null: the
   * system offered none - or the row was written before the column existed.
   */
  readonly usbPort?: string | null;
}

/** A registered input, as operation 98 lists it. */
export interface RegisteredAudioInput extends AudioInputKey {
  readonly deviceId: string;
  /**
   * The stored identity of its card. ABSENT only from a store that does not answer one (a test
   * double of before row 199): the input is then listed under its key, as it was.
   */
  readonly identity?: StoredCardIdentity;
}

/** The stored row of one input, as a registration finds it. */
export interface StoredAudioInput extends StoredCardIdentity {
  readonly deviceId: string;
  readonly enabled: boolean;
}

/** The card facts a registration stores, all taken from the Core's own listing. */
export interface AudioInputFacts {
  readonly deviceId: string;
  readonly usbId: string | null;
  /** The serial number of the listing, or null when the card states none (row 199). */
  readonly usbSerial?: string | null;
  /** The USB port path of the listing, or null when the system offers none (row 156). */
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
  /**
   * The live rows of one USB id, in microphone id order (DB-A2 `READ_BOUND_AUDIO_INPUTS`, row 130;
   * row 108: also a row with neither a serial nor a port): the holders the service holds the
   * identity rule against (operations 98 and 99, row 131).
   */
  boundInputs(db: Queryable, usbId: string): Promise<BoundAudioInput[]>;
  /** Moves one live row to a new key (DB-A6 `REKEY_AUDIO_INPUT`, row 130): a port move under another kernel key, or a release (row 131). */
  rekeyInput(db: Queryable, input: AudioInputRekey): Promise<void>;
}

/** A live input row that holds a card (DB-A2): its microphone, its input and the stored identity. */
export interface BoundAudioInput {
  readonly deviceId: string;
  readonly cardDevice: number;
  readonly inputNumber: number;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
}

/** What a re-key writes (DB-A6): the identity of the card, the new key, the operator and the instant. */
export type AudioInputRekey = Pick<AudioInputFacts, 'deviceId' | 'usbId' | 'usbSerial' | 'usbPort' | 'operatorId' | 'at'> & AudioInputKey;

/** A write that did not change exactly the one row it names. Thrown inside the unit: everything rolls back. */
export class MicrophoneRowMissing extends Error {
  readonly code = 'CAPTURE_AUDIO_INPUT_ROW_MISSING';
  readonly statement: 'INSERT_INPUT' | 'REFRESH_INPUT' | 'REKEY_INPUT';
  constructor(statement: 'INSERT_INPUT' | 'REFRESH_INPUT' | 'REKEY_INPUT') {
    super('a write of the microphone registration did not change exactly one row');
    this.name = 'MicrophoneRowMissing';
    this.statement = statement;
  }
}

/**
 * The closed form of a stored serial and of a stored port path: the CHECKs of the table
 * (`capture_audio_inputs_usb_serial_check`, `..._usb_port_check`, row 192) and the rule the card
 * listing passes both through (`cardListingText`, kinds `USB_SERIAL` and `USB_PORT`).
 */
const CARD_IDENTITY_TEXT = /^[A-Za-z0-9:._-]{1,64}$/;

/**
 * A serial or a port path as it is BOUND and as it is READ: the text when it is of the closed
 * form, else null. A value that does not fit is written as NULL, never as it came, so the CHECK is
 * never what refuses a registration, and a row never holds a text a device chose outside the rule.
 */
export function cardIdentityText(value: unknown): string | null {
  return typeof value === 'string' && CARD_IDENTITY_TEXT.test(value) ? value : null;
}

/**
 * THE CARD IDENTITY VALUES OF AN INPUT ROW, in the order every write statement binds them from
 * `$2` on (task 4 rows 190, 199; R-FLEX row 130): the USB id, the USB serial, the USB port path - the columns
 * `usb_id`, `usb_serial`, `usb_port` of `INSERT_AUDIO_INPUT`, `REFRESH_AUDIO_INPUT` and `REKEY_AUDIO_INPUT`
 * (`statements.ts`). No other line of the store binds an identity value.
 */
export function cardIdentityValuesOf(input: Pick<AudioInputFacts, 'usbId' | 'usbSerial' | 'usbPort'>): readonly (string | null)[] {
  return [input.usbId, cardIdentityText(input.usbSerial), cardIdentityText(input.usbPort)];
}

interface IdentityColumns {
  readonly usbId: string | null;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
}
const identityOf = (row: IdentityColumns): StoredCardIdentity => ({ usbId: row.usbId, usbSerial: cardIdentityText(row.usbSerial), usbPort: cardIdentityText(row.usbPort) });

export function createMicrophoneStore(): MicrophoneStore {
  const one =(rowCount: number | null, statement: MicrophoneRowMissing['statement']): void => {
    if (rowCount !== 1) throw new MicrophoneRowMissing(statement);
  };
  return {
    async registeredInputs(db) {
      const { rows } = await db.query<{ deviceId: string; cardId: string; cardDevice: number; inputNumber: number } & IdentityColumns>(READ_REGISTERED_AUDIO_INPUTS);
      return rows.map((row) => ({ deviceId: row.deviceId, cardId: row.cardId, cardDevice: Number(row.cardDevice), inputNumber: Number(row.inputNumber), identity: identityOf(row) }));
    },
    async inputOf(db, key) {
      const { rows } = await db.query<{ deviceId: string; enabled: boolean } & IdentityColumns>(READ_AUDIO_INPUT_OF_CARD, [key.cardId, key.cardDevice, key.inputNumber]);
      const row = rows[0];
      return row === undefined ? null : { deviceId: row.deviceId, ...identityOf(row), enabled: row.enabled === true };
    },
    async insertInput(db, input) {
      const { rowCount } = await db.query(INSERT_AUDIO_INPUT, [input.deviceId, ...cardIdentityValuesOf(input), input.cardId, input.cardDevice, input.inputNumber, input.nativeChannels, input.sampleBits, input.operatorId, input.at]);
      one(rowCount, 'INSERT_INPUT');
    },
    async refreshInput(db, input) {
      const { rowCount } = await db.query(REFRESH_AUDIO_INPUT, [input.deviceId, ...cardIdentityValuesOf(input), input.nativeChannels, input.sampleBits, input.operatorId, input.at]);
      one(rowCount, 'REFRESH_INPUT');
    },
    async boundInputs(db, usbId) {
      const { rows } = await db.query<{ deviceId: string; cardDevice: number; inputNumber: number; usbSerial: string | null; usbPort: string | null }>(READ_BOUND_AUDIO_INPUTS, [usbId]);
      return rows.map((row) => ({ deviceId: row.deviceId, cardDevice: Number(row.cardDevice), inputNumber: Number(row.inputNumber), usbSerial: cardIdentityText(row.usbSerial), usbPort: cardIdentityText(row.usbPort) }));
    },
    async rekeyInput(db, input) {
      const { rowCount } = await db.query(REKEY_AUDIO_INPUT, [input.deviceId, ...cardIdentityValuesOf(input), input.cardId, input.cardDevice, input.inputNumber, input.operatorId, input.at]);
      one(rowCount, 'REKEY_INPUT');
    },
  };
}
