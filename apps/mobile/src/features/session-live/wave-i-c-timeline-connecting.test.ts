// Fix wave I, driver C - re-gate 75 NOTE G75b-08 (mobile half): the tablet timeline said "Recording
// Started" at the instant of the start command, while the screen still read "Connecting cameras…"
// (`t2_02_connecting.png`). The timeline rows are the Core's (`session.timeline`); the START row is
// written when the start is ACCEPTED. The client draws it only once the Core says the session is
// recording: the first durable fragment (`captureDurable: true`, `selectConnectingCameras` false).
// Written RED: the row was drawn while connecting.
import { describe, expect, it } from '@jest/globals';
import { timelineOfCaptureFacts } from './session-live.math';

const START = { id: 'T1', at: 1, kind: 'START', label: 'Recording Started', detail: null };
const SWITCH = { id: 'T2', at: 2, kind: 'AUDIO_SWITCH', label: 'Microphone Switched', detail: 'MIC 1 to MIC 2' };
const AUTOSAVE = { id: 'T3', at: 3, kind: 'AUTOSAVE', label: 'Evidence Auto-Save', detail: null };

describe('G75b-08: "Recording Started" is drawn only once the Core says recording', () => {
  it('connecting (RECORDING, no durable fragment yet): the START row is not drawn; other rows of the Core stay', () => {
    expect(timelineOfCaptureFacts([START], true, true)).toEqual([]);
    expect(timelineOfCaptureFacts([START, SWITCH], true, true)).toEqual([SWITCH]);
  });

  it('the first durable fragment arrived: the START row is drawn, with the Core\'s own instant', () => {
    expect(timelineOfCaptureFacts([START, SWITCH], true, false)).toEqual([START, SWITCH]);
  });

  it('CONTROL - simulated capture (no connecting state) keeps every row and the same array; the generator rows still leave a real recording', () => {
    const events = [START, AUTOSAVE];
    expect(timelineOfCaptureFacts(events, false)).toBe(events);
    expect(timelineOfCaptureFacts(events, false, false)).toBe(events);
    expect(timelineOfCaptureFacts(events, true, false)).toEqual([START]);
  });
});
