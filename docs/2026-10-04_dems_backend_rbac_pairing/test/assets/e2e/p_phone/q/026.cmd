p tapid pairing-back
sleep 2000
p shot 19d_back_from_pairing
p tapid settings-section-header-back
sleep 2000
mark a19
p tapid settings-row-maintenance
sleep 2500
p screen settings-maintenance
p shot 20_settings_maintenance
p ids ^(settings|screen|maintenance)-
p swipe 540 1900 540 800 600
sleep 1200
p shot 20b_settings_maintenance_scrolled
p ids ^(settings|screen|maintenance)-
w1 js (async()=>{const r=await fetch('/api/v1/system/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,1200)}})()
w1 js (async()=>{const r=await fetch('/api/v1/demo/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,800)}})()
serverlog a19
