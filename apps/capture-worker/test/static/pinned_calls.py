#!/usr/bin/env python3
"""Pinned-call rule of the capture worker's C sources (blueprint row 61; decisions D84 R-6, D85 R-8,
pair-58 navigator B F-10; capture spec C.4, C.5; called by ../../check.sh).

WHY. The older rules of check.sh match SPELLINGS (`O_TRUNC`, `fopen(..., "w")`, `"use_editlist"`).
Fifteen evasions passed them: a call spelled another way, a flag masked out through a variable, the
pattern inside a comment, a string written in two pieces. This rule turns the question round:

  R-6   EVERY use of a function that creates, truncates, renames, links or removes a file is
        COUNTED AND PLACED: each call is pinned with its file and its whole argument text in
        pinned-calls.tsv, and each mention that is not a call (a function taken by name) is pinned by
        its count. A new one of ANY spelling, and a pinned one that changed, is refused.
  F-10  the same for every function that sets a muxer / demuxer option or commands the filter
        graph; and no forbidden option name stands in ANY string - adjacent string pieces are
        joined and string macros are resolved first - or in any identifier.

The sources are read as TOKENS: comments are dropped, strings and character constants are kept
apart from code, line continuations are joined. A pattern in a comment neither satisfies nor
breaks a rule.

RULES THAT DO NOT DEPEND ON THE TABLE (editing the table cannot make these pass):
  - open():  never O_TRUNC; O_CREAT only together with O_EXCL; the flags are O_* constants (not a
             variable, so no flag can be masked out), except for the literal "/dev/null";
  - fopen(): the mode is one string literal, without '+';
  - the functions of BANNED are not used at all, by call or by name;
  - av_dict_set / av_dict_set_int: the key is one string literal of the decided set;
  - av_dict_parse_string: its second argument is exactly g_mux_extra (the proof-build seam);
  - no token-paste operator (##): a name glued from two pieces is seen by no rule;
  - (fix pass F-M3, review R63-08) NO OTHER SPELLING OF THE PREPROCESSOR AND NO ASSEMBLER NAME:
    no digraph (`%:` is `#`, so `%:%:` is the token paste; `<:` `:>` `<%` `%>`), no trigraph
    (`??=` is `#` under -std=c11), no `asm` / `__asm__` (a label gives a C name another linker
    name: `int f(...) __asm__("_open")`), no `alias` / `weakref` attribute. The worker's sources
    use none of them, so they are refused outright;
  - avformat_alloc_output_context2: the muxer is the one string literal "mp4", and neither an
    output format object nor a file name is handed over (both NULL). Another muxer name
    ("segment", "tee", "hls") would open files of its own.

THE IMPORT NET (fix pass F-M3, review R63-08): `--imports <binary> <imports.pin>` reads what the
LINKED worker imports (`nm -u`) and holds the file-making functions among them to the pinned
list - whatever the spelling in the sources was. The Makefile runs it after every link of
build/capture-worker. This is the net that does not depend on reading C.

LIMITS (it is a tripwire, not a proof; the dynamic guards are sink_kill_test, writer_test, e2e):
  - a string built at run time (snprintf, strcat) is not read; it can reach the muxer only through
    a call this rule pins, whose text would have to change;
  - code reached through a header outside src/ (a macro of a system header that expands to one of
    these functions) is not seen by the token rules (the import net sees the function it ends in);
  - what libavformat itself opens is not this rule's: the worker hands it no file name (the camera
    files go through the worker's own write callback) and one muxer name, "mp4" (pinned above);
  - the import net sees FUNCTIONS, not arguments: a pinned function (open, fopen, rename, link,
    unlink, ftruncate) called a new way is the token rules' to find, not its;
  - a file-making function the import net does not watch (one that is not in FILE_MAKING), a system
    call made without a libc function the net watches, and code of ANOTHER library the worker
    links (libavformat, libavutil) are outside both nets;
  - the token rules are held on src/ only; the import net on build/capture-worker only - a proof
    build is not netted (the Core starts none).

usage:  pinned_calls.py <source dir> <table.tsv>     exit 0 when every rule holds; else one line
                                                     per violation ("R-6: ..." / "F-10: ...")
        pinned_calls.py --print <source dir>         the table rows of the sources as they are
        pinned_calls.py --imports <binary> <pin>     the import net over one linked binary
"""
import os
import re
import subprocess
import sys

