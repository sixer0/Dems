p screen login
sleep 2000
p shot 98_end_state_login_live_signed_out
p corelog 10
w1 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return s?{id:s.id,state:s.state,evidenceId:s.evidenceId}:null})()
w1 js (async()=>{const r=await fetch('/api/v1/pairing/devices',{credentials:'same-origin'});const d=await r.json();return d.devices.map(x=>[x.id,x.state,x.online,x.signedInOperatorId])})()
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role,u.enabled])})()
w1 js (async()=>{const r=await fetch('/api/v1/audit/chain',{credentials:'same-origin'});const d=await r.json();return {view:d.view, stored:{ok:d.stored.ok,checked:d.stored.checked}}})()
w1 origins
w2 origins
w2 signout
w1 signout
serverlog d01
