// Mobile Jest setup: masterplan/01_specs.md §8 (adjusted, M18-7) plus the 04_mobile_specs.md §10.1
// additions (step 67). Loaded through jest.config.js `setupFilesAfterEnv`.
import { jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';

// Reanimated 4.5 + Worklets 0.10: the native Worklets module cannot load in Jest, so it is replaced
// by the mock Worklets ships; the real Reanimated then runs its JS implementation, configured by its
// own setUpTests().
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

jest
  .requireActual<{ setUpTests: () => void }>('react-native-reanimated')
  .setUpTests();

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
