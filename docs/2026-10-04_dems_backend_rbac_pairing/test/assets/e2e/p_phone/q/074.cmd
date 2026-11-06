mark c03
w2 api POST /api/v1/session {"caseNumber":"LP/2026/1006-0018","subjectType":"TERSANGKA","subjectName":"SC4 denied","investigatorId":"OPR-001","room":"Interview Room 1","profileId":"STANDARD_1080P25"}
w2 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});return r.status})()
p tap 108 2283
sleep 2500
p screen home
p shot 80_sc4_phone_home_technician
p tap 302 1239
sleep 3000
p screen session-new
p shot 81_sc4_phone_start_session_as_technician
sleep 2000
p shot 81b_sc4_phone_start_session_as_technician_t2
p corelog 10
serverlog c03
