# Row 21: preflight HOST-01..03, HOST-17, HOST-21

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 21 verbatim.

| Item | Output | Expected | Result |
|---|---|---|---|
| HOST-01 | `Ubuntu 24.04.1 LTS`, `x86_64` | same | PASS |
| HOST-02 | `0 unit files listed.`; `2` | same | PASS |
| HOST-03 | `root`, `sync`, `gsp-dems` | only these | PASS |
| HOST-17 | longest `comm` 37 (kernel worker threads such as `kworker/...-rtw_tx_wq` carry long names); 100 `args` lines with a full path | recorded, not judged | RECORDED |
| HOST-21 | `0` (no docker, containerd, libvirt, wireguard package) | `0` | PASS |
