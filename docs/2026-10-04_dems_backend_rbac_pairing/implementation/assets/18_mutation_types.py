import subprocess, shutil, os
ROOT='/Users/gsp-budi/Documents/DEMS'
S=os.path.dirname(os.path.abspath(__file__))
MUT=S+'/mut'; LIVE=MUT+'/src/live/'; ORIG=ROOT+'/packages/shared/src/live/'
FILES=['core-actions.ts','errors.ts','hooks.ts','index.ts','mode.ts','settle.ts']
def restore():
    for f in FILES: shutil.copyfile(ORIG+f, LIVE+f)
def tsc():
    p=subprocess.run([ROOT+'/node_modules/.bin/tsc','--noEmit','-p',MUT+'/tsconfig.json'],cwd=MUT,capture_output=True,text=True)
    lines=[l for l in (p.stdout+p.stderr).splitlines() if 'error TS' in l]
    return p.returncode, lines
MUTS=[
 ('T1 CoreResult is not widened','core-actions.ts',"export type CoreResult<R> = R | Promise<R>;","export type CoreResult<R> = R;"),
 ('T2 fail becomes optional','settle.ts',"  fail: (error: unknown) => void;","  fail?: (error: unknown) => void;"),
 ('T3 ok receives the raw return type (no unwrapping)','settle.ts',"export function settle<T>(run: () => T | PromiseLike<T>, handlers: SettleHandlers<T>): void {","export function settle<T>(run: () => T, handlers: SettleHandlers<T>): void {"),
 ('T4 CoreActions drops the parameters','core-actions.ts',"    ? (...args: Args) => CoreResult<Result>","    ? () => CoreResult<Result>"),
 ('T5 useLive loses its type argument','hooks.ts',"export function useLive<Handle extends LiveHandle = LiveHandle>(): Handle | null {\n  return liveOf<Handle>(useSimInstance());","export function useLive(): LiveHandle | null {\n  return liveOf(useSimInstance());"),
 ('T6 corePermissionOf takes any string','mode.ts',"export function corePermissionOf(sim: Sim, permission: Permission): boolean {","export function corePermissionOf(sim: Sim, permission: string): boolean {"),
]
restore(); rc,lines=tsc(); print('BASE tsc exit=%d errors=%d'%(rc,len(lines)))
for l in lines[:10]: print('   ',l.replace(MUT+'/','')[:200])
for name,f,old,new in MUTS:
    restore(); s=open(LIVE+f).read()
    if old not in s: print('SKIP',name); continue
    open(LIVE+f,'w').write(s.replace(old,new,1))
    rc,lines=tsc()
    print('%s | %s | tsc exit=%d | errors=%d'%('KILLED' if rc else 'SURVIVED',name,rc,len(lines)))
    for l in lines[:3]: print('      ',l.replace(MUT+'/','')[:190])
restore(); rc,lines=tsc(); print('RESTORED tsc exit=%d errors=%d'%(rc,len(lines)))
