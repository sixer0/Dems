p ids ^session-new-next
p tap 540 2257
sleep 2000
p shot 27_start_session_step3_ready
p ids ^session-new-(ready|start|countdown|next|summary)
mark a25
p tap 540 2257
p poll 28_countdown 2 0
p waitlog start 25
sleep 3000
p screen live
p shot 29_live_monitor_a
sleep 3000
p shot 29b_live_monitor_b
serverlog a25
w1 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return s?{id:s.id,state:s.state,startedAt:s.startedAt?new Date(s.startedAt).toTimeString().slice(0,8):null,evidenceId:s.evidenceId}:null})()
