p poll 30_monitor_timer 3 1500
w1 js (async()=>{const t0=Date.now();const r=await fetch('/api/v1/session/current',{credentials:'same-origin'});const d=await r.json();const s=d.session;return {now:new Date().toTimeString().slice(0,8),state:s.state,startedAt:s.startedAt,elapsedS:((Date.now()-s.startedAt)/1000).toFixed(1),serverTime:d.serverTime}})()
