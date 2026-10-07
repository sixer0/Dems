mark i01
p screen summary
p tap 244 2252
p waitlog sumack 15
sleep 2500
p screen home
p shot 83_home_after_summary_done_investigator
w1 press sm-final-close
sleep 500
w1 nav /admin/users 3000
w1 wait page-users-roles present 15000
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role])})()
w1 press ur-actions-OPR-001
w1 wait ur-change-role-OPR-001 present 4000
sleep 300
w1 press ur-change-role-OPR-001
w1 wait ur-role-dialog present 8000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="ur-role-option-TECHNICIAN"] input'); if(!el||el.disabled) return false; el.click(); return true})()
sleep 400
w1 shot 84_role_web_dialog_to_technician
serverlog i01
