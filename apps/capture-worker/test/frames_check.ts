/**
 * Every line a worker wrote to its standard output, decoded with the product decoder of
 * `@dems/capture-protocol` (blueprint row 71, worker half). TEST TOOL of the capture e2e harness
 * (`m5mic.py`): the C worker writes its frames by hand, and this is where they meet the schema the
 * Core reads them with - a null subject, a role as a subject, a warning without its reason or an
 * interval record off a chunk boundary is a line that does not decode.
 *
 *   npx tsx apps/capture-worker/test/frames_check.ts <file with one output line per line>
 *
 * Prints one JSON object: how many lines, how many decode, the first lines that do not, and the
 * record sequence (1, 2, 3 ... without a gap). It changes nothing on the disk.
 */
import { readFileSync } from 'node:fs';
import { CAPTURE_PROTOCOL_VERSION, decodeWorkerLine } from '../../../packages/capture-protocol/src/index';

const [file] = process.argv.slice(2);
if (file === undefined) {
  process.stderr.write('usage: frames_check.ts <lines file>\n');
  process.exit(2);
}
const lines = readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '');
const refused: Array<{ line: number; violation: string; text: string }> = [];
const byType: Record<string, number> = {};
const sequence: number[] = [];
lines.forEach((line, index) => {
  const decoded = decodeWorkerLine(line);
  if (!decoded.ok) {
    if (refused.length < 5) refused.push({ line: index + 1, violation: decoded.violation, text: line.slice(0, 300) });
    byType.REFUSED = (byType.REFUSED ?? 0) + 1;
    return;
  }
  byType[decoded.message.type] = (byType[decoded.message.type] ?? 0) + 1;
  if (decoded.message.type === 'RECORD') sequence.push(decoded.message.seq);
});
const gapless = sequence.every((seq, index) => seq === index + 1);
process.stdout.write(`${JSON.stringify({ protocolVersion: CAPTURE_PROTOCOL_VERSION, lines: lines.length, decoded: lines.length - (byType.REFUSED ?? 0), refused, byType, records: sequence.length, recordSequenceGapless: gapless })}\n`);
