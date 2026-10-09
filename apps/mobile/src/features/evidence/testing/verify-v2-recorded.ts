// RECORDED, not written by hand (blueprint row 87): what the REAL verifier of row 85
// (`verifyPackageV2` of @dems/shared/evidence-verify, through the Core's `corePorts`) and the Core's
// `contractBodyOf` answered for three packages of row 85's own test builder (real bytes, SHA-256,
// fragment chain, AES-256-GCM, Ed25519 of a throw-away key):
//
//   pass               an untouched package
//   tamperedFragment   one byte of VIDEO-02 fragment 3 inverted after sealing (the EV-0005 v2 script)
//   disabled           a package whose transcript is disabled by configuration
//
// `body` is the answer of operation 41 as the contract carries it TODAY. `report` is the full
// `PackageVerifyResult`; its members `overall`, `interrupted`, `checks`, `fragments` and
// `transcriptState` are the PENDING members of the op 41 answer. It holds no hash, no key and no path.
// Regenerate: see implementation/42_m7_clients_verify.md §6 (script .cache/row87/gen-fixture.mts).
export const RECORDED_VERIFY_V2: Record<'pass' | 'tamperedFragment' | 'disabled', { label: string; body: Record<string, unknown>; report: Record<string, unknown> }> = {
  "pass": {
    "label": "pass",
    "body": {
      "evidenceId": "EV-20261009-0005",
      "ok": true,
      "at": 1791500000000,
      "tracks": [],
      "files": [
        {
          "fileId": "fragments/VIDEO-01.mp4",
          "trackId": "VIDEO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-02.mp4",
          "trackId": "VIDEO-02",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "transcriptOk": true,
      "manifestOk": true,
      "signatureOk": true
    },
    "report": {
      "schema": "dems.verify-result/2",
      "ok": true,
      "overall": "PASS",
      "checks": [
        {
          "id": "V-01",
          "name": "Manifest structure",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-02",
          "name": "Manifest internal consistency",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-03",
          "name": "Manifest hash",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-04",
          "name": "Per-fragment stored-bytes hash",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-05",
          "name": "Plaintext hash after decryption",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-06",
          "name": "Chain-hash continuity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-07",
          "name": "Sequence contiguity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-08",
          "name": "One-fragment tamper expectation",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-09",
          "name": "Signature verification",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-10",
          "name": "Transcript hash match",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-11",
          "name": "Revision signatures",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-12",
          "name": "Interrupted-seal flag",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-13",
          "name": "Certificate validity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-14",
          "name": "File completeness",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "files": [
        {
          "trackId": "VIDEO-01",
          "file": "fragments/VIDEO-01.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "chainBrokenFromSeq": null,
          "fragments": []
        },
        {
          "trackId": "VIDEO-02",
          "file": "fragments/VIDEO-02.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "chainBrokenFromSeq": null,
          "fragments": []
        }
      ],
      "fragments": [],
      "transcript": {
        "state": "VERIFIED",
        "revisions": 0
      },
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "signature": {
        "ok": true,
        "algorithm": "Ed25519",
        "keyId": "CORE-KEY-EVSIGN-01",
        "simulated": false,
        "integrityCheckedWithoutKey": true
      },
      "interrupted": false,
      "plaintextChecked": true
    }
  },
  "tamperedFragment": {
    "label": "VIDEO-02 seq 3, one byte",
    "body": {
      "evidenceId": "EV-20261009-0005",
      "ok": false,
      "at": 1791500000000,
      "tracks": [],
      "files": [
        {
          "fileId": "fragments/VIDEO-01.mp4",
          "trackId": "VIDEO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-02.mp4",
          "trackId": "VIDEO-02",
          "storedOk": false,
          "plainOk": false,
          "chainOk": false,
          "fragmentCount": 5,
          "ok": false
        }
      ],
      "transcriptOk": true,
      "manifestOk": true,
      "signatureOk": true
    },
    "report": {
      "schema": "dems.verify-result/2",
      "ok": false,
      "overall": "TAMPERED",
      "checks": [
        {
          "id": "V-01",
          "name": "Manifest structure",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-02",
          "name": "Manifest internal consistency",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-03",
          "name": "Manifest hash",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-04",
          "name": "Per-fragment stored-bytes hash",
          "status": "FAIL",
          "failureClass": "TAMPERED",
          "skipped": null,
          "findings": [
            {
              "code": "FRAGMENT_HASH_MISMATCH",
              "failureClass": "TAMPERED",
              "trackId": "VIDEO-02",
              "seq": 3
            },
            {
              "code": "FILE_HASH_MISMATCH",
              "failureClass": "TAMPERED",
              "trackId": "VIDEO-02",
              "file": "fragments/VIDEO-02.mp4"
            }
          ]
        },
        {
          "id": "V-05",
          "name": "Plaintext hash after decryption",
          "status": "SKIPPED",
          "failureClass": null,
          "skipped": "BLOCKED",
          "findings": []
        },
        {
          "id": "V-06",
          "name": "Chain-hash continuity",
          "status": "FAIL",
          "failureClass": "TAMPERED",
          "skipped": null,
          "findings": [
            {
              "code": "CHAIN_BROKEN",
              "failureClass": "TAMPERED",
              "trackId": "VIDEO-02",
              "seq": 3
            }
          ]
        },
        {
          "id": "V-07",
          "name": "Sequence contiguity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-08",
          "name": "One-fragment tamper expectation",
          "status": "FAIL",
          "failureClass": "TAMPERED",
          "skipped": null,
          "findings": [
            {
              "code": "FRAGMENT_TAMPERED",
              "failureClass": "TAMPERED",
              "trackId": "VIDEO-02",
              "seq": 3
            }
          ]
        },
        {
          "id": "V-09",
          "name": "Signature verification",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-10",
          "name": "Transcript hash match",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-11",
          "name": "Revision signatures",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-12",
          "name": "Interrupted-seal flag",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-13",
          "name": "Certificate validity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-14",
          "name": "File completeness",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "files": [
        {
          "trackId": "VIDEO-01",
          "file": "fragments/VIDEO-01.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "chainBrokenFromSeq": null,
          "fragments": []
        },
        {
          "trackId": "VIDEO-02",
          "file": "fragments/VIDEO-02.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": false,
          "plainOk": null,
          "chainOk": false,
          "chainBrokenFromSeq": 3,
          "fragments": [
            {
              "trackId": "VIDEO-02",
              "seq": 3,
              "ok": false,
              "reason": "TAMPERED",
              "storedOk": false,
              "plainOk": null
            }
          ]
        }
      ],
      "fragments": [
        {
          "trackId": "VIDEO-02",
          "seq": 3,
          "ok": false,
          "reason": "TAMPERED",
          "storedOk": false,
          "plainOk": null
        }
      ],
      "transcript": {
        "state": "VERIFIED",
        "revisions": 0
      },
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "signature": {
        "ok": true,
        "algorithm": "Ed25519",
        "keyId": "CORE-KEY-EVSIGN-01",
        "simulated": false,
        "integrityCheckedWithoutKey": true
      },
      "interrupted": false,
      "plaintextChecked": false
    }
  },
  "disabled": {
    "label": "transcript DISABLED",
    "body": {
      "evidenceId": "EV-20261009-0005",
      "ok": true,
      "at": 1791500000000,
      "tracks": [],
      "files": [
        {
          "fileId": "fragments/VIDEO-01.mp4",
          "trackId": "VIDEO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-02.mp4",
          "trackId": "VIDEO-02",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "manifestOk": true,
      "signatureOk": true
    },
    "report": {
      "schema": "dems.verify-result/2",
      "ok": true,
      "overall": "PASS",
      "checks": [
        {
          "id": "V-01",
          "name": "Manifest structure",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-02",
          "name": "Manifest internal consistency",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-03",
          "name": "Manifest hash",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-04",
          "name": "Per-fragment stored-bytes hash",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-05",
          "name": "Plaintext hash after decryption",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-06",
          "name": "Chain-hash continuity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-07",
          "name": "Sequence contiguity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-08",
          "name": "One-fragment tamper expectation",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-09",
          "name": "Signature verification",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-10",
          "name": "Transcript hash match",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-11",
          "name": "Revision signatures",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-12",
          "name": "Interrupted-seal flag",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-13",
          "name": "Certificate validity",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        },
        {
          "id": "V-14",
          "name": "File completeness",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "files": [
        {
          "trackId": "VIDEO-01",
          "file": "fragments/VIDEO-01.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "chainBrokenFromSeq": null,
          "fragments": []
        },
        {
          "trackId": "VIDEO-02",
          "file": "fragments/VIDEO-02.mp4",
          "fragmentCount": 5,
          "sequenceOk": true,
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "chainBrokenFromSeq": null,
          "fragments": []
        }
      ],
      "fragments": [],
      "transcript": {
        "state": "DISABLED",
        "revisions": null
      },
      "transcriptState": {
        "code": "DISABLED_BY_CONFIGURATION",
        "report": "Transcript disabled by configuration",
        "sealedState": "DISABLED",
        "reason": "DISABLED_BY_CONFIGURATION",
        "documentSealed": false,
        "failedChunks": null,
        "backendUnreachable": false
      },
      "signature": {
        "ok": true,
        "algorithm": "Ed25519",
        "keyId": "CORE-KEY-EVSIGN-01",
        "simulated": false,
        "integrityCheckedWithoutKey": true
      },
      "interrupted": false,
      "plaintextChecked": true
    }
  }
};
