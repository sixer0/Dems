clicktext Open Session Monitor
wait page-session-monitor 15000
sleep 3000
eval (() => { const page = document.querySelector('[data-testid="page-session-monitor"]'); const meters = [...document.querySelectorAll('[data-testid="panel-O"] [data-testid="dbfs-meter"] [role="meter"]')].map((r) => r.getAttribute('aria-valuenow')); return { at: new Date().toTimeString().slice(0, 8), state: page?.getAttribute('data-session-state'), duration: document.querySelector('[data-testid="sm-duration"]')?.textContent?.trim(), meters } })()
shot R2_06_web_monitor_1
sleep 3000
eval (() => { const page = document.querySelector('[data-testid="page-session-monitor"]'); const meters = [...document.querySelectorAll('[data-testid="panel-O"] [data-testid="dbfs-meter"] [role="meter"]')].map((r) => r.getAttribute('aria-valuenow')); return { at: new Date().toTimeString().slice(0, 8), state: page?.getAttribute('data-session-state'), duration: document.querySelector('[data-testid="sm-duration"]')?.textContent?.trim(), meters } })()
shot R2_07_web_monitor_2
press sm-action-end
wait sm-end-dialog 5000
sleep 500
type sm-end-reason R2 latency run complete (E2E-T web stop)
