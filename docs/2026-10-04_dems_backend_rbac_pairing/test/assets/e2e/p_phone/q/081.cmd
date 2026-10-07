p clock
w2 js ({locked: !!document.querySelector('[data-testid="start-new-session-locked"]')})
p rec start sc4_back_phone 12
mark c06
w1 press ur-role-confirm
par w2 until 10000 (()=>!document.querySelector('[data-testid="start-new-session-locked"]') && !!document.querySelector('[data-testid="start-new-session"]'))() || w1 until 10000 [...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent).find(t=>t.includes('is now Investigator')) ?? false
w2 shot 90_sc4_w2_after_back_unlocked
w1 shot 90b_sc4_w1_after_back
w2 js ({start: !!document.querySelector('[data-testid="start-new-session"]'), locked: !!document.querySelector('[data-testid="start-new-session-locked"]'), toasts:[...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent.replace(/\s+/g,' ').slice(0,120))})
sleep 3000
p rec pull sc4_back_phone 5
p shot 91_sc4_phone_after_back
p ids device-(action|restart)
serverlog c06
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role])})()
w1 js (async()=>{const r=await fetch('/api/v1/audit?type=ROLE_CHANGED&order=DESC&limit=2',{credentials:'same-origin'});const d=await r.json();return d.rows.map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8)+'.'+String(x.at%1000).padStart(3,'0'),x.message,JSON.stringify(x.details)])})()
