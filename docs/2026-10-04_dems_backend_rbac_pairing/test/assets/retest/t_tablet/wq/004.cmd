type sm-note-input Supervisor note R-T: confirm subject ID before questioning
mark J3 web Save note
press sm-note-submit
waitgone sm-note-drawer 10000
sleep 1500
shot J13_web_note_saved
eval [...document.querySelectorAll('[data-testid="page-session-monitor"] *')].filter((e) => e.children.length === 0 && /Note Added|note/i.test(e.textContent)).map((e) => e.textContent.trim()).slice(0, 12)
