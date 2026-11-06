// Integration pass D10, item 5 (pass D6 item 6, client side): the transcript pane re-reads operations
// 84 and 86 when `transcript.revision` of the item in the replicated slice moves - a revision another
// operator appended. Held on the hook the pane mounts, with the app's own query keys and providers.
import { describe, expect, it } from '@jest/globals';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { transcriptQueryKey, transcriptRevisionsQueryKey, useTranscriptFollowsRevision } from './transcript';

const EV = 'EV-20261001-0014';
const OTHER = 'EV-20261001-0013';

function mounted(initial: { evidenceId: string; revision: number | null }) {
  const test = createTestSim();
  let client: QueryClient | null = null;
  const wrapper = ({ children }: { children: ReactNode }) => <RuntimeTestProviders sim={test.sim}>{children}</RuntimeTestProviders>;
  const hook = renderHook(
    (props: { evidenceId: string; revision: number | null }) => {
      const queryClient = useQueryClient();
      if (client === null) {
        client = queryClient;
        // The reads of the mount, as the pane's two queries hold them (Simulated mode: no Live source in this tree).
        for (const id of [EV, OTHER]) {
          queryClient.setQueryData(transcriptQueryKey(id, null), { revision: 0 });
          queryClient.setQueryData(transcriptRevisionsQueryKey(id, null), []);
        }
      }
      useTranscriptFollowsRevision(props.evidenceId, props.revision);
    },
    { wrapper, initialProps: initial },
  );
  const stale = (id: string): [boolean, boolean] => [client?.getQueryState(transcriptQueryKey(id, null))?.isInvalidated === true, client?.getQueryState(transcriptRevisionsQueryKey(id, null))?.isInvalidated === true];
  return { hook, stale };
}

describe('the pane follows transcript.revision of the slice item', () => {
  it("the head moves 1 -> 2: both reads of that item are fetched again, and only that item's", () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: 1 });
    // CONTROL: the first value asks nothing, and the same value again asks nothing.
    expect(stale(EV)).toEqual([false, false]);
    hook.rerender({ evidenceId: EV, revision: 1 });
    expect(stale(EV)).toEqual([false, false]);

    hook.rerender({ evidenceId: EV, revision: 2 });
    expect(stale(EV)).toEqual([true, true]);
    expect(stale(OTHER)).toEqual([false, false]);
  });

  it('an item that gains its summary (absent after a Core restart, then the next revision) is read again', () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: null });
    hook.rerender({ evidenceId: EV, revision: 3 });
    expect(stale(EV)).toEqual([true, true]);
  });

  it('CONTROL: another item with another head is not a moved head', () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: 1 });
    hook.rerender({ evidenceId: OTHER, revision: 4 });
    expect(stale(EV)).toEqual([false, false]);
    expect(stale(OTHER)).toEqual([false, false]);
  });
});
