eval location.pathname
testids sm-
eval [...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/monitor|session/i.test(h)).slice(0,10)
