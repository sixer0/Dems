// D55 (2026-11-03, the principal's ruling): the vendor `root` account must be able to search
// cameras on any bench whatever role it carries. CAPTURE_CONFIG therefore rides the IDENTITY,
// beside the seeded matrix and in the same direction as RB-9's identity rule (which narrows,
// this one grants). The matrix itself does not move: 22 grants, SUPERVISOR without CAPTURE_CONFIG
// since the 0034 revocation - a client supervisor gains nothing here.
import { describe, expect, it } from 'vitest';
import {
  DEMO_OPERATOR_PASSWORD,
  FACTORY_OPERATORS,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  createManualClock,
  createSim,
  effectivePermissions,
  isVendorRoot,
  operatorHas,
} from '../src/sim';

const AT = Date.UTC(2026, 9, 1, 3, 0, 0);
const DISCOVERY = '/api/v1/capture/discovery';

describe('D55: the vendor root holds CAPTURE_CONFIG by identity', () => {
  it('the helpers: grant for root alone, nothing else, the matrix unchanged', () => {
    const root = { username: 'root', role: OperatorRole.SUPERVISOR };
    expect(operatorHas(root, Permission.CAPTURE_CONFIG)).toBe(true);
    expect(operatorHas({ username: 'andi.pratama', role: OperatorRole.SUPERVISOR }, Permission.CAPTURE_CONFIG)).toBe(false);
    expect(operatorHas({ username: 'rina.wijaya', role: OperatorRole.TECHNICIAN }, Permission.CAPTURE_CONFIG)).toBe(true);
    expect(operatorHas(null, Permission.CAPTURE_CONFIG)).toBe(false);
    // The identity carries CAPTURE_CONFIG and NOTHING ELSE: no maintenance, no commissioning.
    expect(operatorHas(root, Permission.MAINTENANCE)).toBe(false);
    expect(operatorHas(root, Permission.CAPTURE_COMMISSION)).toBe(false);
    expect(operatorHas(root, Permission.USER_ADMIN)).toBe(true); // already the SUPERVISOR's - not the identity's doing
    // effectivePermissions: the role list plus the one extra, no duplicate when a future role holds it.
    const supervisor = [...ROLE_PERMISSIONS[OperatorRole.SUPERVISOR]];
    expect(effectivePermissions('root', supervisor)).toEqual([...supervisor, Permission.CAPTURE_CONFIG]);
    const held = [...supervisor, Permission.CAPTURE_CONFIG];
    expect(effectivePermissions('root', held)).toBe(held);
    expect(effectivePermissions('andi.pratama', supervisor)).toBe(supervisor);
    // The identity is the exact username, the RB-9 semantics: no case tricks.
    expect(isVendorRoot('root')).toBe(true);
    expect(isVendorRoot('Root')).toBe(false);
    expect(isVendorRoot(null)).toBe(false);
    // The seeded matrix did not move with the ruling.
    expect(ROLE_PERMISSIONS[OperatorRole.SUPERVISOR]).not.toContain(Permission.CAPTURE_CONFIG);
    const total = Object.values(ROLE_PERMISSIONS).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(22);
  });

  it('the live proof: root starts the camera search; the same-role supervisor is refused', () => {
    const sim = createSim({ clock: createManualClock(AT), storage: null, authStorage: null, scenario: 'idle', scheduler: () => () => {} });
    // The demonstration scenarios hold the three client operators; the vendor pair belongs to the
    // factory state. For the proof the root account joins the signed-in world as it does on the bench.
    sim.store.setState({ operators: [...sim.store.getState().operators, { ...FACTORY_OPERATORS[0]! }] });
    expect(sim.actions.signIn('root', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const searched = sim.request({ method: 'POST', path: DISCOVERY, body: {} });
    // 202 ACCEPTED: a search starts asynchronously (the contract of operation 93).
    expect(searched.status).toBe(202);
    expect((searched.body as { search: unknown }).search).not.toBeNull();
    sim.actions.signOut();
    expect(sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const refused = sim.request({ method: 'POST', path: DISCOVERY, body: {} });
    expect(refused.status).toBe(403);
    expect((refused.body as { error: { code: string } }).error.code).toBe('NOT_PERMITTED');
  });
});
