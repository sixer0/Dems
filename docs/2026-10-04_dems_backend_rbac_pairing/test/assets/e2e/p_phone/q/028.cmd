w1 js (async()=>{const r=await fetch('/api/v1/system/status',{credentials:'same-origin'});const d=await r.json();const {device,services,...rest}=d;return {status:r.status,rest:JSON.stringify(rest).slice(0,1500)}})()
mark a20
p tapid settings-section-header-back
sleep 2000
p tapid settings-row-about
sleep 2500
p screen settings-about
p shot 21_settings_about
p ids ^(settings|screen|about)-
p swipe 540 1900 540 800 600
sleep 1200
p shot 21b_settings_about_scrolled
p ids ^(settings|screen|about)-
serverlog a20
