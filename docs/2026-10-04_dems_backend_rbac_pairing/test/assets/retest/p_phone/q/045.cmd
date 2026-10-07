mark i03
p screen home
p tap 324 2283
sleep 2500
p screen sessions
p shot 88_role_phone_sessions_hub_technician_locked
p ids sessions-start
w1 js (async()=>{const r=await fetch('/api/v1/audit?type=ROLE_CHANGED&limit=5',{credentials:'same-origin'});const d=await r.json();return d.rows.slice(-3).map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toISOString(),x.message,JSON.stringify(x.details)])})()
p tap 108 2283
sleep 2000
w1 press ur-actions-OPR-001
w1 wait ur-change-role-OPR-001 present 4000
sleep 300
w1 press ur-change-role-OPR-001
w1 wait ur-role-dialog present 8000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="ur-role-option-INVESTIGATOR"] input'); if(!el||el.disabled) return false; el.click(); return true})()
sleep 400
w1 shot 89_role_web_dialog_back_to_investigator
serverlog i03
