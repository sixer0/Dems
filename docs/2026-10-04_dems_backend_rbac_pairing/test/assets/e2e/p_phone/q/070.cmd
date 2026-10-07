mark c00
w2 nav /login
w2 signin budi.santoso
w2 nav / 3000
w2 wait page-dashboard present 15000
sleep 2000
w2 js ({start: !!document.querySelector('[data-testid="start-new-session"]'), locked: !!document.querySelector('[data-testid="start-new-session-locked"]'), idle: !!document.querySelector('[data-testid="session-idle"]'), sealed: !!document.querySelector('[data-testid="session-sealed"]'), user: document.querySelector('header')?.textContent?.match(/Logged in as(.{0,30})/)?.[1]})
w2 shot 73_sc4_w2_budi_dashboard_before
w1 nav /admin/users 3000
w1 wait page-users-roles present 15000
sleep 2000
w1 js (async()=>{const r=await fetch('/api/v1/admin/users',{credentials:'same-origin'});const d=await r.json();return d.users.map(u=>[u.id,u.username,u.role,u.enabled,u.activeSessions])})()
w1 shot 74_sc4_w1_users_roles_before
p tap 756 2283
sleep 2500
p screen devices
p tapid device-row-CAM-01
sleep 2500
p screen device-detail
p swipe 540 1900 540 800 600
sleep 1500
p shot 75_sc4_phone_device_detail_before
p ids device-(action|restart)
serverlog c00
