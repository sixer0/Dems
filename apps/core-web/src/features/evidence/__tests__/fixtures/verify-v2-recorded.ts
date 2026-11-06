// RECORDED, not written by hand (blueprint rows 87 and 92): what the REAL verifier of row 85
// (`verifyPackageV2` of @dems/shared/evidence-verify, through the Core's `corePorts`) and the Core's
// `contractBodyOf` answer for six packages of row 85's own test builder (real bytes, SHA-256,
// fragment chain, AES-256-GCM, Ed25519 of a throw-away key), as operation 41 carries it since
// row 141 (the report members `overall`, `interrupted`, `checks` V-01 to V-15, `fragments`,
// `failedFragmentCount`, `transcriptState`, `sources`):
//
//   pass               an untouched package (the builder's sources are FAKE: a development package)
//   tamperedFragment   one byte of VIDEO-02 fragment 3 inverted after sealing (the EV-0005 v2 script)
//   disabled           a package whose transcript is disabled by configuration
//   development        this Mac's camera and microphone in slot 1, the test sources in slot 2
//   production         every source declared PRODUCTION (rows written by hand: no builder makes them)
//   untrusted          a development package with one source class edited after sealing
//
// It holds no hash, no key and no path. Regenerate: implementation/45_m8_playback_ui.md
// (script .cache/row92/gen-fixture.mts).
export type RecordedVerifyName = 'pass' | 'tamperedFragment' | 'disabled' | 'development' | 'production' | 'untrusted'
export const RECORDED_VERIFY_V2: Record<RecordedVerifyName, { label: string; body: Record<string, unknown> }> = {
  "pass": {
    "label": "untouched package of the test builder (its sources are FAKE: a development package)",
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
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES — this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-01",
            "sourceClass": "FAKE"
          },
          {
            "seq": 2,
            "micDeviceId": "MIC-02",
            "sourceClass": "FAKE"
          }
        ]
      }
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
      "signatureOk": true,
      "overall": "TAMPERED",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
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
      "failedFragmentCount": 1,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES — this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-01",
            "sourceClass": "FAKE"
          },
          {
            "seq": 2,
            "micDeviceId": "MIC-02",
            "sourceClass": "FAKE"
          }
        ]
      }
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
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "DISABLED_BY_CONFIGURATION",
        "report": "Transcript disabled by configuration",
        "sealedState": "DISABLED",
        "reason": "DISABLED_BY_CONFIGURATION",
        "documentSealed": false,
        "failedChunks": null,
        "backendUnreachable": false
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES — this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-01",
            "sourceClass": "FAKE"
          },
          {
            "seq": 2,
            "micDeviceId": "MIC-02",
            "sourceClass": "FAKE"
          }
        ]
      }
    }
  },
  "development": {
    "label": "this Mac's camera and microphone in slot 1, test sources in slot 2",
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
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES — this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-03",
            "sourceClass": "LOCAL_DEVICE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-03",
            "sourceClass": "LOCAL_DEVICE"
          },
          {
            "seq": 2,
            "micDeviceId": "MIC-02",
            "sourceClass": "FAKE"
          }
        ]
      }
    }
  },
  "production": {
    "label": "every source declared PRODUCTION (rows written by hand: no builder makes them in this phase)",
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
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "sources": {
        "ok": true,
        "code": "DECLARED_PRODUCTION",
        "development": false,
        "report": "Sources: declared as production devices by the Core that sealed this package.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-07",
            "sourceClass": "PRODUCTION"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-08",
            "sourceClass": "PRODUCTION"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-07",
            "sourceClass": "PRODUCTION"
          },
          {
            "seq": 2,
            "micDeviceId": "MIC-08",
            "sourceClass": "PRODUCTION"
          }
        ]
      }
    }
  },
  "untrusted": {
    "label": "development package, one source class edited after sealing",
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
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "transcriptOk": true,
      "manifestOk": false,
      "signatureOk": true,
      "overall": "TAMPERED",
      "interrupted": false,
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
          "status": "FAIL",
          "failureClass": "TAMPERED",
          "skipped": null,
          "findings": [
            {
              "code": "MANIFEST_HASH_MISMATCH",
              "failureClass": "TAMPERED",
              "member": "manifestSha256"
            }
          ]
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "NOT_TRUSTWORTHY",
        "report": "Transcript state: not trustworthy — the manifest was altered",
        "sealedState": null,
        "reason": null,
        "documentSealed": null,
        "failedChunks": null,
        "backendUnreachable": null
      },
      "sources": {
        "ok": true,
        "code": "NOT_TRUSTWORTHY",
        "development": null,
        "report": "Sources: not trustworthy — the manifest was altered",
        "tracks": [],
        "audioIntervals": []
      }
    }
  }
}

