// Mobile Jest setup: masterplan/01_specs.md §8 (adjusted, M18-7) plus the 04_mobile_specs.md §10.1
// additions (step 67). Loaded through jest.config.js `setupFilesAfterEnv`.
import { afterEach, beforeEach, jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';

// Reanimated 4.5 + Worklets 0.10: the native Worklets module cannot load in Jest, so it is replaced
// by the mock Worklets ships; the real Reanimated then runs its JS implementation, configured by its
// own setUpTests().
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

jest
  .requireActual<{ setUpTests: () => void }>('react-native-reanimated')
  .setUpTests();

// Fix wave J (JM-01, `src/motion/testing/worklet-closure.ts`): a worklet that CALLS a function which is not a
// worklet throws on a device's UI runtime and stops every animation of the process; Jest runs both on one
// runtime and would never notice. So every worklet the suite hands to one of Reanimated's hooks is checked by
// what the Worklets Babel plugin wrote on it, and a test that mounted an offending worklet fails in `afterEach`
// with its name. The hooks themselves are Reanimated's own: the proxy only looks at their first arguments.
const mockWorkletViolations = new Set<string>();
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const closure = jest.requireActual<typeof import('./src/motion/testing/worklet-closure')>('./src/motion/testing/worklet-closure');
  const optional = (name: string): unknown => {
    try {
      return jest.requireActual(name);
    } catch {
      return null;
    }
  };
  // The libraries' own entry points are plain functions under their Jest mocks (and native, or worklets, on a
  // device): they are allowed by identity. They are taken from the module instances THIS test file's code gets
  // (`require` at the time of the check: a test may mock a library itself), and collected once per instance.
  const LIBRARIES = ['react-native-worklets', '@shopify/react-native-skia'];
  const collected = new Map<unknown, Set<unknown>>();
  const functionsOf = (module: unknown): Set<unknown> => {
    let found = collected.get(module);
    if (!found) {
      found = closure.exportedFunctionsOf(module);
      collected.set(module, found);
    }
    return found;
  };
  const allowedNow = (): Set<unknown> => {
    const allowed = new Set<unknown>(functionsOf(actual));
    for (const name of LIBRARIES) {
      let module: unknown = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require(name) as unknown;
      } catch {
        module = optional(name);
      }
      for (const entry of functionsOf(module)) allowed.add(entry);
    }
    return allowed;
  };
  const inspect = (hook: string, candidates: readonly unknown[]): void => {
    let allowed: Set<unknown> | null = null;
    for (const candidate of candidates) {
      // Cheap first: most worklets call nothing that is not a worklet, whatever is allowed.
      if (closure.nonWorkletCallees(candidate).length === 0) continue;
      allowed ??= allowedNow();
      for (const finding of closure.nonWorkletCallees(candidate, allowed)) mockWorkletViolations.add(`${hook}: ${finding}`);
    }
  };
  /** How many leading arguments of each hook are worklets. */
  const WORKLET_ARGUMENTS: Readonly<Record<string, number>> = {
    useAnimatedStyle: 1,
    useAnimatedProps: 1,
    useDerivedValue: 1,
    useAnimatedReaction: 2,
    useFrameCallback: 1,
    useAnimatedScrollHandler: 1,
  };
  const wrapped = new Map<string, unknown>();
  return new Proxy(actual, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof key !== 'string' || typeof value !== 'function' || !(key in WORKLET_ARGUMENTS)) return value;
      let hook = wrapped.get(key);
      if (!hook) {
        const original = value as (...args: unknown[]) => unknown;
        hook = (...args: unknown[]) => {
          inspect(key, args.slice(0, WORKLET_ARGUMENTS[key]));
          return original(...args);
        };
        wrapped.set(key, hook);
      }
      return hook;
    },
  });
});

afterEach(() => {
  if (mockWorkletViolations.size === 0) return;
  const findings = [...mockWorkletViolations];
  mockWorkletViolations.clear();
  throw new Error(
    `A worklet calls a function that is not a worklet (it throws on a device's UI runtime; add the 'worklet' directive to the callee or inline it): ${findings.join('; ')}`,
  );
});

// §10.1: AsyncStorage 2.2.0 through the in-memory mock the package ships (VM-16).
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// §2.6 keyboard handling: react-native-keyboard-controller ships its own Jest mock. Without it any
// test that renders KeyboardProvider or KeyboardAvoidingView would hit the missing native module.
jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual('react-native-keyboard-controller/jest'),
);

