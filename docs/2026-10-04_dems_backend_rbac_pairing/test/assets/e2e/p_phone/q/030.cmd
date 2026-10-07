p key 4
sleep 2000
p screen settings-about
p shot 22c_back_from_stack_check
p tapid settings-section-header-back
sleep 2000
mark a22
p tapid settings-account-row
sleep 2000
p screen settings-profile
p shot 23_settings_profile_sheet
p ids ^(settings-profile|screen)
w1 js (async()=>{const r=await fetch('/api/v1/rbac/matrix',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,1500)}})()
serverlog a22
