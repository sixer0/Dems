/**
 * Test-only helpers for kit popovers and menus (the pattern of step 77's dashboard suite; P6 keeps
 * each feature's test helpers in its own folder). Jest has no native layout: the kit Menu only
 * positions its content once its trigger is measured, and only makes it interactive after a layout
 * event, so tests stub the trigger's `measure` and emit layout events on the item's ancestors.
 */
import { expect, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

export function stubMeasure(testID: string): void {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  let stubbed = 0;
  while (node) {
    const instance = node.instance as { measure?: jest.Mock } | null;
    if (instance && typeof instance.measure === 'function' && 'mockImplementation' in instance.measure) {
      instance.measure.mockImplementation((...args: unknown[]) => {
        const callback = args[0] as (x: number, y: number, w: number, h: number, px: number, py: number) => void;
        callback(0, 0, 48, 48, 300, 120);
      });
      stubbed += 1;
    }
    node = node.parent;
  }
  expect(stubbed).toBeGreaterThan(0);
}

export function layoutAncestors(testID: string): void {
  let node: ReactTestInstance | null = screen.getByTestId(testID, { includeHiddenElements: true });
  while (node) {
    if (typeof node.props?.onLayout === 'function') {
      fireEvent(node, 'layout', { nativeEvent: { layout: { x: 16, y: 160, width: 240, height: 200 } } });
    }
    node = node.parent;
  }
}

/** Opens a kit Menu from its trigger and presses one of its items. */
export function pressMenuItem(triggerID: string, itemID: string): void {
  stubMeasure(triggerID);
  fireEvent.press(screen.getByTestId(triggerID));
  layoutAncestors(itemID);
  fireEvent.press(screen.getByTestId(itemID, { includeHiddenElements: true }));
}
