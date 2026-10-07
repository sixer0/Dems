eval (() => { const t = document.querySelector('[data-testid="audit-table"]'); t?.scrollIntoView({block:'start'}); return [...(t?.querySelectorAll('tr') ?? [])].slice(0, 14).map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 200)) })()
sleep 800
shot B36_web_security_audit_table
text custody-feed 1200
