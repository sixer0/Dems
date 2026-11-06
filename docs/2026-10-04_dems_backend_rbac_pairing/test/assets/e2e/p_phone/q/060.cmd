p rec start sc3_s2_phone 12
mark b03
p tap 811 1622
w1 until 15000 (()=>{const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return s && s!=='RECORDING' ? {state:s, modal: document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state') ?? null} : false})()
w1 shot 57_sc3_s2_web_after_phone_stop
w1 until 20000 (()=>{const m=document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state'); const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return (m==='SEALED'||s==='SEALED') ? {state:s, modal:m, sealed: document.querySelector('[data-testid="sm-final-sealed"]')?.textContent?.trim()} : false})()
sleep 1500
w1 shot 58_sc3_s2_web_sealed
p rec pull sc3_s2_phone 5
p screen summary
p shot 58p_sc3_s2_phone_summary
serverlog b03
