# Row W5 (wave 12, agent W5) - status: needs-review

Record: `implementation/w5_assign_with_profile_and_fault_state.md`. Decision C111, findings Q-01 and Q-02 of review 60d.

| Finding | Web console | Tablet |
|---|---|---|
| Q-01 a camera lost inside a session keeps "Live" | done | done; the D222 (2) format chip not touched, its pin passes unedited |
| Q-02 no client can assign a production camera | built behind a seam; NOT closed end to end | built behind a seam; NOT closed end to end |

Why Q-02 is not closed: the Core states a camera's stored profile list to no client. The contract's device entry (`CaptureDeviceStatusSchema`) is a strict object without the member and the typed client refuses an answer that carries it. Both clients read the member `profiles` of a device entry through one function each (`storedProfilesOf`); until it exists every production camera reads "no stored profile" and cannot be assigned from a screen.

Files written: see the closing line of row W5 in `file_claims.md`.

Checks: web 41 (new and extended) + 424 + 114 passed, typecheck and lint exit 0; tablet 122 (new and extended) + 730 + 305 passed, typecheck and lint exit 0. Five mutants seen red. No browser and no emulator check was made.

Existing expectations changed: none.

Requests (five lines "row W5" in `file_requests.md`): two BLOCKING for Q-02 (the contract member; the Core's slice), one ruling on a registered camera with an empty list (operation 108 stores nothing and no client wires it), one confirmation (the profile travels by operation 78: operation 79's body has no profile member), one information line.

Driver decisions: six, section 5 of the record.

Edit tool only for existing files; nothing committed.
