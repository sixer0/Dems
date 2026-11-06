frames dashboard_recording
net dashboard_recording
clicktext Open Session Monitor
wait page-session-monitor 15000
sleep 2500
eval (() => { const panel = document.querySelector('[data-testid="panel-O"]'); const meters = [...(panel?.querySelectorAll('[data-testid="dbfs-meter"]') ?? [])].map((m) => { const r = m.querySelector('[role="meter"]'); return { ch: m.getAttribute('data-channel'), now: r?.getAttribute('aria-valuenow'), text: r?.getAttribute('aria-valuetext') } }); const page = document.querySelector('[data-testid="page-session-monitor"]'); return { at: new Date().toISOString().slice(11, 23), phase: page?.getAttribute('data-phase'), state: page?.getAttribute('data-session-state'), duration: document.querySelector('[data-testid="sm-duration"]')?.textContent?.trim(), meters } })()
shot B09_web_session_monitor_1
sleep 4000
eval (() => { const panel = document.querySelector('[data-testid="panel-O"]'); const meters = [...(panel?.querySelectorAll('[data-testid="dbfs-meter"]') ?? [])].map((m) => { const r = m.querySelector('[role="meter"]'); return { ch: m.getAttribute('data-channel'), now: r?.getAttribute('aria-valuenow'), text: r?.getAttribute('aria-valuetext') } }); const page = document.querySelector('[data-testid="page-session-monitor"]'); return { at: new Date().toISOString().slice(11, 23), phase: page?.getAttribute('data-phase'), state: page?.getAttribute('data-session-state'), duration: document.querySelector('[data-testid="sm-duration"]')?.textContent?.trim(), meters } })()
shot B10_web_session_monitor_2
testids sm-
