# Row 49: console forward with probe

Date: 2026-10-22, host .73 (D35). Forward from the user's Windows workstation (the runbook's "Mac" side):
`ssh -o ExitOnForwardFailure=yes -N -L 127.0.0.1:5173:127.0.0.1:5173 dems` (alias `dems` = gsp-dems@192.168.0.73 with key ~/.ssh/id_gsp_dems), browser at `http://127.0.0.1:5173`.
Probe: local port 5173 free `0`; `200`; `<title>` `1`; `/api/v1/health` through the proxy `200`; ufw ALLOW lines `10` (equal to row 36). The probe forward was stopped; a forward for rows 50-51 runs in the user's terminal tab "DEMS console forward".
