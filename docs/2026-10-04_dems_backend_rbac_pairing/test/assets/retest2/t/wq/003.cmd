sleep 3000
mark web Verify on EV-20261006-0017 (andi)
press evidence-verify
watch 20000 (() => { const t = document.querySelector('[data-testid="evidence-verify-card"]')?.innerText ?? ''; return /VERIFIED|PASS/.test(t) && !/NOT VERIFIED/.test(t) ? t.replace(/\s+/g,' ').slice(0,300) : null })()
sleep 1500
shot W03_web_evidence_0017_after_verify
text evidence-verify-card 600
