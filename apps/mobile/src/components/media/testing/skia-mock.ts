/**
 * Jest-only module mock for `@shopify/react-native-skia` (04_mobile_specs §10.1: Skia compositions
 * are mocked at module level; their maths are tested directly and rendering is proven on device).
 *
 * Usage in a test file:
 *   jest.mock('@shopify/react-native-skia', () =>
 *     jest.requireActual<typeof import('@/components/media/testing/skia-mock')>(
 *       '@/components/media/testing/skia-mock').createSkiaMock());
 *
 * Every drawing component renders its children (so nested Groups work) and records its latest
 * props in `__calls` by component name, so a test can read the shared values a composition wires.
 * `Canvas` is a plain host View. Helpers (`rect`, `rrect`, `vec`, `Skia.Path.Make()`) return inert
 * stand-ins.
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

type Props = Record<string, unknown> & { children?: ReactNode };
export type SkiaCalls = Map<string, Props[]>;

function pathStub(): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(target, {
    get: (_t, key) => {
      if (key === 'toSVGString') return () => '';
      if (key === 'copy' || key === 'build' || key === 'detach') return () => pathStub();
      if (key === 'getBounds') return () => ({ x: 0, y: 0, width: 0, height: 0 });
      return () => proxy;
    },
  });
  return proxy;
}

export function createSkiaMock(): Record<string, unknown> {
  const calls: SkiaCalls = new Map();
  const components = new Map<string, (props: Props) => ReactNode>();

  const record = (name: string, props: Props) => {
    const list = calls.get(name) ?? [];
    list.push(props);
    calls.set(name, list);
  };

  const component = (name: string) => {
    const existing = components.get(name);
    if (existing) return existing;
    const created =
      name === 'Canvas'
        ? ({ children, onSize: _onSize, ...rest }: Props) => {
            record(name, rest);
            return createElement(View, rest, children);
          }
        : ({ children, ...rest }: Props) => {
            record(name, rest);
            return createElement(Fragment, null, children ?? null);
          };
    Object.defineProperty(created, 'name', { value: `Mock${name}` });
    components.set(name, created);
    return created;
  };

  const helpers: Record<string, unknown> = {
    __esModule: true,
    __calls: calls,
    Skia: {
      Path: { Make: () => pathStub(), MakeFromSVGString: () => pathStub() },
      PathBuilder: { Make: () => pathStub() },
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      RRectXY: (r: unknown, rx: number, ry: number) => ({ rect: r, rx, ry }),
      Color: (c: unknown) => c,
      Point: (x: number, y: number) => ({ x, y }),
    },
    rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    rrect: (r: unknown, rx: number, ry: number) => ({ rect: r, rx, ry }),
    vec: (x = 0, y = 0) => ({ x, y }),
    point: (x = 0, y = 0) => ({ x, y }),
    useFont: () => null,
    useFonts: () => null,
    useImage: () => null,
    useSVG: () => null,
    matchFont: () => null,
    useCanvasRef: () => ({ current: null }),
    isFabric: true,
  };

  return new Proxy(helpers, {
    get: (target, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      if (/^[A-Z]/.test(key)) return component(key);
      return undefined;
    },
  });
}

/** Recorded props of every render of `name`, in render order since the last reset. */
export function skiaCalls(mockModule: unknown, name: string): Props[] {
  const calls = (mockModule as { __calls: SkiaCalls }).__calls;
  return calls.get(name) ?? [];
}

/** Forget recorded props (call in `beforeEach`). */
export function resetSkiaCalls(mockModule: unknown): void {
  (mockModule as { __calls: SkiaCalls }).__calls.clear();
}