FILE_MAKING = [
    'open', 'openat', 'creat', 'fopen', 'freopen', 'fdopen', 'truncate', 'ftruncate',
    'rename', 'renameat', 'renamex_np', 'renameatx_np', 'link', 'linkat', 'symlink', 'symlinkat',
    'unlink', 'unlinkat', 'remove', 'rmdir', 'mkdir', 'mkdirat', 'mkfifo', 'mknod',
    'mkstemp', 'mkostemp', 'mkstemps', 'mktemp', 'tmpfile', 'tmpnam',
    'copyfile', 'fcopyfile', 'clonefile', 'clonefileat', 'fclonefileat', 'exchangedata',
    'removefile', 'removefileat', 'open_dprotected_np', 'openat_dprotected_np', 'shm_open', 'shm_unlink',
    'avio_open', 'avio_open2',
    'syscall', '__syscall', 'dlsym', 'dlopen', 'system', 'popen', 'fork', 'vfork',
    'execl', 'execlp', 'execle', 'execv', 'execvp', 'execve', 'posix_spawn', 'posix_spawnp',
]
# Used nowhere in the worker, whatever the table says.
BANNED = set(FILE_MAKING) - {'open', 'fopen', 'ftruncate', 'rename', 'link', 'unlink'}
MUX = [
    'av_dict_set', 'av_dict_set_int', 'av_dict_parse_string', 'av_dict_copy',
    'av_opt_set', 'av_opt_set_int', 'av_opt_set_double', 'av_opt_set_q', 'av_opt_set_bin',
    'av_opt_set_dict', 'av_opt_set_dict2', 'av_opt_set_from_string', 'av_set_options_string',
    'avformat_write_header', 'avformat_init_output', 'avformat_alloc_output_context2',
    'avformat_open_input', 'avfilter_graph_send_command', 'avfilter_graph_queue_command',
    'avfilter_process_command', 'g_mux_extra',
]
MUX_BANNED = {'av_dict_copy', 'av_opt_set', 'av_opt_set_int', 'av_opt_set_double', 'av_opt_set_q', 'av_opt_set_bin',
              'av_opt_set_dict', 'av_opt_set_dict2', 'av_opt_set_from_string', 'av_set_options_string',
              'avformat_init_output', 'avfilter_graph_queue_command', 'avfilter_process_command'}
# Pinned by count and place only: their arguments name no option and no file.
ARGS_FREE = {'avformat_write_header', 'avformat_open_input', 'avfilter_graph_send_command'}
# Review R63-08: the one muxer the worker asks libavformat for. Another name could open files of its own.
MUXER_NAME = 'mp4'
# Review R63-08: other spellings of `#` / `##` and of a linker name. Adjacent punctuation tokens / identifiers.
DIGRAPHS = ['%:', '<:', ':>', '<%', '%>']
ASM_NAMES = {'asm', '__asm', '__asm__', 'alias', '__alias__', 'weakref', '__weakref__'}
DECIDED_KEYS = {'movflags', 'flush_packets', 'min_frag_duration', 'rtsp_flags', 'listen_timeout', 'protocol_whitelist'}
# Capture spec C.4 (erratum PE-111-02), register W1-C1, W-1, decision D72(d).
FORBIDDEN_NAMES = ['use_editlist', 'negative_cts_offsets', 'avoid_negative_ts', 'frag_type', 'default_prft',
                   'frag_start_number', 'rtsp_transport', 'delay_moov']
TAG = {name: 'R-6' for name in FILE_MAKING}
TAG.update({name: 'F-10' for name in MUX})

IDENT = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')
NUMBER = re.compile(r'\.?[0-9](?:[A-Za-z0-9_.]|[eEpP][+-])*')


