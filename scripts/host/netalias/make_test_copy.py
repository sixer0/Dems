"""Build step of the alias helper's TEST COPY (security item S13-16, point 1).

The file handed to the user, `dems-core-netalias`, holds its tool paths, its file paths and the
numbers of the peer-credential option as constants and has no other way to learn them: no
environment variable, no argument, no configuration key. A test therefore cannot point the
delivered file at stand-ins. This step makes the copy the tests run: the delivered text with
the values of its constants block replaced, and nothing else changed.

    from make_test_copy import make_test_copy
    make_test_copy(target_file, {"IP_TOOL": "/some/tmp/ip", ...})

Rules of the step:
  * every name of SUBSTITUTED must be given, and no other name;
  * each name is replaced exactly once, inside the constants block only;
  * the target must lie OUTSIDE this folder: a test copy never sits beside the delivered file
    and never enters the repository;
  * the step starts no process and installs nothing.
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DELIVERED = os.path.join(HERE, "dems-core-netalias")
BLOCK_BEGIN = "# --- CONSTANTS (begin) "
BLOCK_END = "# --- CONSTANTS (end) "

# The constants a test copy replaces. The service group, the bounds (minutes, the limit of marked
# addresses, the request size), the tool search path and the answer codes are NOT replaceable.
SUBSTITUTED = (
    "IP_TOOL",
    "ARPING_TOOL",
    "INTERFACE_FILE",
    "SYSFS_NET",
    "MARKS_DIR",
    "GROUP_FILE",
    "PASSWD_FILE",
    "TRUSTED_OWNER_UID",
    "PEER_OPTION_LEVEL",
    "PEER_OPTION_NAME",
    "PEER_STRUCT",
)


def read_delivered():
    with open(DELIVERED, "r", encoding="ascii", newline="") as handle:
        return handle.read()


def split_block(text):
    """(lines before the block, the block's lines, lines after it), the marker lines outside."""
    lines = text.split("\n")
    begins = [index for index, line in enumerate(lines) if line.startswith(BLOCK_BEGIN)]
    ends = [index for index, line in enumerate(lines) if line.startswith(BLOCK_END)]
    if len(begins) != 1 or len(ends) != 1 or begins[0] >= ends[0]:
        raise ValueError("the constants block is not found exactly once")
    return lines[: begins[0] + 1], lines[begins[0] + 1 : ends[0]], lines[ends[0] :]


def delivered_constants():
    """The constants of the delivered file as {name: value}, read as text, never executed."""
    values = {}
    for line in split_block(read_delivered())[1]:
        match = re.match(r"\A([A-Z_]+) = (.+)\Z", line)
        if match is not None:
            values[match.group(1)] = json.loads(match.group(2))
    return values


def make_test_copy(target, values):
    target = os.path.abspath(target)
    if os.path.commonpath([HERE, target]) == HERE:
        raise ValueError("a test copy is never written beside the delivered file")
    if sorted(values) != sorted(SUBSTITUTED):
        raise ValueError("exactly the names of SUBSTITUTED are replaced")
    before, block, after = split_block(read_delivered())
    replaced = []
    for index, line in enumerate(block):
        match = re.match(r"\A([A-Z_]+) = .+\Z", line)
        if match is None or match.group(1) not in values:
            continue
        value = values[match.group(1)]
        if isinstance(value, bool) or not isinstance(value, (str, int)):
            raise ValueError("a constant is a text or a whole number")
        block[index] = "%s = %s" % (match.group(1), json.dumps(value))
        replaced.append(match.group(1))
    if sorted(replaced) != sorted(SUBSTITUTED):
        raise ValueError("each constant is replaced exactly once")
    with open(target, "x", encoding="ascii", newline="") as handle:
        handle.write("\n".join(before + block + after))
    return target
