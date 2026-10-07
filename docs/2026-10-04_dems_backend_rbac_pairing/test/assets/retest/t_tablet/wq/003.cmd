clicktext Open Session Monitor
wait page-session-monitor 15000
sleep 2500
eval (() => { const page = document.querySelector('[data-testid="page-session-monitor"]'); return { at: new Date().toTimeString().slice(0, 8), state: page?.getAttribute('data-session-state'), duration: document.querySelector('[data-testid="sm-duration"]')?.textContent?.trim() } })()
shot J09_web_session_monitor
press sm-action-note
sleep 1500
testids sm-note
eval [...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText.replace(/\s+/g, ' ').slice(0, 300))
shot J10_web_note_drawer_supervisor
