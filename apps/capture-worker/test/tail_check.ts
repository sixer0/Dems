/**
 * The tail validation of RECOVERY on one camera file, from the command line (blueprint row 59;
 * capture spec §C.5; check M3-KC-2). TEST TOOL of the capture e2e harness (`m3worker.py`): it
 * gives the product function `validateCameraFile` of the Core server
 * (`apps/core-server/src/capture/fragments.ts`) a file reader and Node's SHA-256, and prints the
 * verdict as one JSON object. It changes nothing on the disk.
 *
 *   npx tsx apps/capture-worker/test/tail_check.ts <camera file> [--records <file.json>]
 *
 * `--records`: a JSON array of the `FRAGMENT_CHECKPOINT` records the worker wrote for this camera
 * (the harness saves them from the frames). Without it the walk alone is reported.
 * Also reported: the `<camera file>.<pid>.part` names beside the file, each sorted into "a second
 * name of the camera file" (same inode) or "a file of its own" (pair-58 re-check R-5).
 */
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { classifyPartNames, validateCameraFile, type ByteSource, type NameFacts, type RecordedCheckpoint } from '../../core-server/src/capture/fragments';

const [file, flag, recordsPath] = process.argv.slice(2);
if (file === undefined || (flag !== undefined && (flag !== '--records' || recordsPath === undefined))) {
  process.stderr.write('usage: tail_check.ts <camera file> [--records <file.json>]\n');
  process.exit(2);
}

const facts = (path: string): NameFacts => {
  const stat = statSync(path, { bigint: true });
  return { name: basename(path), device: stat.dev, inode: stat.ino, size: Number(stat.size) };
};

async function main(file: string): Promise<void> {
const fd = openSync(file, 'r');
try {
  const source: ByteSource = {
    size: Number(fstatSync(fd).size),
    read: async (offset, length) => {
      const buffer = Buffer.alloc(length);
      let got = 0;
      while (got < length) {
        const n = readSync(fd, buffer, got, length - got, offset + got);
        if (n === 0) break;
        got += n;
      }
      return buffer.subarray(0, got);
    },
  };
  const recorded: RecordedCheckpoint[] | null =
    recordsPath === undefined
      ? null
      : (JSON.parse(readFileSync(recordsPath, 'utf8')) as Array<Record<string, unknown>>).map((record) => ({
          index: Number(record.index),
          start: Number(record.start),
          len: Number(record.len),
          fragSha256: String(record.fragSha256),
          chainSha256: String(record.chainSha256),
          prefixSha256: record.prefixSha256 === null || record.prefixSha256 === undefined ? null : String(record.prefixSha256),
        }));
  const started = process.hrtime.bigint();
  const verdict = await validateCameraFile(source, () => createHash('sha256'), recorded);
  const walkMs = Number(process.hrtime.bigint() - started) / 1e6;
  const parts = readdirSync(dirname(file))
    .filter((name) => name.startsWith(`${basename(file)}.`) && name.endsWith('.part'))
    .sort()
    .map((name) => facts(join(dirname(file), name)));
  const comparison = verdict.comparison;
  process.stdout.write(
    `${JSON.stringify({
      ok: verdict.ok,
      flags: verdict.flags,
      state: verdict.walk.state,
      fileLength: verdict.walk.fileLength,
      initLength: verdict.walk.initLength,
      durableLength: verdict.walk.durableLength,
      durablePrefixSha256: verdict.walk.durablePrefixSha256,
      tail: verdict.walk.tail,
      fragments: verdict.walk.fragments,
      comparison: comparison === null ? null : { verdict: comparison.verdict, matched: comparison.matched, firstMismatch: comparison.firstMismatch, unrecorded: comparison.unrecorded.length, missing: comparison.missing.length, lengthEqualsLastRecordedEnd: comparison.lengthEqualsLastRecordedEnd },
      partNames: classifyPartNames(facts(file), parts),
      walkMs: Math.round(walkMs * 1000) / 1000,
    })}\n`,
  );
} finally {
  closeSync(fd);
}
}

main(file).catch((error: unknown) => {
  process.stderr.write(`tail_check: ${String(error)}\n`);
  process.exit(1);
});
