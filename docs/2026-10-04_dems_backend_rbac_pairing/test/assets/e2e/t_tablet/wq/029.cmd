mark R2 web confirm End
press sm-end-confirm
watch 40000 document.querySelector('[data-testid="finalization-modal"]')?.getAttribute('data-state') === 'SEALED' ? document.querySelector('[data-testid="sm-final-sealed"]')?.textContent?.trim() ?? 'SEALED' : null
shot R2_09_web_sealed
api GET /api/v1/session/current