// Audit 2026-11-05 row 159 (D5; D119): RECORDED the same way - the REAL verifier (`verifyPackageV2`, row 154) and the
// Core's `contractBodyOf` over three packages of row 154's test builder (`buildPackage({ d5 })`, real bytes, AES-256-GCM,
// Ed25519 of a throw-away key), each parsed by `EvidenceVerifyResultSchema` before it was written. Regenerate:
// implementation/159_p2e_web_evidence.md (host script /tmp/r159_gen.mts).
export type RecordedVerifyD5Name = 'd5Pass' | 'd5MicMissing' | 'd5AudioFileMissing'
export const RECORDED_VERIFY_V2_D5: Record<RecordedVerifyD5Name, { label: string; body: Record<string, unknown> }> = {
  "d5Pass": {
    "label": "an untouched D5 package (schema /2.1): four camera files and the four pair audio files AUDIO-01..04",
    "body": {
      "evidenceId": "EV-20261009-0001",
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
        },
        {
          "fileId": "fragments/VIDEO-03.mp4",
          "trackId": "VIDEO-03",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-04.mp4",
          "trackId": "VIDEO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-01.m4a",
          "trackId": "AUDIO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-02.m4a",
          "trackId": "AUDIO-02",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-03.m4a",
          "trackId": "AUDIO-03",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-04.m4a",
          "trackId": "AUDIO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "transcriptOk": true,
      "manifestOk": true,
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "transcriptModel": {
        "name": "example-model",
        "version": "0",
        "quantisation": "none",
        "modelSha256": "4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf",
        "reportedByServer": false,
        "report": "Transcript model: example-model, version 0 (declared by the installation), quantisation none, file SHA-256 4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf"
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-03",
            "deviceId": "CAM-03",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-04",
            "deviceId": "CAM-04",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-03",
            "sourceClass": "FAKE"
          }
        ]
      },
      "signature": {
        "developmentKey": false
      },
      "notices": [
        {
          "code": "AUDIT_EXTRACT_NOT_SIGNED",
          "report": "Audit extract: present, NOT covered by the package signature."
        }
      ]
    }
  },
  "d5MicMissing": {
    "label": "a D5 package whose MIC-02 was not assigned: three audio files and the missing-microphone statement (AUDIO_TRACKS_MISSING)",
    "body": {
      "evidenceId": "EV-20261009-0001",
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
        },
        {
          "fileId": "fragments/VIDEO-03.mp4",
          "trackId": "VIDEO-03",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-04.mp4",
          "trackId": "VIDEO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-01.m4a",
          "trackId": "AUDIO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-03.m4a",
          "trackId": "AUDIO-03",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-04.m4a",
          "trackId": "AUDIO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "transcriptOk": true,
      "manifestOk": true,
      "signatureOk": true,
      "overall": "PASS",
      "interrupted": false,
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
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "transcriptModel": {
        "name": "example-model",
        "version": "0",
        "quantisation": "none",
        "modelSha256": "4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf",
        "reportedByServer": false,
        "report": "Transcript model: example-model, version 0 (declared by the installation), quantisation none, file SHA-256 4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf"
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-03",
            "deviceId": "CAM-03",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-04",
            "deviceId": "CAM-04",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-03",
            "sourceClass": "FAKE"
          }
        ]
      },
      "signature": {
        "developmentKey": false
      },
      "notices": [
        {
          "code": "AUDIT_EXTRACT_NOT_SIGNED",
          "report": "Audit extract: present, NOT covered by the package signature."
        },
        {
          "code": "AUDIO_TRACKS_MISSING",
          "report": "Audio: 1 PAIR MICROPHONE NOT RECORDED. AUDIO-02 not assigned, VIDEO-02 silent. Its silent track is no sound of the room."
        }
      ]
    }
  },
  "d5AudioFileMissing": {
    "label": "a D5 package with fragments/AUDIO-03.m4a deleted after sealing (V-04 AUDIO_FILE_MISSING, V-14 DECLARED_FILE_MISSING)",
    "body": {
      "evidenceId": "EV-20261009-0001",
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
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-03.mp4",
          "trackId": "VIDEO-03",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/VIDEO-04.mp4",
          "trackId": "VIDEO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-01.m4a",
          "trackId": "AUDIO-01",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-02.m4a",
          "trackId": "AUDIO-02",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        },
        {
          "fileId": "fragments/AUDIO-03.m4a",
          "trackId": "AUDIO-03",
          "storedOk": false,
          "plainOk": false,
          "plainChecked": false,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": false
        },
        {
          "fileId": "fragments/AUDIO-04.m4a",
          "trackId": "AUDIO-04",
          "storedOk": true,
          "plainOk": true,
          "chainOk": true,
          "fragmentCount": 5,
          "ok": true
        }
      ],
      "transcriptOk": true,
      "manifestOk": false,
      "signatureOk": true,
      "overall": "MISSING",
      "interrupted": false,
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
          "failureClass": "MISSING",
          "skipped": null,
          "findings": [
            {
              "code": "AUDIO_FILE_MISSING",
              "failureClass": "MISSING",
              "trackId": "AUDIO-03",
              "file": "fragments/AUDIO-03.m4a"
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
          "status": "FAIL",
          "failureClass": "MISSING",
          "skipped": null,
          "findings": [
            {
              "code": "DECLARED_FILE_MISSING",
              "failureClass": "MISSING",
              "file": "fragments/AUDIO-03.m4a"
            }
          ]
        },
        {
          "id": "V-15",
          "name": "Source class",
          "status": "PASS",
          "failureClass": null,
          "skipped": null,
          "findings": []
        }
      ],
      "fragments": [],
      "failedFragmentCount": 0,
      "transcriptState": {
        "code": "READY",
        "report": "Transcript sealed",
        "sealedState": "ASSEMBLED",
        "reason": null,
        "documentSealed": true,
        "failedChunks": 0,
        "backendUnreachable": false
      },
      "transcriptModel": {
        "name": "example-model",
        "version": "0",
        "quantisation": "none",
        "modelSha256": "4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf",
        "reportedByServer": false,
        "report": "Transcript model: example-model, version 0 (declared by the installation), quantisation none, file SHA-256 4f2f8ef83a57eecff104f8c28c25bde6788fdca30c2b00c7cab19a38d3267bdf"
      },
      "sources": {
        "ok": true,
        "code": "DEVELOPMENT",
        "development": true,
        "report": "DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.",
        "tracks": [
          {
            "trackId": "VIDEO-01",
            "deviceId": "CAM-01",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-02",
            "deviceId": "CAM-02",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-03",
            "deviceId": "CAM-03",
            "sourceClass": "FAKE"
          },
          {
            "trackId": "VIDEO-04",
            "deviceId": "CAM-04",
            "sourceClass": "FAKE"
          }
        ],
        "audioIntervals": [
          {
            "seq": 1,
            "micDeviceId": "MIC-03",
            "sourceClass": "FAKE"
          }
        ]
      },
      "signature": {
        "developmentKey": false
      },
      "notices": [
        {
          "code": "AUDIT_EXTRACT_NOT_SIGNED",
          "report": "Audit extract: present, NOT covered by the package signature."
        }
      ]
    }
  }
}
