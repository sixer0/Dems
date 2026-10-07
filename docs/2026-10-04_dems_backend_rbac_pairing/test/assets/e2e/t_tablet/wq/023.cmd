type #react-aria5834819655-_r_18s_ SES-20261006-0025
sleep 2500
eval [...document.querySelectorAll('[data-testid="audit-table"] tr')].map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 140)).filter((t) => /created|started|ended|Note|Pre-|sealed|acknowledged/i.test(t))
eval [...document.querySelectorAll('[data-testid="audit-table"] tr')].length
