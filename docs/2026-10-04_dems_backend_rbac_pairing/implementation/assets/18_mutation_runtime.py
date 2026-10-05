import subprocess, shutil, sys, re, os
ROOT='/Users/gsp-budi/Documents/DEMS'
S=os.path.dirname(os.path.abspath(__file__))
MUT=S+'/mut'
LIVE=MUT+'/src/live/'
ORIG=ROOT+'/packages/shared/src/live/'
FILES=['core-actions.ts','errors.ts','hooks.ts','index.ts','mode.ts','settle.ts']
def restore():
    for f in FILES: shutil.copyfile(ORIG+f, LIVE+f)
def run():
    p=subprocess.run([ROOT+'/node_modules/.bin/vitest','run','--maxWorkers=2'],cwd=MUT,capture_output=True,text=True)
    out=p.stdout+p.stderr
    failed=[l.strip() for l in out.splitlines() if l.strip().startswith('×')]
    tests=[l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')]
    return p.returncode, tests, failed, out
MUTS=[
 ('M1 settle defers a plain value by one microtask','settle.ts',
  "  if (!isThenable(result)) {\n    succeed(result);\n    return;\n  }","  if (!isThenable(result)) {\n    void Promise.resolve(result).then(succeed);\n    return;\n  }"),
 ('M2 settle passes a throw of ok to fail (then().catch())','settle.ts',
  "  void result.then(once(succeed), once(refuse));","  void Promise.resolve(result).then(succeed).catch(refuse);"),
 ('M3 settle wraps the sync ok call into the try block','settle.ts',
  "  try {\n    result = run();\n  } catch (error) {\n    refuse(error);\n    return;\n  }\n  if (!isThenable(result)) {\n    succeed(result);\n    return;\n  }",
  "  try {\n    result = run();\n    if (!isThenable(result)) {\n      succeed(result);\n      return;\n    }\n  } catch (error) {\n    refuse(error);\n    return;\n  }"),
 ('M4 done is skipped after fail','settle.ts',
  "    try {\n      handlers.fail(error);\n    } finally {\n      handlers.done?.();\n    }","    handlers.fail(error);"),
 ('M5 done runs before ok','settle.ts',
  "    try {\n      handlers.ok?.(value);\n    } finally {\n      handlers.done?.();\n    }","    handlers.done?.();\n    handlers.ok?.(value);"),
 ('M6 the once guard is removed','settle.ts',
  "      if (!pending) return;\n",""),
 ('M7 a synchronous throw leaves settle','settle.ts',
  "  } catch (error) {\n    refuse(error);\n    return;\n  }","  } catch (error) {\n    refuse(error);\n    throw error;\n  }"),
 ('M8 settle wraps the Live result in an async function (extra turns)','settle.ts',
  "  void result.then(once(succeed), once(refuse));","  const live = result;\n  void (async () => {\n    let value: T;\n    try {\n      value = await live;\n    } catch (error) {\n      once(refuse)(error);\n      return;\n    }\n    once(succeed)(value);\n  })();"),
 ('M9 the rejection reason is wrapped','settle.ts',
  "      handlers.fail(error);","      handlers.fail(new Error(String(error)));"),
 ('M10 coreActionsOf returns a copy','core-actions.ts',
  "  return sim.actions;","  return { ...sim.actions };"),
 ('M11 coreActionsOf wraps every action in a promise','core-actions.ts',
  "  return sim.actions;","  return new Proxy(sim.actions, { get: (target, key) => (...args: unknown[]) => Promise.resolve((target as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>)[key]?.(...args)) }) as unknown as CoreActions;"),
 ('M12 the hooks never subscribe','hooks.ts',
  "    (listener: () => void) => liveOf(sim)?.onLiveChange(listener) ?? NOT_SUBSCRIBED,","    (_listener: () => void) => NOT_SUBSCRIBED,"),
 ('M13 useCorePermission falls back to the simulator role table','mode.ts',
  "  return liveOf(sim)?.session?.permissions.includes(permission) ?? false;","  return liveOf(sim)?.session?.permissions.includes(permission) ?? sim.store.getState().auth.status === 'SIGNED_IN';"),
 ('M14 any truthy marker makes a Live source','mode.ts',
  "(sim as Partial<LiveHandle>).coreMode === CoreMode.LIVE ?","Boolean((sim as Partial<LiveHandle>).coreMode) ?"),
 ('M15 parseCoreMode ignores case','mode.ts',
  "  return value === CoreMode.SIMULATED || value === CoreMode.LIVE ? value : null;","  const upper = typeof value === 'string' ? value.toUpperCase() : value;\n  return upper === CoreMode.SIMULATED || upper === CoreMode.LIVE ? upper : null;"),
 ('M16 the default mode is LIVE','mode.ts',
  "export const DEFAULT_CORE_MODE: CoreMode = CoreMode.SIMULATED;","export const DEFAULT_CORE_MODE: CoreMode = CoreMode.LIVE;"),
 ('M17 LiveTransportError drops the retry-after value','errors.ts',
  "    this.retryAfterSeconds = details.retryAfterSeconds ?? null;","    this.retryAfterSeconds = null;"),
 ('M18 the Live module has its own copy of SimPermissionError','errors.ts',
  "export { SimNotFoundError, SimPermissionError, SimTransitionError } from '../sim/errors';","import { SimNotFoundError, SimPermissionError as Base, SimTransitionError } from '../sim/errors';\nexport class SimPermissionError extends Base {}\nexport { SimNotFoundError, SimTransitionError };"),
 ('M19 LiveTransportError extends SimTransitionError','errors.ts',
  "export { SimNotFoundError, SimPermissionError, SimTransitionError } from '../sim/errors';\n","import { SimTransitionError as TransitionBase } from '../sim/errors';\nexport { SimNotFoundError, SimPermissionError, SimTransitionError } from '../sim/errors';\n"),
 ('M20 a file calls the network','mode.ts',
  "export const CORE_MODES","export const probe = (): unknown => fetch('/api/v1/health');\nexport const CORE_MODES"),
 ('M21 a file imports the typed client','core-actions.ts',
  "import type { SimActions } from '../sim/types';","import type { SimActions } from '../sim/types';\nimport type { CoreClient } from '../client';\nexport type Unused = CoreClient;"),
 ('M22 core-actions.ts imports React','core-actions.ts',
  "import type { SimActions } from '../sim/types';","import type { SimActions } from '../sim/types';\nimport { useMemo } from 'react';\nexport const unused = useMemo;"),
 ('M23 a file reads web storage','mode.ts',
  "export const CORE_MODES","export const stored = (): string | null => localStorage.getItem('dems.core.mode.v1');\nexport const CORE_MODES"),
]
restore()
rc,tests,failed,out=run()
print('BASE rc=%d %s'%(rc,' '.join(tests)))
results=[]
for name,f,old,new in MUTS:
    restore()
    s=open(LIVE+f).read()
    if old not in s:
        print('SKIP (pattern not found):',name); continue
    s=s.replace(old,new,1)
    if name.startswith('M19'):
        s=s.replace("export class LiveTransportError extends Error {","export class LiveTransportError extends TransitionBase {",1).replace("    super(\n      reason === LiveTransportReason.CORE_OFFLINE\n        ? 'The Core server is unreachable (CORE_OFFLINE).'\n        : 'The Core server could not answer the request (UNAVAILABLE).',\n    );","    super(null, reason === LiveTransportReason.CORE_OFFLINE ? 'CORE_OFFLINE' : 'UNAVAILABLE');",1)
    open(LIVE+f,'w').write(s)
    rc,tests,failed,out=run()
    verdict='KILLED' if rc!=0 else 'SURVIVED'
    print('%s | %s | rc=%d | %s | failing tests: %d'%(verdict,name,rc,' '.join(tests),len(failed)))
    for l in failed[:4]: print('      ',l[:150])
    if rc!=0 and not failed:
        print(out[-600:])
restore()
rc,tests,failed,out=run()
print('RESTORED rc=%d %s'%(rc,' '.join(tests)))
