mark f01
w1 press sm-final-close
sleep 500
w1 nav /evidence/EV-20261006-0023 3500
w1 js location.pathname
w1 press evidence-tab-integrity
sleep 2000
w1 js (()=>{const c=document.querySelector('[data-testid="evidence-custody"]'); if(!c) return null; c.scrollIntoView({block:'center'}); return [...c.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td,th')].map(x=>x.textContent.replace(/\s+/g,' ').trim()))})()
sleep 800
w1 shot 67_custody_web_ev0023_integrity_tab
w1 js (()=>{const c=document.querySelector('[data-testid="evidence-custody"]'); const r=c.getBoundingClientRect(); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
serverlog f01
