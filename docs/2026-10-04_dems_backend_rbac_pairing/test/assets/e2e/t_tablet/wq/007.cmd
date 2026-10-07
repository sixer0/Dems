type sm-end-reason Interview completed (E2E-T web stop by supervisor)
mark B6 web confirm End Session
press sm-end-confirm
waitgone sm-end-dialog 15000
wait finalization-modal 15000
watch 40000 document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state') === 'SEALED' ? document.querySelector('[data-testid="sm-final-sealed"]')?.textContent?.trim() ?? 'SEALED' : null
sleep 1500
shot B18_web_sealed
api GET /api/v1/session/current
