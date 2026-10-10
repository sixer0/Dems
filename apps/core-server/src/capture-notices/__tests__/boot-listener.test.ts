// Integration pass D8, item 2 (row 139's request, decision D156): the session-start listener of the
// notices unit is attached AT BOOT by the unit's own registration - not by the sessions module and
// not at a first use of `captureNotices(app)`.
//
// The real app factory, no database. Nothing in this file calls `captureNotices(app)`, runs a
// pre-check or starts a camera search: what listens after `ready()` was attached by the boot.
// The notice a listening unit raises from the events is proven on PostgreSQL by
// `session-start.db.test.ts`, whose rig no longer uses the unit before a start either.
import { afterEach, describe, expect, it } from 'vitest';
import { captureLog, createFakePool, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { sessionCapture, type SessionCaptureListener } from '../../capture-session';
import { registerCaptureNotices } from '../index';

type App = ReturnType<typeof buildApp>;
const apps: App[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

/** A fresh app whose capture-session unit counts who listens to it. Built, not ready. */
function fresh(): { app: App; listeners: SessionCaptureListener[] } {
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => createFakePool().pool, logStream: captureLog().stream });
  apps.push(app);
  const capture = sessionCapture(app);
  const listeners: SessionCaptureListener[] = [];
  const on = capture.on.bind(capture);
  capture.on = (listener) => {
    listeners.push(listener);
    return on(listener);
  };
  return { app, listeners };
}

describe('the session-start listener is attached at boot by the notices unit itself', () => {
  it('before ready() nobody listens; after ready() exactly ONE listener is attached, with no pre-check, no search and no use of captureNotices(app)', async () => {
    const { app, listeners } = fresh();
    expect(listeners).toHaveLength(0);
    await app.ready();
    expect(listeners).toHaveLength(1);
  });

  it('registered twice: still one hook and one listener', async () => {
    const { app, listeners } = fresh();
    registerCaptureNotices(app);
    await app.ready();
    expect(listeners).toHaveLength(1);
  });
});
