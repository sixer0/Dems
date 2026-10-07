mark a18
p tapid settings-security-pairing
sleep 2500
p screen pairing-details
p shot 19c_settings_security_core_pairing
p ids ^(pair|pairing|screen)
serverlog a18
w1 js (async()=>{const r=await fetch('/api/v1/audit?order=DESC&limit=3',{credentials:'same-origin'});const d=await r.json();return d.rows.map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8),JSON.stringify(x.payload??x.detail??null).slice(0,200)])})()
