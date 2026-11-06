p tapid settings-section-header-back
sleep 2000
mark a17
p tap 540 1213
sleep 2500
p screen settings-security
p shot 19_settings_security
p ids ^(settings|screen)-
p swipe 540 1900 540 800 600
sleep 1200
p shot 19b_settings_security_scrolled
p ids ^(settings|screen)-
w1 js (async()=>{const r=await fetch('/api/v1/security/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,1500)}})()
w1 js (async()=>{const r=await fetch('/api/v1/pairing/devices',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,1500)}})()
serverlog a17
