// RECORDED, not written by hand (audit 2026-11-05, row 206: M3-15, G-11; R159-7). A COPY of the web console's
// `RECORDED_VERIFY_V2_D5` (apps/core-web/src/features/evidence/__tests__/fixtures/verify-v2-recorded.ts, the block
// appended by row 159): what the REAL verifier (`verifyPackageV2`, row 154) and the Core's `contractBodyOf` answer for
// three D5 packages (schema /2.1) of row 154's test builder (`buildPackage({ d5 })`: real bytes, AES-256-GCM, Ed25519
// of a throw-away key), each parsed by `EvidenceVerifyResultSchema` before it was written. Copied, not imported: the
// mobile jest does not resolve the web workspace. The bodies are byte-equal to the web block; only the two statement
// ends carry this app's semicolons. Regenerate: implementation/159_p2e_web_evidence.md (host script /tmp/r159_gen.mts),
// then copy again (implementation/206_m3_15_verify_bounds.md).
//
//   d5Pass               an untouched D5 package: four camera files and the four pair audio files AUDIO-01..04
//   d5MicMissing         MIC-02 not assigned: three audio files and the AUDIO_TRACKS_MISSING statement
//   d5AudioFileMissing   the audio file AUDIO-03 removed after sealing (V-04 AUDIO_FILE_MISSING)
//
// It holds no hash, no key and no path.
export type RecordedVerifyD5Name = 'd5Pass' | 'd5MicMissing' | 'd5AudioFileMissing';
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
};