// §10.1: explicit expo-local-authentication mock. The default is "hardware present, fingerprint
// enrolled, authentication succeeds". Tests override single calls, for example:
//   jest.mocked(LocalAuthentication.authenticateAsync)
//     .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
jest.mock('expo-local-authentication', () => {
  const types = jest.requireActual<{
    AuthenticationType: { FINGERPRINT: number };
    SecurityLevel: { BIOMETRIC_WEAK: number };
  }>('expo-local-authentication/build/LocalAuthentication.types');
  return {
    __esModule: true,
    ...types,
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    supportedAuthenticationTypesAsync: jest.fn(async () => [types.AuthenticationType.FINGERPRINT]),
    getEnrolledLevelAsync: jest.fn(async () => types.SecurityLevel.BIOMETRIC_WEAK),
    authenticateAsync: jest.fn(async () => ({ success: true })),
    cancelAuthenticate: jest.fn(async () => undefined),
  };
});

// §10.1: explicit expo-haptics mock (T-M14 asserts on these calls). The enums are the real ones.
jest.mock('expo-haptics', () => {
  const types = jest.requireActual<Record<string, unknown>>('expo-haptics/src/Haptics.types');
  return {
    __esModule: true,
    ...types,
    notificationAsync: jest.fn(async () => undefined),
    impactAsync: jest.fn(async () => undefined),
    selectionAsync: jest.fn(async () => undefined),
    performAndroidHapticsAsync: jest.fn(async () => undefined),
  };
});

// D58 (step 72): expo-video's native module cannot load in Jest, and CameraFeed imports it for
// every consumer. The mock keeps the public API: `useVideoPlayer` returns one player per source
// (muted/loop/status fields, play/pause as jest.fn, statusChange listeners), and `VideoView` is a
// host View that receives its props, so a test can read `props.player` and drive
// `player.emit('statusChange', { status: 'error', error: { message } })`.
type MockVideoStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';
type MockVideoEvent = { status?: MockVideoStatus; error?: { message: string } };
type MockListener = (event: MockVideoEvent) => void;

jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  class MockVideoPlayer {
    source: unknown;
    muted = false;
    loop = false;
    playing = false;
    status: MockVideoStatus = 'readyToPlay';
    currentTime = 0;
    volume = 1;
    private readonly listeners = new Map<string, Set<MockListener>>();
    constructor(source: unknown) {
      this.source = source;
    }
    play = jest.fn(() => {
      this.playing = true;
    });
    pause = jest.fn(() => {
      this.playing = false;
    });
    replace = jest.fn((next: unknown) => {
      this.source = next;
    });
    replaceAsync = jest.fn(async (next: unknown) => {
      this.source = next;
    });
    release = jest.fn();
    addListener(event: string, listener: MockListener) {
      const set = this.listeners.get(event) ?? new Set<MockListener>();
      set.add(listener);
      this.listeners.set(event, set);
      return { remove: () => set.delete(listener) };
    }
    emit(event: string, payload: MockVideoEvent) {
      if (event === 'statusChange' && payload.status) this.status = payload.status;
      this.listeners.get(event)?.forEach((listener) => listener(payload));
    }
  }

  const createVideoPlayer = (source: unknown) => new MockVideoPlayer(source);
  const useVideoPlayer = (source: unknown, setup?: (player: MockVideoPlayer) => void) => {
    const sourceKey = JSON.stringify(source);
    const create = () => {
      const player = new MockVideoPlayer(source);
      setup?.(player);
      return player;
    };
    // One player per source, as the real hook (keyed by the parsed source).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return React.useMemo(create, [sourceKey]);
  };
  const VideoView = (props: Record<string, unknown>) => React.createElement(View, props);

  return {
    __esModule: true,
    createVideoPlayer,
    useVideoPlayer,
    VideoView,
    VideoAirPlayButton: () => null,
    isPictureInPictureSupported: () => false,
    clearVideoCacheAsync: async () => undefined,
    setVideoCacheSizeAsync: async () => undefined,
    getCurrentVideoCacheSize: () => 0,
  };
});

