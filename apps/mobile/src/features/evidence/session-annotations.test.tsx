// Fix wave J round two (JT-11 / JA2-08; contract J2-S 1): the markers and notes the item carries. A new module.
import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE } from '@dems/shared/api';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { usePlaybackSeekRequests } from './playback-link';
import { SessionAnnotations, annotationsOf } from './session-annotations';

afterEach(() => resetMissingKeys());

const RECORDED_AT = EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers[0].at - 42_000;
const ITEM = { id: 'EV-20991231-0001', ...EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE };

function mount(item: unknown) {
  const test = createTestSim();
  return render(
    <RuntimeTestProviders sim={test.sim}>
      <SessionAnnotations item={item} recordedAt={RECORDED_AT} />
    </RuntimeTestProviders>,
  );
}

describe('annotationsOf', () => {
  it('reads the contract\'s example by name; anything else is no annotation', () => {
    expect(annotationsOf(ITEM).markers).toHaveLength(1);
    expect(annotationsOf(ITEM).notes.map((note) => note.origin)).toEqual(['SESSION_FORM', undefined]);
    expect(annotationsOf({ markers: 'x', notes: [{ id: 1 }] })).toEqual({ markers: [], notes: [] });
    expect(annotationsOf(null)).toEqual({ markers: [], notes: [] });
  });
});

describe('SessionAnnotations', () => {
  it('the example, fed unmodified: the marker with its label, the form\'s note titled as that without a time, the written note', () => {
    mount(ITEM);
    expect(screen.getByTestId('evidence-marker-1')).toHaveTextContent(/Marker 1: Key statement/);
    expect(screen.getByTestId('evidence-note-form')).toHaveTextContent('Note from the session form: Second interview; counsel present.');
    expect(screen.getByTestId('evidence-note-NOTE-000413')).toHaveTextContent(/Note: Subject asked for a break\./);
    // No "snapshot" is offered: a snapshot has no member and no picture.
    expect(screen.queryByText(/snapshot/i)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('a marker\'s time takes the playback there (media position = its instant minus the start of the recording)', () => {
    const seeks: number[] = [];
    renderHook(() => usePlaybackSeekRequests(ITEM.id, (ms) => seeks.push(ms)));
    mount(ITEM);
    fireEvent.press(screen.getByTestId('evidence-marker-1-seek'));
    expect(seeks).toEqual([42_000]);
  });

  it('CONTROL - an item that states no marker and no note draws nothing', () => {
    mount({ id: 'EV-20991231-0002', markers: [], notes: [] });
    expect(screen.queryByTestId('evidence-annotations')).toBeNull();
  });
});
