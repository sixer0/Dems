nav /evidence/EV-20261006-0017 4000
eval location.pathname
shot J23_web_evidence_detail
mouse evidence-tab-metadata
sleep 2000
fullshot J24_web_evidence_metadata
text evidence-detail-body 1800
mouse evidence-tab-integrity
sleep 2500
fullshot J25_web_evidence_integrity_custody
eval (() => { const b = document.querySelector('[data-testid="evidence-detail-body"]')?.innerText ?? ''; const i = b.search(/custody/i); return b.slice(Math.max(0, i), i + 900) })()