// Backend task W15 (04_client_integration_spec TS-16): expo-secure-store as an in-memory map, with
// switches for what a PROTECTED operation does, and expo-device with a switchable `isDevice`.
// A test reaches the switches through two globals, so that no file under `src/` has to name the
// secure-store package (MP-1: the wrapper `src/runtime/secure-credentials.ts` is its only importer):
//
//   __DEMS_SECURE_STORE_MOCK__.protectedRead = 'fail';        // 'prompt' (default) | 'pass' | 'fail'
//   __DEMS_SECURE_STORE_MOCK__.protectedWrite = 'fail';       // the same three
//   __DEMS_SECURE_STORE_MOCK__.failure = 'user-canceled';     // what a failing protected operation reports
//   __DEMS_SECURE_STORE_MOCK__.failNext('write');             // the next write fails, protected or not
//   __DEMS_SECURE_STORE_MOCK__.prompts                        // one entry per OS prompt "shown"
//   __DEMS_DEVICE_MOCK__.isDevice = true;                     // default false, as on an emulator
//
// 'prompt' records a prompt and then succeeds (a device with an enrolled fingerprint: Android asks
// at every protected read AND write); 'pass' succeeds without one; 'fail' rejects like the native
// module (`code: 'ERR_AUTHENTICATION'`), before anything is stored. Both are reset before each test.
type MockProtectedMode = 'prompt' | 'pass' | 'fail';
type MockProtectedFailure = 'not-enrolled' | 'no-hardware' | 'user-canceled' | 'lockout';
type MockStoreOperation = 'read' | 'write' | 'delete';
interface MockStoreOptions {
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
}

export interface SecureStoreMockControl {
  protectedRead: MockProtectedMode;
  protectedWrite: MockProtectedMode;
  failure: MockProtectedFailure;
  /** What `canUseBiometricAuthentication()` answers. */
  canUseBiometricAuthentication: boolean;
  /** The OS prompts "shown", in order. */
  readonly prompts: { operation: 'read' | 'write'; key: string; title: string }[];
  /** Makes the next `count` operations of that kind reject with a non-authentication error. */
  failNext(operation: MockStoreOperation, count?: number): void;
  /** Puts an item into the map without going through the module (for example a corrupt one). */
  seed(key: string, value: string, protectedItem?: boolean): void;
  has(key: string): boolean;
  /** Whether the stored item carries the authentication requirement; `null` when it is absent. */
  isProtected(key: string): boolean | null;
  /** The stored text; `null` when the item is absent. For assertions on shape only. */
  peek(key: string): string | null;
  keys(): string[];
  reset(): void;
}

export interface DeviceMockControl {
  isDevice: boolean;
  platformApiLevel: number | null;
  reset(): void;
}

declare global {
  var __DEMS_SECURE_STORE_MOCK__: SecureStoreMockControl;
  var __DEMS_DEVICE_MOCK__: DeviceMockControl;
}

const MOCK_FAILURE_TEXT: Record<MockProtectedFailure, string> = {
  'not-enrolled': 'Could not Authenticate the user: No biometrics are currently enrolled',
  'no-hardware':
    'Could not Authenticate the user: No hardware available for biometric authentication. Use expo-local-authentication to check if the device supports it',
  'user-canceled': 'Could not Authenticate the user: User canceled the authentication',
  lockout: 'Could not Authenticate the user: Lockout',
};

const mockSecureItems = new Map<string, { value: string; protectedItem: boolean }>();
const mockSecureFailNext: Record<MockStoreOperation, number> = { read: 0, write: 0, delete: 0 };

const mockSecureStore: SecureStoreMockControl = {
  protectedRead: 'prompt',
  protectedWrite: 'prompt',
  failure: 'not-enrolled',
  canUseBiometricAuthentication: true,
  prompts: [],
  failNext(operation, count = 1) {
    mockSecureFailNext[operation] = count;
  },
  seed(key, value, protectedItem = false) {
    mockSecureItems.set(key, { value, protectedItem });
  },
  has: (key) => mockSecureItems.has(key),
  isProtected: (key) => mockSecureItems.get(key)?.protectedItem ?? null,
  peek: (key) => mockSecureItems.get(key)?.value ?? null,
  keys: () => [...mockSecureItems.keys()].sort(),
  reset() {
    mockSecureItems.clear();
    mockSecureStore.prompts.length = 0;
    mockSecureStore.protectedRead = 'prompt';
    mockSecureStore.protectedWrite = 'prompt';
    mockSecureStore.failure = 'not-enrolled';
    mockSecureStore.canUseBiometricAuthentication = true;
    mockSecureFailNext.read = 0;
    mockSecureFailNext.write = 0;
    mockSecureFailNext.delete = 0;
  },
};