def tokens_of(text):
    """(kind, value, start, end) for every token; comments dropped; kinds: id num str chr p."""
    text = text.replace('\\\r\n', '').replace('\\\n', '')
    out, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in ' \t\r\n\f\v':
            i += 1
        elif text.startswith('//', i):
            j = text.find('\n', i)
            i = n if j < 0 else j
        elif text.startswith('/*', i):
            j = text.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif c == '"' or c == "'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == '\\' else 1
            out.append(('str' if c == '"' else 'chr', text[i + 1:j], i, min(j + 1, n)))
            i = j + 1
        else:
            m = IDENT.match(text, i)
            if m:
                out.append(('id', m.group(), i, m.end()))
                i = m.end()
                continue
            m = NUMBER.match(text, i)
            if m:
                out.append(('num', m.group(), i, m.end()))
                i = m.end()
                continue
            if text.startswith('##', i):
                out.append(('p', '##', i, i + 2))
                i += 2
            else:
                out.append(('p', c, i, i + 1))
                i += 1
    return text, out


def spell(tokens):
    """The tokens of an argument list as one canonical text: the author's spacing does not count."""
    out = ''
    previous = None
    for kind, value, _, _ in tokens:
        piece = '"%s"' % value if kind == 'str' else "'%s'" % value if kind == 'chr' else value
        wordy = kind in ('id', 'num')
        if previous is not None and (previous == ',' or (wordy and previous == 'word')):
            out += ' '
        out += piece
        previous = 'word' if wordy else piece
    return out


def split_args(tokens):
    args, depth, current = [], 0, []
    for token in tokens:
        if token[0] == 'p' and token[1] in '([{':
            depth += 1
        elif token[0] == 'p' and token[1] in ')]}':
            depth -= 1
        if token[0] == 'p' and token[1] == ',' and depth == 0:
            args.append(current)
            current = []
        else:
            current.append(token)
    if current or args:
        args.append(current)
    return args


def call_end(tokens, at):
    """Index of the token that closes the parenthesis opened at tokens[at]."""
    depth = 0
    for k in range(at, len(tokens)):
        if tokens[k][0] == 'p' and tokens[k][1] == '(':
            depth += 1
        elif tokens[k][0] == 'p' and tokens[k][1] == ')':
            depth -= 1
            if depth == 0:
                return k
    return len(tokens) - 1


def string_macros(all_tokens_by_file, raw_by_file):
    """Object-like macros whose whole body is string literals: NAME -> joined text."""
    macros = {}
    for name, raw in raw_by_file.items():
        for line in raw.replace('\\\n', '').split('\n'):
            m = re.match(r'\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$', line)
            if not m:
                continue
            _, body = tokens_of(m.group(2))
            if body and all(token[0] == 'str' for token in body):
                macros[m.group(1)] = ''.join(token[1] for token in body)
    return macros


