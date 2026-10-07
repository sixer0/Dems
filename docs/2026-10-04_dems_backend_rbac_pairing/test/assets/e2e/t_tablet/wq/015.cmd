mousetext Archive
sleep 1500
eval [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].map((d) => d.innerText.replace(/\s+/g, ' ').slice(0, 300))
eval [...document.querySelectorAll('[role=dialog] button, [role=alertdialog] button')].map((b) => (b.getAttribute('data-testid') ?? '-') + ':' + b.textContent.trim())
shot B33_web_archive_confirm
