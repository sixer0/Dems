// A STAND-IN for a production program (task 4 blueprint row 21, WP-02): a real operating-system
// process that the tests of `src/capture/adapters/production-door.ts` start with `process.execPath`
// to prove what only a real process can prove. It is NOT the relay (rows 40 to 43) and not the
// audio helper: it opens no port, reads no device and writes no file.
//
// Its first argument is its mode:
//   report       reads standard input up to the first line feed, then writes ONE line of JSON to
//                standard output: its argument list, its environment (keys and values), the bytes it
//                read as hexadecimal text, and its own soft core-file limit. Then it stays until its
//                standard input ends and exits with code 7: the liveness rule of the door.
//   never-read   never reads its standard input and stays until it is killed.
//   exit-early   exits at once with code 3 and reads nothing.
//   echo-locator writes a line with a locator that carries a user part to both output streams,
//                then behaves as `report` without the report (the blanking of kept output).
//
// Plain JavaScript with no import of the workspace.
const mode = process.argv[2];

function stayUntilInputEnds() {
  process.stdin.on('end', () => process.exit(7));
  process.stdin.resume();
}

if (mode === 'exit-early') {
  process.exit(3);
} else if (mode === 'never-read') {
  setInterval(() => {}, 1_000);
} else if (mode === 'echo-locator') {
  const scheme = ['rt', 'sp'].join('');
  // A synthetic placeholder, built from parts so that no scan of the tree reads it as a credential.
  const userPart = ['someone', 'something'].join(':');
  const line = [scheme, '://', userPart, '@', '192.0.2.9/stream\n'].join('');
  process.stdout.write(line);
  process.stderr.write(line);
  stayUntilInputEnds();
} else if (mode === 'report') {
  const taken = [];
  const onData = (chunk) => {
    taken.push(chunk);
    const all = Buffer.concat(taken);
    const end = all.indexOf(0x0a);
    if (end === -1) return;
    process.stdin.off('data', onData);
    let coreSoft = null;
    try {
      coreSoft = process.report.getReport().userLimits.core_file_size_blocks.soft;
    } catch {
      coreSoft = null;
    }
    process.stdout.write(`${JSON.stringify({ argv: process.argv.slice(2), env: { ...process.env }, stdinHex: all.subarray(0, end + 1).toString('hex'), afterLine: all.length - end - 1, coreSoft })}\n`);
    stayUntilInputEnds();
  };
  process.stdin.on('data', onData);
} else {
  process.exit(64);
}