def scan(directory):
    """(observed calls {(file, fn, text): count}, mentions {(file, fn): count}, violations)."""
    raw, toks = {}, {}
    for name in sorted(os.listdir(directory)):
        if name.endswith('.c') or name.endswith('.h'):
            with open(os.path.join(directory, name), encoding='utf-8', errors='replace') as handle:
                raw[name] = handle.read()
            _, toks[name] = tokens_of(raw[name])
    macros = string_macros(toks, raw)
    calls, mentions, bad = {}, {}, []
    watched = set(FILE_MAKING) | set(MUX)

    for name, tokens in toks.items():
        # Token paste: a name glued from pieces is seen by no rule below.
        if any(token[0] == 'p' and token[1] == '##' for token in tokens):
            bad.append('R-6: %s: the token-paste operator ## is not used in the worker (a glued name is seen by no rule)' % name)
        # Review R63-08: the same operator in its other spellings, and a C name with another linker name.
        for (k1, v1, _, e1), (k2, v2, s2, _) in zip(tokens, tokens[1:]):
            if k1 == 'p' and k2 == 'p' and e1 == s2 and v1 + v2 in DIGRAPHS:
                bad.append('R-6: %s: the digraph %s is not used in the worker (%%:%%: is the token paste; a glued name is seen by no rule)' % (name, v1 + v2))
        if re.search(r"\?\?[=/'()!<>-]", raw[name]):
            bad.append('R-6: %s: a trigraph (??x) is not used in the worker (??= is # under -std=c11)' % name)
        for kind, value, _, _ in tokens:
            if kind == 'id' and value in ASM_NAMES:
                bad.append('R-6: %s: %s is not used in the worker (an assembler label or an alias gives a function another linker name: no rule would see what is called)' % (name, value))

        # Forbidden option names: in any identifier, and in any string after its pieces are joined.
        run = []
        joined = []
        for kind, value, _, _ in tokens + [('p', ';', 0, 0)]:
            if kind == 'str':
                run.append(value)
            elif kind == 'id' and value in macros:
                run.append(macros[value])
            else:
                if run:
                    joined.append(''.join(run))
                    run = []
                if kind == 'id':
                    for option in FORBIDDEN_NAMES:
                        if option in value:
                            bad.append('F-10: %s: forbidden mux option %s as an identifier (%s)' % (name, option, value))
        for text in joined:
            for option in FORBIDDEN_NAMES:
                if option in text:
                    bad.append('F-10: %s: forbidden mux option %s in a string (pieces joined, string macros resolved)' % (name, option))

        for index, (kind, value, _, _) in enumerate(tokens):
            if kind != 'id' or value not in watched:
                continue
            tag = TAG[value]
            # A member of a structure (`x.link`, `x->open`) is not the function.
            before = tokens[index - 1] if index else None
            if before and before[0] == 'p' and before[1] in '.>' and not (before[1] == '>' and (index < 2 or tokens[index - 2][1] != '-')):
                continue
            is_call = index + 1 < len(tokens) and tokens[index + 1][0] == 'p' and tokens[index + 1][1] == '('
            if not is_call:
                mentions[(name, value)] = mentions.get((name, value), 0) + 1
                if value in BANNED or value in MUX_BANNED:
                    bad.append('%s: %s: %s is named (not used by the worker, by call or by name)' % (tag, name, value))
                continue
            end = call_end(tokens, index + 1)
            inner = tokens[index + 2:end]
            args = split_args(inner)
            text = spell(inner)
            if value in BANNED or value in MUX_BANNED:
                bad.append('%s: %s: %s(%s) - this function is not used by the worker' % (tag, name, value, text))
            if value == 'open':
                flags = spell(args[1]) if len(args) > 1 else ''
                devnull = len(args) > 0 and len(args[0]) == 1 and args[0][0][0] == 'str' and args[0][0][1] == '/dev/null'
                if 'O_TRUNC' in flags:
                    bad.append('R-6: %s: open(%s) truncates' % (name, text))
                if 'O_CREAT' in flags and 'O_EXCL' not in flags:
                    bad.append('R-6: %s: open(%s) creates without O_EXCL' % (name, text))
                if not devnull and not re.fullmatch(r'O_[A-Z_]+(\|O_[A-Z_]+)*', flags):
                    bad.append('R-6: %s: open(%s) - the flags are not O_* constants (a flag could be masked out)' % (name, text))
            if value == 'fopen':
                mode = args[1] if len(args) > 1 else []
                if len(mode) != 1 or mode[0][0] != 'str' or '+' in mode[0][1]:
                    bad.append('R-6: %s: fopen(%s) - the mode is not one plain string literal' % (name, text))
            if value in ('av_dict_set', 'av_dict_set_int'):
                key = args[1] if len(args) > 1 else []
                if len(key) != 1 or key[0][0] != 'str' or key[0][1] not in DECIDED_KEYS:
                    bad.append('F-10: %s: %s(%s) - the option key is not one string literal of the decided set' % (name, value, text))
                    pinned = '*'
                else:
                    val = args[2] if len(args) > 2 else []
                    literal = len(val) == 1 and val[0][0] in ('str', 'id')
                    pinned = '"%s" = %s' % (key[0][1], spell(val) if literal else '*')
                text = pinned
            if value == 'av_dict_parse_string':
                if len(args) < 2 or spell(args[1]) != 'g_mux_extra':
                    bad.append('F-10: %s: av_dict_parse_string(%s) - its source is not the proof-build seam g_mux_extra' % (name, text))
            if value == 'avformat_alloc_output_context2':
                muxer = args[2] if len(args) > 2 else []
                if len(args) != 4 or spell(args[1]) != 'NULL' or spell(args[3]) != 'NULL' or len(muxer) != 1 or muxer[0][0] != 'str' or muxer[0][1] != MUXER_NAME:
                    bad.append('F-10: %s: avformat_alloc_output_context2(%s) - the muxer is not the one string literal "%s" with no format object and no file name' % (name, text, MUXER_NAME))
            if value in ARGS_FREE:
                text = '*'
            calls[(name, value, text)] = calls.get((name, value, text), 0) + 1
    return calls, mentions, bad


