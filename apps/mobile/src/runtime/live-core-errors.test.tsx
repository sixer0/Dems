// Backend task W51: the refusal presenter (04_client_integration_spec §6.2, §8.1 LB-5 to LB-10;
// the Live source's brief list, row 20). What a rejected Core action reads as on the tablet.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { CoreRefusalError, LiveTransportError } from '@dems/shared/live';
import { Permission, SimNotFoundError, SimPermissionError, SimTransitionError } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { haptics } from '@/motion/haptics';
import {
  CORE_ERROR_COALESCE_MS,
  createCoreErrorCoalescer,
  describeCoreError,
  requiredRoleFor,
  resetCoreErrorPresenterForTests,
  useCoreErrorPresenter,
  type CoreErrorOutcome,
  type CoreErrorPresentation,
} from './core-errors';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};

const text = (entry: CoreErrorPresentation['label'], extra: Record<string, string | number> = {}): string | null =>
  entry === null ? null : i18n.t(entry.key, { ...entry.values, ...extra });

beforeEach(() => {
  resetCoreErrorPresenterForTests();
  resetMissingKeys();
  haptics.reset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

describe('a limit is not an outage (LB-10)', () => {
  it('a 429 is worded as a limit, with the seconds of `retry-after`', () => {
    const shown = describeCoreError(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42, requestId: 'req-000022' }));
    expect(shown).toMatchObject({ kind: 'LIMIT', variant: 'warning', retryAfterSeconds: 42, outage: false, coalesced: true });
    expect(text(shown!.label)).toBe('The Core server is limiting requests from this tablet');
    expect(text(shown!.description)).toBe('Try again in 42 s.');
  });

  it.each([
    [0.2, 'Try again in 1 s.'],
    [59.01, 'Try again in 60 s.'],
    [1, 'Try again in 1 s.'],
  ])('`retry-after` %s is shown in whole seconds, rounded up: "%s"', (seconds, sentence) => {
    const shown = describeCoreError(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: seconds }));
    expect(text(shown!.description)).toBe(sentence);
  });

  it.each([null, 0, -3, Number.NaN, Number.POSITIVE_INFINITY])('without a usable `retry-after` (%s) it still reads as a limit, with no number', (seconds) => {
    const shown = describeCoreError(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: seconds }));
    expect(shown).toMatchObject({ kind: 'LIMIT', retryAfterSeconds: null, outage: false });
    expect(text(shown!.description)).toBe('Try again in a moment.');
  });

  it('the status decides, whatever the reason and the code say: a 429 never gets the offline wording', () => {
    for (const error of [
      new LiveTransportError('CORE_OFFLINE', { status: 429, retryAfterSeconds: 5 }),
      new LiveTransportError('UNAVAILABLE', { status: 429 }),
      new LiveTransportError('UNAVAILABLE', { status: null, code: 'RATE_LIMITED', retryAfterSeconds: 5 }),
    ]) {
      const shown = describeCoreError(error);
      expect(shown).toMatchObject({ kind: 'LIMIT', outage: false, variant: 'warning' });
      expect(text(shown!.label)).not.toContain('unreachable');
    }
  });
});

describe('no answer from the Core server (LB-6, LB-7)', () => {
  it('a command that was not sent, or got no answer: "Core server unreachable. Nothing was changed."', () => {
    for (const error of [
      new LiveTransportError('CORE_OFFLINE'),
      new LiveTransportError('CORE_OFFLINE', { code: 'NETWORK' }),
      new LiveTransportError('CORE_OFFLINE', { status: 503, code: 'NOT_READY' }),
    ]) {
      const shown = describeCoreError(error);
      expect(shown).toMatchObject({ kind: 'OFFLINE', variant: 'danger', outage: true, coalesced: true });
      expect(text(shown!.label)).toBe('Core server unreachable');
      expect(text(shown!.description)).toBe('Nothing was changed.');
    }
  });

  it('a time-out: the command may have been applied, and the text says so', () => {
    const shown = describeCoreError(new LiveTransportError('CORE_OFFLINE', { code: 'TIMEOUT' }));
    expect(shown).toMatchObject({ kind: 'TIMEOUT', outage: true, coalesced: true });
    expect(text(shown!.label)).toBe('Core server unreachable');
    expect(text(shown!.description)).toBe('The command may or may not have been applied; the screen updates when the Core is reachable.');
  });

  it('the four codes of the Live source and the typed client (brief row 20)', () => {
    const snapshot = describeCoreError(new LiveTransportError('CORE_OFFLINE', { code: 'SNAPSHOT_TIMEOUT' }));
    expect(snapshot).toMatchObject({ kind: 'SNAPSHOT_TIMEOUT', outage: true });
    expect(text(snapshot!.description)).toBe('The Core did not send its data in time. Try again.');

    for (const code of ['CREDENTIALS_UNAVAILABLE', 'CREDENTIALS_TIMEOUT']) {
      const credentials = describeCoreError(new LiveTransportError('CORE_OFFLINE', { code }));
      // Nothing was sent: it is not the Core that is unreachable.
      expect(credentials).toMatchObject({ kind: 'CREDENTIALS', outage: false, variant: 'danger' });
      expect(text(credentials!.label)).toBe('This tablet could not read its credential');
      expect(text(credentials!.description)).toBe('Nothing was sent. Try again.');
    }

    // The screen that sent the command is gone: nothing is shown.
    expect(describeCoreError(new LiveTransportError('CORE_OFFLINE', { code: 'STOPPED' }))).toMatchObject({ kind: 'STOPPED', label: null, description: null, outage: false });
  });

  it('an answer the Core could not give (500, a contract violation) is neither an outage nor a limit', () => {
    for (const error of [new LiveTransportError('UNAVAILABLE', { status: 500, code: 'INTERNAL' }), new LiveTransportError('UNAVAILABLE', { status: 200, code: 'CONTRACT_VIOLATION' })]) {
      const shown = describeCoreError(error);
      expect(shown).toMatchObject({ kind: 'FAILED', variant: 'danger', outage: false, coalesced: true });
      expect(text(shown!.label)).toBe('The Core server could not complete the request');
    }
  });
});

