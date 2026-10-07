w1 js (async()=>{const r=await fetch('/api/v1/audit?type=MARKER_ADDED&order=DESC&limit=1',{credentials:'same-origin'});const d=await r.json();return d.rows[0]})()
mark a27
p key 4
sleep 1500
p shot 33_back_guard_dialog
p focus
