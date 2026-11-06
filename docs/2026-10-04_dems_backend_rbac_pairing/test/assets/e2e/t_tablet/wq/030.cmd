mousetext Evidence
sleep 4000
eval location.pathname
eval (document.querySelector('main')?.innerText ?? '').replace(/\s+/g, ' ').match(/EV-20261006-001[56][^E]{0,120}/g)
shot B40_web_evidence_list
