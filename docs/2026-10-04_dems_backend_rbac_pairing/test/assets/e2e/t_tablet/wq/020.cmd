eval (() => { const el = document.querySelector('[data-testid="audit-search"]'); return el ? el.tagName + ':' + (el.querySelector('input') ? 'has input' : 'no input') : null })()
type [data-testid="audit-search"] input Recording started
sleep 2000
eval [...document.querySelectorAll('[data-testid="audit-table"] [role=row], [data-testid="audit-table"] tr')].slice(0, 8).map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 160))