def rows_of(calls, mentions):
    rows = []
    for (name, fn, text), count in sorted(calls.items()):
        rows.extend(['%s\t%s\tcall\t%s' % (name, fn, text)] * count)
    for (name, fn), count in sorted(mentions.items()):
        rows.append('%s\t%s\tmention\t%d' % (name, fn, count))
    return rows


def imports_of(binary):
    """The undefined symbols of a linked binary as plain C names: no leading underscore, no $SUFFIX of the platform."""
    listing = subprocess.run(['nm', '-u', binary], capture_output=True, text=True)
    if listing.returncode != 0:
        return None
    names = set()
    for line in listing.stdout.splitlines():
        symbol = line.split()[-1] if line.split() else ''
        if symbol.startswith('_'):
            symbol = symbol[1:]
        names.add(symbol.split('$')[0])
    return names


def check_imports(binary, pin):
    """The import net: the watched file-making functions the binary imports are exactly the pinned ones."""
    names = imports_of(binary)
    if names is None:
        print('R-6: %s: the imports could not be read (nm -u)' % binary)
        return 1
    with open(pin, encoding='utf-8') as handle:
        pinned = {line.strip() for line in handle if line.strip() and not line.startswith('#')}
    bad = []
    if not pinned:
        bad.append('R-6: %s: the list of pinned imports is empty' % pin)
    for name in sorted(pinned - set(FILE_MAKING)):
        bad.append('R-6: %s: %s is pinned and is not a watched function' % (pin, name))
    seen = names & set(FILE_MAKING)
    for name in sorted(seen - pinned):
        bad.append('R-6: %s imports %s, which is not a pinned file-making function (%s) - whatever the sources spell' % (binary, name, pin))
    for name in sorted(pinned - seen):
        bad.append('R-6: %s no longer imports the pinned function %s: the pin is stale (a decision, like a row of pinned-calls.tsv)' % (binary, name))
    for line in bad:
        print(line)
    return 1 if bad else 0


def main(argv):
    if len(argv) == 4 and argv[1] == '--imports':
        return check_imports(argv[2], argv[3])
    if len(argv) == 3 and argv[1] == '--print':
        calls, mentions, _ = scan(argv[2])
        print('\n'.join(rows_of(calls, mentions)))
        return 0
    if len(argv) != 3:
        print(__doc__.strip().split('usage:')[1].strip())
        return 2
    calls, mentions, bad = scan(argv[1])
    pinned_calls, pinned_mentions = {}, {}
    with open(argv[2], encoding='utf-8') as handle:
        for line in handle:
            line = line.rstrip('\n')
            if not line or line.startswith('#'):
                continue
            name, fn, kind, text = line.split('\t', 3)
            if kind == 'mention':
                pinned_mentions[(name, fn)] = int(text)
            else:
                pinned_calls[(name, fn, text)] = pinned_calls.get((name, fn, text), 0) + 1
    for key in sorted(set(calls) | set(pinned_calls)):
        seen, want = calls.get(key, 0), pinned_calls.get(key, 0)
        name, fn, text = key
        if seen > want:
            bad.append('%s: %s: %d unpinned call(s) of %s(%s) - every such call is counted and placed' % (TAG[fn], name, seen - want, fn, text))
        elif seen < want:
            bad.append('%s: %s: the pinned call %s(%s) is gone or changed (%d of %d found)' % (TAG[fn], name, fn, text, seen, want))
    for key in sorted(set(mentions) | set(pinned_mentions)):
        seen, want = mentions.get(key, 0), pinned_mentions.get(key, 0)
        if seen != want:
            bad.append('%s: %s: %s is named %d time(s) outside a call, pinned %d (a function taken by name?)' % (TAG[key[1]], key[0], key[1], seen, want))
    if not pinned_calls:
        bad.append('R-6: the table of pinned calls is empty')
    for line in bad:
        print(line)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
