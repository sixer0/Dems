type input[placeholder^="Search"] SES-20261006-0025
sleep 2000
eval [...document.querySelectorAll('[data-testid="audit-table"] tr')].map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 140)).filter((t) => /created|started|ended|Note|Pre-|sealed|acknowledged/i.test(t))
