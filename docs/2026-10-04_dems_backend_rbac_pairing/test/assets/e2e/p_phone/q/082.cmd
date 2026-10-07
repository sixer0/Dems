w1 press ur-actions-OPR-001
w1 wait ur-change-role-OPR-001 present 4000
sleep 300
w1 press ur-change-role-OPR-001
w1 wait ur-role-dialog present 8000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="ur-role-option-TECHNICIAN"] input'); if(!el||el.disabled) return false; el.click(); return true})()
sleep 400
p clock
p rec start sc4_cycle2_tech_phone 10
mark c07
w1 press ur-role-confirm
par w2 until 10000 !!document.querySelector('[data-testid="start-new-session-locked"]') || w1 until 10000 [...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent).find(t=>t.includes('is now Technician')) ?? false
sleep 4000
p rec pull sc4_cycle2_tech_phone 5
serverlog c07
