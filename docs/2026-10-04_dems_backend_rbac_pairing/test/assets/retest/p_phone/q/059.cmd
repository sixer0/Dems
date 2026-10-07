mark z01
w1 api GET /api/v1/session/current
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role,u.enabled])})()
w1 js (async()=>{const r=await fetch('/api/v1/audit/chain',{credentials:'same-origin'});const d=await r.json();return {view:d.view.ok,stored:d.stored.ok,checked:d.stored.checked}})()
w1 origins
w1 console
w1 signout
keyguard
p top
p screen login
p shot 113_end_state_login_live_signed_out
serverlog z01
done 0
