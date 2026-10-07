mark J web Dashboard watch armed
watch 300000 (() => { const t = document.querySelector('[data-testid="panel-d"]')?.innerText ?? ''; const m = /SES-20261006-\d{4}/.exec(t); return m ? { id: m[0], text: t.replace(/\s+/g, ' ').slice(0, 300) } : null })()
shot J03_web_dashboard_session_appears
watch 400000 (() => { const t = document.querySelector('[data-testid="panel-d"]')?.innerText ?? ''; return /REC\s+\d\d:\d\d:\d\d/.test(t) ? t.replace(/\s+/g, ' ').slice(0, 300) : null })()
shot J04_web_dashboard_recording
