p tap 539 2028
sleep 900
p text E2E-P phone note
sleep 800
p shot 31b_monitor_bookmark_label_typed
p key 66
sleep 2500
p shot 32_monitor_marker_added
p corelog 10
serverlog a26
w1 js (async()=>{const r=await fetch('/api/v1/audit?order=DESC&limit=3',{credentials:'same-origin'});const d=await r.json();return d.rows.map(x=>[x.seq,x.type,x.actorId,x.sessionId,new Date(x.at).toTimeString().slice(0,8),JSON.stringify(x.detail??x.payload??x.data??null).slice(0,160)])})()
