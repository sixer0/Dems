p tapid network-time-back
sleep 2000
mark a13
p tapid more-dest-audit
sleep 3000
p screen audit
p shot 15_audit
p ids ^(audit|screen)-
w1 js (async()=>{const r=await fetch('/api/v1/audit?order=DESC&limit=5',{credentials:'same-origin'});const d=await r.json();return {status:r.status,keys:Object.keys(d),total:d.total??d.totalCount??null,rows:(d.items??d.rows??[]).map(x=>[x.seq??x.sequence,x.type,x.actorId,new Date(x.at??x.timestamp).toTimeString().slice(0,8)])}})()
w1 js (async()=>{const r=await fetch('/api/v1/audit/chain',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d}})()
serverlog a13
