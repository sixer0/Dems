mark R2 web Dashboard REC watch armed
watch 120000 (() => { const t = document.querySelector('[data-testid="panel-d"]')?.innerText ?? ''; return /REC\s+\d\d:\d\d:\d\d/.test(t) ? t.replace(/\s+/g, ' ').replace(/(\d\s){5,}/g, '').slice(0, 220) : null })()
shot R2_03_web_dashboard_rec_first
sleep 3000
text panel-d 400
shot R2_04_web_dashboard_rec_plus3s
