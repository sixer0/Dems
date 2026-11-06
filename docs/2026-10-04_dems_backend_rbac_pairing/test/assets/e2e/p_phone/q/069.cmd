w1 js (async()=>{const out=[];for(const sid of ['SES-20261006-0031','SES-20261006-0032','SES-20261006-0033']){for(const t of ['SESSION_CREATED','RECORDING_STARTED','RECORDING_STOPPED','EVIDENCE_SEALED']){const r=await fetch('/api/v1/audit?type='+t+'&sessionId='+sid+'&order=DESC&limit=1',{credentials:'same-origin'});const d=await r.json();for(const x of d.rows)out.push([x.seq,x.type,x.actorId,sid,new Date(x.at).toTimeString().slice(0,8)+'.'+String(x.at%1000).padStart(3,'0'),x.message.slice(0,70),JSON.stringify(x.details).slice(0,90)])}}return out})()
w1 origins
p screen summary
p shot 72_sc3_phone_summary_0033
p tap 244 2252
sleep 2500
p screen home
p shot 72b_phone_home_after_sc3
