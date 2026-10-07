w1 press ur-actions-OPR-001
w1 wait ur-change-role-OPR-001 present 4000
sleep 300
w1 press ur-change-role-OPR-001
w1 wait ur-role-dialog present 8000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="ur-role-option-TECHNICIAN"] input'); if(!el||el.disabled) return false; el.click(); return true})()
sleep 400
w1 js document.querySelector('[data-testid="ur-role-dialog"]')?.textContent?.replace(/\s+/g,' ').slice(0,400)
w1 shot 76_sc4_w1_role_dialog_technician
