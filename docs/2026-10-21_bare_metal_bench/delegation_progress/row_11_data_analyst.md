# Row 11 - data-analyst - applicability matrix

- Status: complete
- Output: research/03_analysis_applicability.md
- Verification: 56 HOST lines (grep `^| HOST-nn |` = 56, unique 56). N/A lines HOST-30, -44, -45, -46 each carry a reason. HOST-19..25 and HOST-46 cite masterplan/01_specs_rflex_host_docs.md:63-70 (row 93 landed 16:51 during this row; draft DEP defaults equalled its verdicts; 0 placeholders left).
- Counts: applicable 36, partial 5, deviation 11, N/A 4.
- Proposed deviations for the controller: PD-11-01 (HOST-05 writable paths in tree), PD-11-02 (HOST-06 W1), PD-11-03 (HOST-14 named target set), PD-11-04 (HOST-24 add 4432/5173), PD-11-05 (HOST-28 USB card only, by id), PD-11-06 (HOST-33 file G delta), PD-11-07 (HOST-34/54 + DB-05 DB settings in pg.env), PD-11-08 (/proc checks on tsx parent and child), PD-11-09 (HOST-53 port 4432).
- Findings: HOST-17 has no blueprint row (add to row 21). HOST-18/HOST-20 remain required (Core asks them at every Linux production start). Sound-server and apport states not surveyed (gaps for rows 37, 33).
- For row 96: R96-11-01..04 (service home = F-S1; 9A/H-07; name 9A/H-12; HOST-28 scope).
- No file request to the register. No host, code or git access.
- Open row-93 questions touching the matrix: F96-1 (HOST-19 network-manager equivalent, ends A8) and Q-R4 (HOST-46 reason).
