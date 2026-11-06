// A STAND-IN for a production program that WRITES TO STANDARD ERROR (task 4, masterplan 06 revision 3,
// row N5): a real operating-system process that the tests of the production door's observer of standard
// error start with `process.execPath`. It is NOT the audio helper and not the relay: it opens no port,
// reads no device and writes no file. The existing double (`production-door-double.mjs`) is not edited.
//
// A write to a pipe from this runtime does not return while the pipe is full: a mode that says it has
// written everything proves that the other end was READ the whole time.
//
// Its first argument is its mode. Every mode ends by staying until standard input ends, exit code 7.
//   bursts <first> <second>   writes <first> lines `line-<i>` to standard error, 100 at a time with a short
//                             pause between the pieces, then `one` to standard output. On SIGTERM (its order here, not its end) it writes <second> lines
//                             `more-<i>` and then `two` to standard output.
//   no-line-end <bytes>       writes <bytes> bytes to standard error with no line end among them, then
//                             `flushed <bytes>` to standard output.
//   flood <bytes>             writes lines `flood-<i>` to standard error until at least <bytes> bytes
//                             have gone, then `flushed <lines>` to standard output.
//   forever                   writes lines `forever-<i>` to standard error without end, and `tick` to
//                             standard output after every 4 MiB of them.
//   shapes                    writes the fixed lines of the bound and form cases, then `one`.
//
// Plain JavaScript with no import of the workspace.
const mode = process.argv[2];
const amount = (index) => Number.parseInt(process.argv[index] ?? '0', 10);

function stayUntilInputEnds() {
  process.stdin.on('end', () => process.exit(7));
  process.stdin.resume();
}
const flushed = (stream, data) => new Promise((done) => stream.write(data, () => done()));
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
/**
 * `count` lines with a prefix, written 100 lines at a time with 3 ms between the pieces: the reader gets them
 * over many turns of its event loop, so that what it has read can leave it between two pieces.
 */
async function lines(prefix, count) {
  let piece = '';
  for (let index = 0; index < count; index += 1) {
    piece += `${prefix}-${index}\n`;
    if ((index + 1) % 100 === 0 || index === count - 1) {
      await flushed(process.stderr, piece);
      piece = '';
      await pause(3);
    }
  }
}

if (mode === 'bursts') {
  process.on('SIGTERM', () => {
    void lines('more', amount(4)).then(() => flushed(process.stdout, 'two\n'));
  });
  stayUntilInputEnds();
  await lines('line', amount(3));
  await flushed(process.stdout, 'one\n');
} else if (mode === 'no-line-end') {
  stayUntilInputEnds();
  const piece = 'x'.repeat(65_536);
  let left = amount(3);
  while (left > 0) {
    const part = left >= piece.length ? piece : piece.slice(0, left);
    await flushed(process.stderr, part);
    left -= part.length;
  }
  await flushed(process.stdout, `flushed ${amount(3)}\n`);
} else if (mode === 'flood') {
  stayUntilInputEnds();
  let written = 0;
  let count = 0;
  while (written < amount(3)) {
    let piece = '';
    while (piece.length < 16_384) {
      piece += `flood-${count}\n`;
      count += 1;
    }
    await flushed(process.stderr, piece);
    written += piece.length;
  }
  await flushed(process.stdout, `flushed ${count}\n`);
} else if (mode === 'forever') {
  stayUntilInputEnds();
  let count = 0;
  let sinceTick = 0;
  for (;;) {
    let piece = '';
    while (piece.length < 65_536) {
      piece += `forever-${count}\n`;
      count += 1;
    }
    await flushed(process.stderr, piece);
    sinceTick += piece.length;
    if (sinceTick >= 4 * 1024 * 1024) {
      sinceTick = 0;
      await flushed(process.stdout, 'tick\n');
    }
  }
} else if (mode === 'shapes') {
  stayUntilInputEnds();
  const scheme = ['rt', 'sp'].join('');
  // A synthetic placeholder, built from parts so that no scan of the tree reads it as a credential.
  const userPart = ['someone', 'something'].join(':');
  const pieces = [
    Buffer.from(`${'a'.repeat(512)}\n`),
    Buffer.from(`${'b'.repeat(513)}\n`),
    Buffer.from(`${'c'.repeat(5_000)}\n`),
    Buffer.from('after\n'),
    // An escape sequence, a zero byte, a bell, a tab, a two-byte character and a direction override (three bytes).
    Buffer.concat([Buffer.from('esc\u001b[31mred'), Buffer.from([0x00, 0x07]), Buffer.from('\ttabé‮end\n')]),
    Buffer.from(['open ', scheme, '://', userPart, '@', '192.0.2.9/stream failed\n'].join('')),
    // The cut of the line bound (512) falls inside the user part of this locator.
    Buffer.from([`${'p'.repeat(490)} `, scheme, '://', userPart, '@', '192.0.2.9/stream\n'].join('')),
    Buffer.from('cr-one\rcr-two\r\n\n'),
    Buffer.from('last-without-end'),
  ];
  for (const piece of pieces) await flushed(process.stderr, piece);
  await flushed(process.stdout, 'one\n');
} else {
  process.exit(64);
}
