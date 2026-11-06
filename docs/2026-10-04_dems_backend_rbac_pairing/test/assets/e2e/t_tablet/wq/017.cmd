eval [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') + ':' + a.textContent.trim().slice(0, 25)).filter((x) => /secur|audit/i.test(x))
