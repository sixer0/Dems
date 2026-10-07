mouse evidence-more
sleep 1000
eval [...document.querySelectorAll('[role=menuitem]')].map((e) => (e.getAttribute('data-key') ?? e.id) + ':' + e.textContent.trim() + ':' + (e.getAttribute('aria-disabled') ?? 'enabled'))
shot B32_web_evidence_more_menu
