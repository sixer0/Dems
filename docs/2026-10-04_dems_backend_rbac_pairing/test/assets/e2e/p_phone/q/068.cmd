p tap 302 1239
sleep 2500
p screen live
p tap 539 2266
sleep 1800
p tap 539 1279
sleep 900
p text SC3 stop on phone 2
sleep 1000
p shot 70_sc3_s2b_phone_end_dialog
w1 js ({state: document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state')})
mark b10
p tap 811 1622
w1 until 15000 (()=>{const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return s && s!=='RECORDING' ? s : false})()
w1 shot 71_sc3_s2b_web_after_phone_stop
w1 until 20000 (()=>document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state')==='SEALED')()
sleep 1500
w1 shot 71b_sc3_s2b_web_sealed
serverlog b10
