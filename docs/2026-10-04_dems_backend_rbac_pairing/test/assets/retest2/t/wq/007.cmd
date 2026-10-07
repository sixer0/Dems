clicktext Open Session Monitor
wait page-session-monitor
sleep 1500
press sm-action-end
wait sm-end-dialog
sleep 500
type sm-end-reason Interview completed (RF-T run 1 web stop)
sleep 14000
eval ({ at: new Date().toTimeString().slice(0,8), state: document.querySelector('[data-testid="page-session-monitor"]')?.innerText.match(/RECORDING|ARMED|LIVE/)?.[0] ?? null })
mark E run 1 web confirm End Session
press sm-end-confirm
waitgone sm-end-dialog
wait finalization-modal
watch 25000 (() => { const t = document.querySelector('[data-testid="finalization-modal"]')?.innerText ?? ''; return /SEALED/.test(t) ? t.replace(/\s+/g,' ').slice(0,200) : null })()
sleep 800
shot W10_web_run1_sealed
