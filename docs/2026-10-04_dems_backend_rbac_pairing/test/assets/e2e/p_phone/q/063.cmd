mark b06
p tap 540 2257
w1 until 20000 (()=>{const r=document.querySelector('[data-testid="session-recording"]'); return r ? {rec:true, text: r.textContent.replace(/\s+/g,' ').slice(0,160)} : false})()
w1 shot 62_sc3_s3_web_dashboard_recording
p waitlog start 10
sleep 2000
p screen live
p shot 62p_sc3_s3_phone_monitor
serverlog b06
