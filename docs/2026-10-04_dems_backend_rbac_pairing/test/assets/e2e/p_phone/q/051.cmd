w1 js (async()=>{const r=await fetch('/api/v1/evidence/EV-20261006-0018',{credentials:'same-origin'});const d=await r.json();const e=d.evidence??d;return {status:r.status,id:e.id,status2:e.status,recordedAt:new Date(e.recordedAt).toTimeString().slice(0,8),endedAt:new Date(e.endedAt).toTimeString().slice(0,8),sealedAt:new Date(e.sealedAt).toTimeString().slice(0,8),durationMs:e.durationMs,sizeBytes:e.sizeBytes,markers:e.markers}})()
w1 js (async()=>{const r=await fetch('/api/v1/audit?sessionId=SES-20261006-0030&order=ASC&limit=60',{credentials:'same-origin'});const d=await r.json();return d.rows.filter(x=>!['FRAME_HASH','WRITE_VERIFIED','TIMESTAMP_CONFIRMED'].includes(x.type)).map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8),x.message.slice(0,90)])})()
mark a32
p tap 650 2254
sleep 3000
p screen home
p shot 49_after_summary_done
p corelog 10
serverlog a32