const mockDevice: DeviceMockControl = {
  isDevice: false,
  platformApiLevel: 36,
  reset() {
    mockDevice.isDevice = false;
    mockDevice.platformApiLevel = 36;
  },
};

globalThis.__DEMS_SECURE_STORE_MOCK__ = mockSecureStore;
globalThis.__DEMS_DEVICE_MOCK__ = mockDevice;

beforeEach(() => {
  mockSecureStore.reset();
  mockDevice.reset();
});

jest.mock('expo-secure-store', () => {
  const coded = (message: string, code: string) => Object.assign(new Error(message), { code });
  /** The native module's own failure of an operation that is not about authentication. */
  const failIfAsked = (operation: MockStoreOperation, key: string) => {
    if (mockSecureFailNext[operation] <= 0) return;
    mockSecureFailNext[operation] -= 1;
    const [text, code] =
      operation === 'read'
        ? [`Could not decrypt the value for key '${key}' under keychain 'key_v1'. Caused by: unknown`, 'ERR_DECRYPT']
        : operation === 'write'
          ? [`An error occurred when writing to key: '${key}' under keychain: 'key_v1'. Caused by: unknown`, 'ERR_WRITE']
          : [`Could not delete the value for key '${key}' under keychain 'key_v1'. Caused by: unknown`, 'ERR_DELETE'];
    throw coded(text, code);
  };
  /** A protected operation: fails, or "shows" the OS prompt, or passes without one. */
  const authenticate = (mode: MockProtectedMode, operation: 'read' | 'write', key: string, options?: MockStoreOptions) => {
    if (mode === 'fail') throw coded(MOCK_FAILURE_TEXT[mockSecureStore.failure], 'ERR_AUTHENTICATION');
    if (mode === 'prompt') mockSecureStore.prompts.push({ operation, key, title: options?.authenticationPrompt ?? '' });
  };
  const validKey = (key: string) => {
    if (typeof key !== 'string' || !/^[\w.-]+$/.test(key)) {
      throw new Error('Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".');
    }
  };
  const set = (key: string, value: string, options?: MockStoreOptions) => {
    validKey(key);
    if (typeof value !== 'string') throw new Error('Invalid value provided to SecureStore. Values must be strings');
    failIfAsked('write', key);
    const protectedItem = options?.requireAuthentication === true;
    if (protectedItem) authenticate(mockSecureStore.protectedWrite, 'write', key, options);
    mockSecureItems.set(key, { value, protectedItem });
  };
  const get = (key: string, options?: MockStoreOptions) => {
    validKey(key);
    failIfAsked('read', key);
    const item = mockSecureItems.get(key);
    if (!item) return null;
    // As on Android: the stored item, not the caller's option, says whether the OS check runs.
    if (item.protectedItem) authenticate(mockSecureStore.protectedRead, 'read', key, options);
    return item.value;
  };
  return {
    __esModule: true,
    AFTER_FIRST_UNLOCK: 0,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    ALWAYS: 2,
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
    ALWAYS_THIS_DEVICE_ONLY: 4,
    WHEN_UNLOCKED: 5,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    isAvailableAsync: jest.fn(async () => true),
    canUseBiometricAuthentication: jest.fn(() => mockSecureStore.canUseBiometricAuthentication),
    setItemAsync: jest.fn(async (key: string, value: string, options?: MockStoreOptions) => set(key, value, options)),
    getItemAsync: jest.fn(async (key: string, options?: MockStoreOptions) => get(key, options)),
    deleteItemAsync: jest.fn(async (key: string) => {
      validKey(key);
      failIfAsked('delete', key);
      mockSecureItems.delete(key);
    }),
    setItem: jest.fn((key: string, value: string, options?: MockStoreOptions) => set(key, value, options)),
    getItem: jest.fn((key: string, options?: MockStoreOptions) => get(key, options)),
  };
});

// jest-expo mocks the native module of expo-device with `isDevice: false`; this adds the switch.
// Every other export is the package's own.
jest.mock('expo-device', () => {
  const actual = jest.requireActual<Record<string, unknown>>('expo-device');
  const mocked: Record<string, unknown> = { __esModule: true };
  for (const name of Object.keys(actual)) {
    if (name !== 'isDevice' && name !== 'platformApiLevel') mocked[name] = actual[name];
  }
  Object.defineProperty(mocked, 'isDevice', { enumerable: true, get: () => mockDevice.isDevice });
  Object.defineProperty(mocked, 'platformApiLevel', { enumerable: true, get: () => mockDevice.platformApiLevel });
  return mocked;
});
