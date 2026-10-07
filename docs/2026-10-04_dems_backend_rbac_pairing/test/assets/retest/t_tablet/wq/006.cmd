mark J4 web confirm End Session
press sm-end-confirm
waitgone sm-end-dialog 15000
wait finalization-modal 15000
watch 60000 document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state') === 'SEALED' ? document.querySelector('[data-testid="sm-final-sealed"]')?.textContent?.trim() ?? 'SEALED' : null
sleep 1000
shot J18_web_sealed
api GET /api/v1/session/current
