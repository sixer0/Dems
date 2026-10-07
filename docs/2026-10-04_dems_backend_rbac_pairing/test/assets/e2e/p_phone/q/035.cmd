p ids ^(monitor|screen|session-live|live)-
w1 js (async()=>{const r=await fetch('/api/v1/audio/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,900)}})()
