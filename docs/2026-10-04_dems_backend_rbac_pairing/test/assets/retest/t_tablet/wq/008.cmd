eval (() => { const b = document.querySelector('[data-testid="evidence-detail-body"]')?.innerText ?? ''; const i = b.lastIndexOf('CHAIN OF CUSTODY'); const j = i >= 0 ? i : b.search(/chain of custody/i); return b.slice(Math.max(0, j), j + 900) })()
eval (() => { const el = [...document.querySelectorAll('*')].find((e) => e.children.length < 3 && /^chain of custody$/i.test(e.textContent.trim())); el?.scrollIntoView({ block: 'start' }); return !!el })()
sleep 1000
shot J25b_web_evidence_custody
api GET /api/v1/evidence/EV-20261006-0017
api GET /api/v1/audit?sessionId=SES-20261006-0027&limit=60
