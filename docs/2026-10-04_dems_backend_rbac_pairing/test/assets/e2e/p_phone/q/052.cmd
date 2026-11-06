w1 js (async()=>{const out=[];for(const t of ['SESSION_CREATED','PRECHECK_PASSED','RECORDING_STARTED','MARKER_ADDED','RECORDING_STOPPED','EVIDENCE_SEALED','SUMMARY_ACKNOWLEDGED']){const r=await fetch('/api/v1/audit?type='+t+'&sessionId=SES-20261006-0030&order=DESC&limit=2',{credentials:'same-origin'});const d=await r.json();for(const x of d.rows)out.push([x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8),x.message.slice(0,100),JSON.stringify(x.details).slice(0,120)])}return out})()
p tap 108 2283
sleep 2500
p screen home
p shot 50_home_after_part_a
