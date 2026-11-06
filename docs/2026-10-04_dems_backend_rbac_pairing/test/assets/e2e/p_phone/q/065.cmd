w1 type [data-testid="sm-end-reason"] SC3 stop on web
sleep 500
w1 shot 63_sc3_s3_web_end_dialog
p screen live
p rec start sc3_s3_phone 12
mark b07
w1 press sm-end-confirm
w1 until 15000 (()=>{const s=document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'); return s && s!=='RECORDING' ? s : false})()
sleep 6000
p rec pull sc3_s3_phone 5
w1 shot 64_sc3_s3_web_after_stop
p screen summary
p shot 64p_sc3_s3_phone_after_web_stop
serverlog b07
