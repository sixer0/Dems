p tap 756 2283
sleep 2500
p screen devices
p tapid device-row-CAM-01
sleep 2500
p screen device-detail
p swipe 540 1900 540 800 600
sleep 1500
p shot 85_sc4_phone_device_detail_technician
p ids device-(action|restart)
w2 shot 85w_sc4_w2_technician_dashboard
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.role])})()
w1 press ur-actions-OPR-001
w1 wait ur-change-role-OPR-001 present 4000
sleep 300
w1 press ur-change-role-OPR-001
w1 wait ur-role-dialog present 8000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="ur-role-option-INVESTIGATOR"] input'); if(!el||el.disabled) return false; el.click(); return true})()
sleep 400
w1 js document.querySelector('[data-testid="ur-role-dialog"]')?.textContent?.replace(/\s+/g,' ').slice(0,300)
w1 shot 86_sc4_w1_role_dialog_back_to_investigator
