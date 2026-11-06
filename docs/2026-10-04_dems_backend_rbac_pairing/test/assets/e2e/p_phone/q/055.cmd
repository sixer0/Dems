w1 js document.querySelector('[data-testid="sn-gate-outcome"]')?.textContent?.trim()
w1 press sn-next
sleep 2500
w1 shot 53_sc3_web_step3_ready
w1 ids ^sn-
w1 js ({sw: document.querySelector('[data-testid="sn-countdown-switch"]')?.outerHTML?.slice(0,300), start: document.querySelector('[data-testid="sn-start"]')?.outerHTML?.slice(0,200)})
