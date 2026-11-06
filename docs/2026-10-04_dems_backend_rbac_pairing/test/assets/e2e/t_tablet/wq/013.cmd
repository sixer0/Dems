mark B9 web Verify pressed
mouse evidence-verify
watch 30000 /VERIFIED|PASS|FAIL/.test(document.querySelector('[data-testid="evidence-detail-body"]')?.innerText.split('Verify')[0].slice(-400) ?? '') && !/0 of 6/.test(document.body.innerText) ? 'settled' : null
sleep 1500
fullshot B30_web_evidence_verified
text evidence-detail-body 3500
