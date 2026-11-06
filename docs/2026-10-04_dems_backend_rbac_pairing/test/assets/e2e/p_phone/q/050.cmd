mark a31
p tap 811 1622
p waitlog stop 15
p screen finalizing
p poll 47_finalizing 6 700
sleep 4000
p screen summary
p shot 48_summary
p corelog 10
serverlog a31
w1 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return s?{id:s.id,state:s.state,evidenceId:s.evidenceId,endedAt:s.endedAt,durationMs:s.durationMs,summaryAck:s.summaryAcknowledged??s.summaryAcknowledgedAt??null}:null})()
