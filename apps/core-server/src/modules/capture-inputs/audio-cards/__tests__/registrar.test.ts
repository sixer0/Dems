// Finding D50: the registrar mints a new microphone above every MIC id the registry TABLE holds,
// not only above those of the slice (a production Core keeps the seeded FAKE rows out of its slice).
import { describe, expect, it } from 'vitest';
import { bindInternalActions, type InternalActions } from '../../../../engine/internal-actions';
import { READ_TAKEN_MICROPHONE_IDS, SET_REGISTERED_MICROPHONE_COLUMNS, createEngineMicrophoneRegistrar } from '../registrar';

function bed(tableIds: readonly string[]) {
  const asked: unknown[] = [];
  const statements: string[] = [];
  const scope = {} as Parameters<typeof bindInternalActions>[0];
  bindInternalActions(scope, {
    async registerCaptureMicrophone(input: unknown) {
      asked.push(input);
      return { id: 'MIC-03' } as never;
    },
  } as unknown as InternalActions);
  const db = {
    async query(text: string) {
      statements.push(text);
      if (text === READ_TAKEN_MICROPHONE_IDS) return { rows: tableIds.map((id) => ({ id })), rowCount: tableIds.length };
      return { rows: [], rowCount: 1 };
    },
  };
  return { unit: { scope, db } as never, asked, statements };
}

describe('D50: a new microphone is minted above the ids of the registry table', () => {
  it('hands the MIC ids the table holds to the action, then sets the columns of the row the action named; CONTROL: an empty table hands an empty list', async () => {
    const h = bed(['MIC-01', 'MIC-02']);
    expect(await createEngineMicrophoneRegistrar().register(h.unit, { model: 'HANMUS BOMGE USB AUDIO', at: 1 })).toBe('MIC-03');
    expect(h.asked).toEqual([{ deviceId: null, model: 'HANMUS BOMGE USB AUDIO', takenIds: ['MIC-01', 'MIC-02'] }]);
    expect(h.statements).toEqual([READ_TAKEN_MICROPHONE_IDS, SET_REGISTERED_MICROPHONE_COLUMNS]);

    const empty = bed([]);
    await createEngineMicrophoneRegistrar().register(empty.unit, { model: 'X', at: 1 });
    expect(empty.asked).toEqual([{ deviceId: null, model: 'X', takenIds: [] }]);
  });
});

// Audit row M97 (D104, D116): a re-enabled microphone (operation 99) is back; a stated NOT_REACHABLE no longer holds.
// The card was only listed: the reach is CLEARED (not REACHABLE), in the same unit, through row 127's door.
describe('audit row M97: re-enable clears a stale NOT_REACHABLE', () => {
  function reenableBed(reach: 'REACHABLE' | 'NOT_REACHABLE' | undefined) {
    const noted: unknown[] = [];
    const statements: string[] = [];
    const scope = { pending: () => ({ captureDevices: { devices: [{ id: 'MIC-03', kind: 'MIC', ...(reach === undefined ? {} : { reach, checkedAt: 7 }) }] } }) } as unknown as Parameters<typeof bindInternalActions>[0];
    bindInternalActions(scope, {
      async registerCaptureMicrophone() {
        return { id: 'MIC-03' } as never;
      },
      async noteCaptureDeviceReach(reading: unknown) {
        noted.push(reading);
        return true;
      },
    } as unknown as InternalActions);
    const db = {
      async query(text: string) {
        statements.push(text);
        return { rows: [], rowCount: 1 };
      },
    };
    return { unit: { scope, db } as never, noted, statements };
  }

  it('NOT_REACHABLE -> one clear (reach null, checkedAt null) before the columns are set; CONTROL: REACHABLE or no reading -> nothing is noted', async () => {
    const stale = reenableBed('NOT_REACHABLE');
    await createEngineMicrophoneRegistrar().reenable(stale.unit, { deviceId: 'MIC-03', model: 'X', at: 1 });
    expect(stale.noted).toEqual([{ deviceId: 'MIC-03', reach: null, checkedAt: null }]);
    expect(stale.statements).toEqual([SET_REGISTERED_MICROPHONE_COLUMNS]);

    for (const reach of ['REACHABLE', undefined] as const) {
      const control = reenableBed(reach);
      await createEngineMicrophoneRegistrar().reenable(control.unit, { deviceId: 'MIC-03', model: 'X', at: 1 });
      expect(control.noted, String(reach)).toEqual([]);
    }
  });
});
