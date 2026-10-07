p screen home
p clock
p rec start role_to_tech 10
mark i02
w1 press ur-role-confirm
w1 until 10000 [...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent).find(t=>t.includes('is now Technician')) ?? false
sleep 9000
p rec pull role_to_tech
p clock
p shot 85_role_phone_home_technician_locked
w1 shot 86_role_web_after_change_technician
serverlog i02
