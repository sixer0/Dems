clicktext Open Session Monitor
wait page-session-monitor
sleep 1500
press sm-action-end
wait sm-end-dialog
sleep 500
type sm-end-reason Interview completed (RF-T run 3 web stop)
sleep 12000
mark E run 3 web confirm End Session
press sm-end-confirm
waitgone sm-end-dialog
wait finalization-modal
watch 25000 (() => { const t = document.querySelector('[data-testid="finalization-modal"]')?.innerText ?? ''; return /Evidence sealed/i.test(t) ? t.replace(/\s+/g,' ').slice(0,160) : null })()
sleep 800
shot W12_web_run3_sealed
