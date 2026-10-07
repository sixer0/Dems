w1 js ({path: location.pathname, login: !!document.querySelector('[data-testid="page-login"]'), text: document.querySelector('[data-testid="page-login"]')?.textContent?.slice(0,200)})
w1 shot w1_expired_probe
w1 nav /login
w1 signin andi.pratama
w1 js (async()=>{const r=await fetch('/api/v1/system/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,1500)}})()
w1 js (async()=>{const r=await fetch('/api/v1/demo/status',{credentials:'same-origin'});const d=await r.json();return {status:r.status,d:JSON.stringify(d).slice(0,800)}})()
w1 js (async()=>{const r=await fetch('/api/v1/audit?order=DESC&limit=3',{credentials:'same-origin'});const d=await r.json();return d.rows.map(x=>[x.seq,x.type,x.actorId,new Date(x.at).toTimeString().slice(0,8)])})()
