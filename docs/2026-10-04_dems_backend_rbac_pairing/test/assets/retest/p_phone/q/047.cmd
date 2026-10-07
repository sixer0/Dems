mark j01
w1 js (async()=>{const r=await fetch('/api/v1/audit?type=ROLE_CHANGED&limit=50',{credentials:'same-origin'});const d=await r.json();return d.rows.slice(-2).map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toISOString(),x.message])})()
p screen home
p tap 324 2283
sleep 2500
p screen sessions
p shot 93_sessions_hub_investigator_unlocked
p ids sessions-start
p tap 972 2283
sleep 2500
p screen more
p shot 94_more_before_sign_out
p ids more-operator-(role|name)
p tapid more-sign-out
sleep 3500
p screen login
p shot 95_e2e_s1_after_sign_out_budi
sleep 2000
p shot 95b_e2e_s1_after_sign_out_budi_t2
p corelog 5
p warnlog
serverlog j01
