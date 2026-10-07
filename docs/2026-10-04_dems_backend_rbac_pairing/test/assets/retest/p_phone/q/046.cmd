p screen home
p clock
p rec start role_back_inv 10
mark i04
w1 press ur-role-confirm
w1 until 10000 [...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent).find(t=>t.includes('is now Investigator')) ?? false
sleep 9000
p rec pull role_back_inv
p clock
p shot 90_role_phone_home_investigator_enabled
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role])})()
w1 js (async()=>{const r=await fetch('/api/v1/audit?type=ROLE_CHANGED&limit=5',{credentials:'same-origin'});const d=await r.json();return d.rows.slice(-2).map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toISOString(),x.message])})()
w1 shot 91_role_web_after_back_investigator
serverlog i04
