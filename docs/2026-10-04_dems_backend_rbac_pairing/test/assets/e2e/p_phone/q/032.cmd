p tap 913 748
sleep 900
p tap 229 994
sleep 700
p tap 540 1309
sleep 900
p text E2E-P Phone
sleep 800
p key 111
sleep 800
p shot 25_start_session_step1_filled
p ids session-new-(case-number|subject-name|investigator|room|profile)
mark a24
p tap 540 2257
p waitlog create 20
p waitlog precheck 20
sleep 6000
p shot 26_start_session_step2_gate
p ids ^session-new-(gate|check|next|step)
serverlog a24
w1 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return s?{id:s.id,state:s.state,caseNumber:s.caseNumber,subject:s.subjectName,investigatorId:s.investigatorId,precheck:s.precheck?{outcome:s.precheck.outcome,items:(s.precheck.items??[]).map(i=>i.id+'='+i.status)}:null}:null})()
