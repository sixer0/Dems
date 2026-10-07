eval (() => { const i = document.querySelector('[data-testid="audit-search"] input'); i.id = i.id || 'e2e-audit-search'; return i.id + '|' + i.getAttribute('placeholder') })()
