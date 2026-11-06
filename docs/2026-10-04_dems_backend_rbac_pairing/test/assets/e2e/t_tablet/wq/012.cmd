testids integrity
testids verif
eval [...document.querySelectorAll('button')].filter((b) => /verify/i.test(b.textContent)).map((b) => (b.getAttribute('data-testid') ?? '-') + ':' + b.textContent.trim())
