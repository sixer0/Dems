/**
 * THE RULE OF A TYPED ADDRESS, AS THIS MODULE HOLDS IT (task 4 blueprint row 96, WP-12; contract
 * of row 94; amended ruling AM-3 of D80(10); security finding S13-11; decision C10).
 *
 * Operation 93 may carry ONE address the technician typed. Before anything is built for it the
 * address is held to the ONE destination rule of the Core (`capture/destination-rule.ts`,
 * `decideDestination` with the purpose of a typed probe). That file lies inside the closed capture
 * unit and needs the facts of the host (the camera interface, its subnet, the host's own
 * addresses), so the rule reaches this module the way the stored-address rule reaches the
 * credential reader: AS A FUNCTION HANDED IN (`provideRule`), bound to those facts by the
 * composition.
 *
 * UNTIL A RULE IS HANDED IN, EVERY TYPED ADDRESS IS REFUSED. This file holds no rule of its own,
 * no range, no list and no permissive value: a Core whose camera interface is not known cannot
 * say that an address lies on it, and the rule itself refuses everything on facts it cannot read.
 *
 * What a decision is: `allowed` with THE RULE'S OWN ANSWER (the address rebuilt from its numbers,
 * the port, the source to send from), which goes to the search as it came; or a refusal, whose
 * code word stays inside the Core - the caller reads one fixed sentence and one reason whatever
 * the rule refused.
 */
import type { TypedAddressDecision } from './search';

/** The destination rule for a typed address: `decideDestination` of the capture unit, bound to the host's facts. */
export type TypedAddressRule = (address: string) => TypedAddressDecision;

export interface TypedAddressControl {
  /**
   * Hands in the rule. Once per app: a second rule is refused, so that a later caller cannot put a
   * wider one in the place of the product's.
   */
  provideRule(rule: TypedAddressRule): void;
  /** True when a rule was handed in. */
  ruled(): boolean;
  /** The rule's answer for one address of the contract's form; a refusal when no rule was handed in, when the rule throws, or when its answer is not of its shape. */
  decide(address: string): TypedAddressDecision;
}

/** The refusal of a Core that was handed no rule: the destination rule's own word for facts it does not have. */
export const TYPED_ADDRESS_NOT_CONFIGURED = 'NOT_CONFIGURED';
/** The refusal of a rule that threw or answered something that is no decision. */
export const TYPED_ADDRESS_RULE_FAILED = 'RULE_FAILED';

const REFUSAL_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `captureDiscoveryControl(app)` idiom).
const controls = new WeakMap<object, TypedAddressControl>();

/** The typed-address rule of an app. Made at the first call, by the module's routes or by the composition, whichever comes first. */
export function typedAddressControl(app: { readonly stages: object }): TypedAddressControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let provided: TypedAddressRule | null = null;
  const refused = (refusal: string): TypedAddressDecision => Object.freeze({ allowed: false, refusal });
  const control: TypedAddressControl = Object.freeze({
    provideRule(rule: TypedAddressRule): void {
      if (provided !== null) throw new Error('the typed-address rule of this Core was handed in already');
      provided = rule;
    },
    ruled: (): boolean => provided !== null,
    decide(address: string): TypedAddressDecision {
      if (provided === null) return refused(TYPED_ADDRESS_NOT_CONFIGURED);
      let decision: TypedAddressDecision;
      try {
        decision = provided(address);
      } catch {
        return refused(TYPED_ADDRESS_RULE_FAILED);
      }
      if (typeof decision !== 'object' || decision === null) return refused(TYPED_ADDRESS_RULE_FAILED);
      if (decision.allowed !== true) return refused(typeof decision.refusal === 'string' && REFUSAL_WORD.test(decision.refusal) ? decision.refusal : TYPED_ADDRESS_RULE_FAILED);
      // The rule's answer, as it came: nothing of it is rebuilt here.
      return typeof decision.destination === 'object' && decision.destination !== null ? decision : refused(TYPED_ADDRESS_RULE_FAILED);
    },
  });
  controls.set(app.stages, control);
  return control;
}
