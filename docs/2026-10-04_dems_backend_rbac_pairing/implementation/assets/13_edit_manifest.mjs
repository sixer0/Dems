// W13 (npm slot N3): two exact text edits of apps/mobile/package.json. Fails if either anchor is not found once.
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'apps/mobile/package.json';
let text = readFileSync(file, 'utf8');
const edits = [
  [
    '    "expo-router": "~57.0.24",\n',
    '    "expo-router": "~57.0.24",\n    "expo-secure-store": "~57.0.4",\n',
  ],
  [
    '"reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081"',
    '"reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4420 tcp:4420"',
  ],
];
for (const [from, to] of edits) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor found ${n} times: ${from.trim()}`);
  text = text.replace(from, to);
}
JSON.parse(text);
writeFileSync(file, text);
console.log('manifest edited: expo-secure-store ~57.0.4 added; reverse script extended');
