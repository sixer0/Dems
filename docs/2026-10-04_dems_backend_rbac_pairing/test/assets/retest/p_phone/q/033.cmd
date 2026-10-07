p screen live
p clock
p rec start p4_web_stop 14
mark e03
w1 press sm-end-confirm
w1 until 15000 (()=>{const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return s && s!=='RECORDING' ? s : false})()
w1 until 20000 (()=>{const m=document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state'); const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return (m==='SEALED'||s==='SEALED') ? {state:s, modal:m, sealed: document.querySelector('[data-testid="sm-final-sealed"]')?.textContent?.trim()?.slice(0,160)} : false})()
w1 shot 63_p4_web_after_stop_sealed
p rec pull p4_web_stop
p clock
p screen summary
p shot 64_p4_phone_after_web_stop
p warnlog
serverlog e03
