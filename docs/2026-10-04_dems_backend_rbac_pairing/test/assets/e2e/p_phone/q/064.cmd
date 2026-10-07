w1 nav /session 3000
w1 wait page-session-monitor present 15000
w1 press sm-action-end
w1 wait sm-end-dialog present 5000
sleep 600
w1 js (()=>{const el=document.querySelector('[data-testid="sm-end-reason"]'); return el ? [el.tagName, el.querySelector('textarea,input')?.tagName ?? null] : null})()
