press sm-action-note
sleep 1500
testids sm-note
testids note
eval [...document.querySelectorAll('textarea, [role=dialog] input, [role=dialog] button')].map((e) => (e.getAttribute('data-testid') ?? e.tagName) + ':' + (e.getAttribute('aria-label') ?? e.textContent.trim().slice(0, 30)))
shot B11_web_note_drawer
