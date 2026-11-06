press nav-evidence
sleep 300
clicktext Evidence
wait page-evidence 10000
sleep 2500
shot B22_web_evidence_list
testids evi
api GET /api/v1/evidence/EV-20261006-0015
