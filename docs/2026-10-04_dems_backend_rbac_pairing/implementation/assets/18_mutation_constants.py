import subprocess, shutil, os
ROOT='/Users/gsp-budi/Documents/DEMS'
S=os.path.dirname(os.path.abspath(__file__))
MUT=S+'/mut'; LIVE=MUT+'/src/live/'; ORIG=ROOT+'/packages/shared/src/live/'
FILES=['constants.ts','index.ts']
def restore():
    for f in FILES: shutil.copyfile(ORIG+f, LIVE+f)
def run():
    p=subprocess.run([ROOT+'/node_modules/.bin/vitest','run','--maxWorkers=2'],cwd=MUT,capture_output=True,text=True)
    out=p.stdout+p.stderr
    failed=[l.strip() for l in out.splitlines() if l.strip().startswith('×')]
    tests=[l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')]
    return p.returncode, tests, failed
MUTS=[
 ('C1 the pending reveal is 400','constants.ts',"export const LIVE_PENDING_REVEAL_MS = 420;","export const LIVE_PENDING_REVEAL_MS = 400;"),
 ('C2 the resynced notice is 2,000','constants.ts',"export const LIVE_RESYNCED_NOTICE_MS = 3_000;","export const LIVE_RESYNCED_NOTICE_MS = 2_000;"),
 ('C3 the file imports the motion token','constants.ts',"export const LIVE_PENDING_REVEAL_MS = 420;","import { motion } from '../tokens';\nexport const LIVE_PENDING_REVEAL_MS = motion.duration.slow;"),
 ('C4 an invented third constant','constants.ts',"export const LIVE_RESYNCED_NOTICE_MS = 3_000;","export const LIVE_RESYNCED_NOTICE_MS = 3_000;\nexport const LIVE_OFFLINE_TOAST_COALESCE_MS = 3_000;"),
 ('C5 the barrel does not export the file','index.ts',"export * from './constants';\n",""),
 ('C6 the command time-out is copied into the light file','constants.ts',"export const LIVE_RESYNCED_NOTICE_MS = 3_000;","export const LIVE_RESYNCED_NOTICE_MS = 3_000;\nexport const LIVE_COMMAND_TIMEOUT_MS = 8_000;"),
]
restore(); rc,tests,failed=run(); print('BASE rc=%d %s'%(rc,' '.join(tests)))
for name,f,old,new in MUTS:
    restore(); s=open(LIVE+f).read()
    if old not in s: print('SKIP',name); continue
    open(LIVE+f,'w').write(s.replace(old,new,1))
    rc,tests,failed=run()
    print('%s | %s | rc=%d | %s | failing tests: %d'%('KILLED' if rc else 'SURVIVED',name,rc,' '.join(tests),len(failed)))
    for l in failed[:3]: print('      ',l[:170])
restore(); rc,tests,failed=run(); print('RESTORED rc=%d %s'%(rc,' '.join(tests)))
