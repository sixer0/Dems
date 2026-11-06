w1 js (async()=>{const out=[];for(const t of ['ROLE_CHANGED','ACCESS_DENIED']){const r=await fetch('/api/v1/audit?type='+t+'&order=DESC&limit=3',{credentials:'same-origin'});const d=await r.json();for(const x of d.rows)out.push([x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8)+'.'+String(x.at%1000).padStart(3,'0'),x.message.slice(0,110),JSON.stringify(x.details).slice(0,220),x.deviceId])}return out})()
p tap 995 2233
sleep 600
p tap 95 216
sleep 2500
p shot 84_sc4_phone_after_leaving_wizard