describe('a refusal of the Core (§6.2, LB-5)', () => {
  it('403: the denied toast names the first role that holds the permission', () => {
    const shown = describeCoreError(new SimPermissionError('exportEvidence', Permission.EVIDENCE_EXPORT));
    expect(shown).toMatchObject({ kind: 'DENIED', variant: 'danger', role: 'SUPERVISOR', coalesced: false, outage: false });
    expect(text(shown!.label)).toBe('Not permitted');
    expect(text(shown!.description, { role: i18n.t('common.roles.SUPERVISOR') })).toBe('Requires the Supervisor role');
  });

  it('the role of a permission, as the web console orders the roles; an any-of rule takes the first holder of any', () => {
    expect(requiredRoleFor(Permission.SESSION_START)).toBe('INVESTIGATOR');
    expect(requiredRoleFor(Permission.EVIDENCE_EXPORT)).toBe('SUPERVISOR');
    expect(requiredRoleFor(Permission.USER_ADMIN)).toBe('SUPERVISOR');
    expect(requiredRoleFor(Permission.DEVICE_MANAGE)).toBe('TECHNICIAN');
    expect(requiredRoleFor(`${Permission.DEVICE_MANAGE} | ${Permission.EVIDENCE_REVIEW}`)).toBe('SUPERVISOR');
    expect(requiredRoleFor(`${Permission.MAINTENANCE} | ${Permission.DEVICE_MANAGE}`)).toBe('TECHNICIAN');
    expect(requiredRoleFor('')).toBeNull();
    expect(requiredRoleFor('NO_SUCH_PERMISSION')).toBeNull();
    // A permission no role holds: the toast has its title and no role sentence.
    expect(describeCoreError(new SimPermissionError('x', 'NO_SUCH_PERMISSION'))).toMatchObject({ kind: 'DENIED', role: null, description: null });
  });

  it('401: the operator is signed out', () => {
    const shown = describeCoreError(new SimPermissionError('archiveEvidence', Permission.EVIDENCE_REVIEW, 'NOT_SIGNED_IN'));
    expect(shown).toMatchObject({ kind: 'SIGNED_OUT', variant: 'warning', coalesced: true });
    expect(text(shown!.label)).toBe('You are signed out');
  });

  it('`NOT_AVAILABLE`, and the envelope codes without a simulator class', () => {
    expect(text(describeCoreError(new CoreRefusalError('NOT_AVAILABLE'))!.label)).toBe('Not available right now');
    expect(describeCoreError(new CoreRefusalError('NOT_AVAILABLE'))).toMatchObject({ kind: 'NOT_AVAILABLE', variant: 'warning' });
    expect(text(describeCoreError(new CoreRefusalError('DEMO_DISABLED', { status: 403 }))!.label)).toBe('Demo controls are turned off on the Core server');
    // D118: `DEVICE_NOT_PAIRED` is also the answer to "this operation wants the device credential"
    // (`details.reason: 'DEVICE_CREDENTIAL_REQUIRED'`). It reads as an ordinary refused action and
    // never as "this tablet is not paired".
    for (const code of ['DEVICE_NOT_PAIRED', 'LAST_ADMIN', 'ORIGIN_NOT_ALLOWED', 'toString', '__proto__', 'constructor']) {
      const shown = describeCoreError(new CoreRefusalError(code, { status: 409 }));
      expect(shown).toMatchObject({ kind: 'REFUSED', variant: 'danger' });
      expect(text(shown!.label)).toBe('The Core refused this action');
      expect(shown!.description).toBeNull();
      expect(JSON.stringify(shown)).not.toMatch(/pair/i);
    }
  });

  it('every other error is the call site\'s own: its existing branch stays (LB-5)', () => {
    for (const error of [new SimTransitionError('RECORDING', 'createSession'), new SimNotFoundError('evidence', 'EV-1'), new Error('boom'), 'text', null, undefined, { code: 'NOT_PERMITTED' }]) {
      expect(describeCoreError(error)).toBeNull();
    }
  });

  it('a presentation holds keys and numbers only: nothing of the error\'s own text', () => {
    const marker = 'MARKER-TEXT-51';
    const error = Object.assign(new LiveTransportError('UNAVAILABLE', { status: 429, retryAfterSeconds: 3, requestId: marker }), { message: marker });
    expect(JSON.stringify(describeCoreError(error))).not.toContain(marker);
    const refusal = Object.assign(new CoreRefusalError(marker), { message: marker });
    expect(JSON.stringify(describeCoreError(refusal))).not.toContain(marker);
  });
});

