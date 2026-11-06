mark B2 web Dashboard watch armed
watch 180000 (() => { const t = document.querySelector('[data-testid="panel-d"]')?.innerText ?? ''; const m = /SES-20261006-\d{4}/.exec(t); return m ? { id: m[0], text: t.replace(/\s+/g, ' ').slice(0, 300) } : null })()
shot B03_web_dashboard_session_appears
watch 300000 (() => { const t = document.querySelector('[data-testid="panel-d"]')?.innerText ?? ''; return /record/i.test(t) && !/sealed/i.test(t) ? t.replace(/\s+/g, ' ').slice(0, 300) : null })()
shot B04_web_dashboard_recording
testids panel-d
