p poll 38_home_timer_check 3 2000
w1 js (async()=>{const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return {now:new Date().toTimeString().slice(0,8),state:s.state,elapsed:((Date.now()-Date.parse(s.startedAt))/1000).toFixed(1)}})()
