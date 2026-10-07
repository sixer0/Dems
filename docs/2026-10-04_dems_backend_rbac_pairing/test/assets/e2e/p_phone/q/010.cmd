mark a06
p tap 539 2278
sleep 2500
p screen evidence
p shot 08_evidence_list
p ids ^(evidence|screen)-
serverlog a06
w1 api GET /api/v1/evidence?limit=4
