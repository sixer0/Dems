eval (() => { const t = document.querySelector('[data-testid="audit-table"]'); let el = t; const all = [t, ...t.querySelectorAll('*')]; const sc = all.find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible'); if (sc) { sc.scrollTop = sc.scrollHeight; } t.scrollIntoView({ block: 'center' }); return sc ? (sc.getAttribute('data-testid') ?? sc.className.slice(0, 40)) + ' ' + sc.scrollTop : 'no scroller; page scroll' })()
sleep 1500
eval (() => { const txt = document.querySelector('[data-testid="audit-table"]').innerText; const i = txt.indexOf('#127'); return txt.slice(Math.max(0, i), i + 700) })()
shot B38_web_audit_session_start_rows