describe('one toast in three seconds (LB-6)', () => {
  it('the coalescer admits a kind once per window, each kind on its own', () => {
    let now = 10_000;
    const coalescer = createCoreErrorCoalescer(() => now);
    expect(coalescer.admit('OFFLINE')).toBe(true);
    expect(coalescer.admit('OFFLINE')).toBe(false);
    expect(coalescer.admit('LIMIT')).toBe(true);
    now += CORE_ERROR_COALESCE_MS - 1;
    expect(coalescer.admit('OFFLINE')).toBe(false);
    now += 1;
    expect(coalescer.admit('OFFLINE')).toBe(true);
    expect(coalescer.admit('OFFLINE')).toBe(false);
    // A clock that went back does not silence the next toast for ever.
    now = 0;
    expect(coalescer.admit('OFFLINE')).toBe(true);
    coalescer.reset();
    expect(coalescer.admit('OFFLINE')).toBe(true);
    expect(CORE_ERROR_COALESCE_MS).toBe(3_000);
  });
});

describe('the presenter as a hook', () => {
  const outcomes: CoreErrorOutcome[] = [];
  const handled: boolean[] = [];

  function Harness({ errors }: { errors: readonly unknown[] }) {
    const present = useCoreErrorPresenter();
    const [next, setNext] = useState(0);
    return (
      <Pressable
        testID="fail"
        onPress={() => {
          const error = errors[next % errors.length];
          outcomes.push(present.present(error));
          setNext(next + 1);
        }}
      >
        <Text testID="plain" onPress={() => handled.push(present(errors[0]))}>
          plain
        </Text>
      </Pressable>
    );
  }

  function mount(errors: readonly unknown[]) {
    outcomes.length = 0;
    handled.length = 0;
    return render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <I18nextProvider i18n={i18n}>
          <HeroUINativeProvider>
            <Harness errors={errors} />
          </HeroUINativeProvider>
        </I18nextProvider>
      </SafeAreaProvider>,
    );
  }
  const press = () => act(() => fireEvent.press(screen.getByTestId('fail')));

  it('a denial is shown every time, with the role and the error haptic', () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    mount([new SimPermissionError('archiveEvidence', Permission.EVIDENCE_REVIEW)]);
    press();
    press();
    expect(outcomes).toEqual(['shown', 'shown']);
    expect(screen.getAllByText('Not permitted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requires the Supervisor role').length).toBeGreaterThan(0);
    expect(trigger).toHaveBeenCalledWith('gateBlock');
  });

  it('five refusals on a dead link are 1 toast (the trigger called once); after the window the next one shows again', () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    const trigger = jest.spyOn(haptics, 'trigger');
    mount([new LiveTransportError('CORE_OFFLINE')]);
    for (let n = 0; n < 5; n += 1) press();
    expect(outcomes).toEqual(['shown', 'coalesced', 'coalesced', 'coalesced', 'coalesced']);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('coreLinkLost');
    act(() => {
      jest.advanceTimersByTime(CORE_ERROR_COALESCE_MS);
    });
    press();
    expect(outcomes[5]).toBe('shown');
  });

  it('a limit shortly after an outage still shows: the kinds are counted apart', () => {
    mount([new LiveTransportError('CORE_OFFLINE'), new LiveTransportError('UNAVAILABLE', { status: 429, retryAfterSeconds: 12 })]);
    press();
    press();
    expect(outcomes).toEqual(['shown', 'shown']);
    expect(screen.getAllByText('Try again in 12 s.').length).toBeGreaterThan(0);
  });

  it('`STOPPED` is handled and silent; an error that is not the presenter\'s is handed back', () => {
    mount([new LiveTransportError('CORE_OFFLINE', { code: 'STOPPED' }), new SimTransitionError('RECORDING', 'createSession')]);
    press();
    press();
    expect(outcomes).toEqual(['silent', 'unhandled']);
    expect(screen.queryByText('Core server unreachable')).toBeNull();
    // Called as a function: true means "the call site shows nothing more".
    act(() => fireEvent.press(screen.getByTestId('plain')));
    expect(handled).toEqual([true]);
  });
});
