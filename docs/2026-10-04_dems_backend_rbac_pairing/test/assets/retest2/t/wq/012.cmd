clicktext Open Session Monitor
wait page-session-monitor
sleep 1500
press sm-action-end
wait sm-end-dialog
sleep 500
type sm-end-reason Interview completed (RF-T run 2 web stop)
sleep 6000
mark E run 2 web confirm End Session
press sm-end-confirm
waitgone sm-end-dialog
wait finalization-modal
watch 25000 (() => { const t = document.querySelector('[data-testid="finalization-modal"]')?.innerText ?? ''; return /sealed/i.test(t) && !/Sealing|Finaliz/.test(t.slice(0,20)) ? t.replace(/\s+/g,' ').slice(0,160) : null })()
sleep 800
shot W11_web_run2_sealed
