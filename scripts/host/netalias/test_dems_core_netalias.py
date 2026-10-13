"""Tests of the alias helper `dems-core-netalias` (task 4, blueprint row 104; S13-08, S13-16 (1)).

Run from the repository root, one file, no network, no privilege:

    python3 -I -B scripts/host/netalias/test_dems_core_netalias.py

WHAT RUNS. Never the delivered file's tools. Each test builds a TEST COPY of the helper with
`make_test_copy.py` in a temporary folder outside the repository; in the copy the two tool paths
point at a RECORDING DOUBLE, and the interface file, the kernel's interface list, the marks
folder and the account files point into the same temporary folder. The double writes the exact
argument vector, the environment and the working folder it was given to `calls.jsonl` and answers
from `plan.json`. No `ip`, no `arping`, no `sudo` and no command that touches an interface is
started by this file; an unplanned call answers 97 and is still recorded.

The caller is real: standard input of the helper is one end of a local socket pair, and the test
copy reads the kernel's peer credential of it (on this Mac with the numbers of the local-socket
option of macOS, which the build step puts in place of the Linux ones).

WHAT THIS DOES NOT PROVE. Anything on Linux: the real tools, the real option numbers, the socket
unit, the service unit. That is hardware check 9A/H-05, H-06 and H-25.

THE TEXTS OF THE DOUBLE ARE NOT CAPTURES OF A HOST (agent H2, cautions R119-01 and R119-02). The
three result lines of the conflict-check program (FREE_TEXT, TAKEN_TEXT), the flag words of an
interface, the member `valid_life_time` of an address and the two record files of the package
manager are written here as the helper EXPECTS them. One text was measured (the container of
test/079): `Interface "lo" is not ARPable` with exit status 0. Where a host prints another form,
the helper refuses (it never adds on a text it does not know) and check 9A/H-25 shows it.
"""

import hashlib
import json
import os
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_test_copy as build  # noqa: E402

DELIVERED = os.path.join(HERE, "dems-core-netalias")
DELIVERY = ("dems-core-netalias", "dems-core-netalias.socket", "dems-core-netalias@.service")
JOURNAL = re.compile(
    r"\Adems-core-netalias: caller_uid=([0-9]+|-) verb=(add|del|check|-) "
    r"address=(-|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/24) result=([A-Z0-9_]+) code=([0-9]+)"
    r"( note=already-absent)?\n\Z"
)

DOUBLE = """#!%s -ISB
import json, os, sys
here = os.path.dirname(os.path.abspath(sys.argv[0]))
name = os.path.basename(sys.argv[0])
with open(os.path.join(here, "calls.jsonl"), "a") as log:
    log.write(json.dumps({"tool": name, "argv": sys.argv[1:], "env": dict(os.environ), "cwd": os.getcwd()}) + "\\n")
with open(os.path.join(here, "plan.json")) as handle:
    plan = json.load(handle)
for rule in plan:
    if rule["tool"] == name and sys.argv[1 : 1 + len(rule["prefix"])] == rule["prefix"]:
        sys.stdout.write(rule.get("stdout", "").replace("@LAST@", sys.argv[-1]))
        sys.stdout.flush()
        os._exit(rule["exit"])
os._exit(97)
"""

ROUTE = ["-json", "-4", "route", "show", "default"]
ADDRS = ["-json", "-4", "addr", "show"]
CAMERA = "eth1"
OFFICE = "eth0"


def codes():
    """The closed set of answer codes, read from the delivered text (the file is never imported)."""
    with open(DELIVERED, encoding="ascii") as handle:
        body = re.search(r"^CODES = \{\n(.*?)^\}\n", handle.read(), re.M | re.S).group(1)
    return {name: int(number) for name, number in re.findall(r'^\s+"([A-Z0-9_]+)": ([0-9]+),$', body, re.M)}


CODES = codes()


ETHERNET_UP = ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"]
LOOPBACK_UP = ["LOOPBACK", "UP", "LOWER_UP"]
FOREVER = 4294967295
# What the conflict-check double prints; "@LAST@" becomes its last argument, the address asked.
FREE_TEXT = "ARPING @LAST@ from 0.0.0.0 eth1\nSent 2 probes (2 broadcast(s))\nReceived 0 response(s)\n"
TAKEN_TEXT = ("ARPING @LAST@ from 0.0.0.0 eth1\nUnicast reply from @LAST@ [00:11:22:33:44:55]  0.652ms\n"
              "Sent 1 probes (1 broadcast(s))\nReceived 1 response(s)\n")
NOT_ARPABLE_TEXT = 'Interface "eth1" is not ARPable\n'  # the measured answer of test/079, with exit status 0


def address_info(local, prefix, lifetime=FOREVER):
    """One address as the listing gives it. `lifetime` None: the listing does not state one."""
    info = {"family": "inet", "local": local, "prefixlen": prefix}
    if lifetime is not None:
        info["valid_life_time"] = info["preferred_life_time"] = lifetime
    return info


def link(name, *addresses, flags=None):
    """One interface of `ip -json -4 addr show`. An address is (local, prefix) or (local, prefix, lifetime)."""
    if flags is None:
        flags = LOOPBACK_UP if name == "lo" else ETHERNET_UP
    return {"ifname": name, "flags": flags, "addr_info": [address_info(*address) for address in addresses]}


class Bench:
    """One temporary installation: doubles, files, marks, a test copy of the helper."""

    def __init__(self, case, trusted_uid=None, service_uid=None):
        self.case = case
        self.root = os.path.realpath(tempfile.mkdtemp(prefix="netalias-"))
        case.addCleanup(shutil.rmtree, self.root, True)
        for name in ("tools", "etc", "sys", "run/marks", "copy", "decoy", "dpkg"):
            os.makedirs(os.path.join(self.root, name))
        os.chmod(os.path.join(self.root, "run/marks"), 0o755)
        os.chmod(os.path.join(self.root, "etc"), 0o755)
        os.chmod(os.path.join(self.root, "dpkg"), 0o755)
        for tool in ("ip", "arping"):
            self.install_double(os.path.join("tools", tool))
            self.install_double(os.path.join("decoy", tool))
        self.record_package()
        for name in (CAMERA, OFFICE, "lo"):
            os.mkdir(os.path.join(self.root, "sys", name))
        self.interface_file = self.path("etc/netalias-interface")
        self.write(self.interface_file, CAMERA + "\n")
        self.accounts(["dems-core"], os.getuid() if service_uid is None else service_uid)
        self.addresses = [link("lo", ("127.0.0.1", 8)), link(OFFICE, ("10.20.0.5", 24)), link(CAMERA, ("192.168.100.1", 24))]
        self.default_route = [{"dst": "default", "gateway": "10.20.0.1", "dev": OFFICE}]
        self.arping_exit = 0
        self.arping_stdout = None  # None: the text that agrees with the exit status
        self.add_exit = 0
        self.del_exit = 0
        self.copy = build.make_test_copy(self.path("copy/helper"), {
            "IP_TOOL": self.path("tools/ip"),
            "ARPING_TOOL": self.path("tools/arping"),
            "INTERFACE_FILE": self.interface_file,
            "SYSFS_NET": self.path("sys"),
            "MARKS_DIR": self.path("run/marks"),
            "DPKG_INFO_DIR": self.path("dpkg"),
            "GROUP_FILE": self.path("etc/group"),
            "PASSWD_FILE": self.path("etc/passwd"),
            "TRUSTED_OWNER_UID": os.getuid() if trusted_uid is None else trusted_uid,
            # macOS: level SOL_LOCAL, option LOCAL_PEERCRED, struct xucred (the user id is field 1,
            # as in the Linux struct ucred the delivered file names).
            "PEER_OPTION_LEVEL": 0,
            "PEER_OPTION_NAME": 1,
            "PEER_STRUCT": "=IIh2x16I",
        })

    def path(self, relative):
        return os.path.join(self.root, relative)

    def write(self, path, text, mode=0o644):
        with open(path, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        os.chmod(path, mode)

    def install_double(self, relative):
        self.write(self.path(relative), DOUBLE % sys.executable, 0o755)

    def accounts(self, members, uid, group="dems-netalias"):
        self.write(self.path("etc/group"), "root:x:0:\n%s:x:990:%s\naudio:x:29:dems-core\n" % (group, ",".join(members)))
        self.write(self.path("etc/passwd"), "root:x:0:0:root:/root:/bin/bash\n"
                   "dems-core:x:%d:%d:DEMS Core:/var/lib/dems:/usr/sbin/nologin\n" % (uid, uid))

    def record_package(self, package="iputils-arping", tool="tools/arping", listed=True, sums=1):
        """The package manager's two records of the conflict tool, as the tool file is NOW."""
        with open(self.path(tool), "rb") as handle:
            digest = hashlib.md5(handle.read(), usedforsecurity=False).hexdigest()
        path = self.path(tool)
        self.write(self.path("dpkg/%s.list" % package), "/.\n/usr\n/usr/bin\n" + (path + "\n" if listed else ""))
        self.write(self.path("dpkg/%s.md5sums" % package),
                   "0123456789abcdef0123456789abcdef  usr/share/doc/%s/copyright\n" % package + ("%s  %s\n" % (digest, path[1:])) * sums)

    def mark(self, address, age=0, minutes=30, interface=CAMERA):
        """A mark as the helper writes it, written `age` seconds ago on the host's monotonic clock."""
        self.write(self.path("run/marks/" + address), "%s/24 %s %d %d\n" % (address, interface, int(time.monotonic()) - age, minutes))

    def hold(self, address, lifetime=1700, name=CAMERA):
        """The interface now holds `address`/24: with a kernel lifetime in seconds, FOREVER, or None (not stated)."""
        for entry in self.addresses:
            if entry["ifname"] == name:
                entry["addr_info"].append(address_info(address, 24, lifetime))
                return
        raise AssertionError("no such interface in the fixture")

    def marks(self):
        return sorted(os.listdir(self.path("run/marks")))

    def plan(self):
        said = self.arping_stdout
        if said is None:
            said = {0: FREE_TEXT, 1: TAKEN_TEXT}.get(self.arping_exit, "")
        rules = [
            {"tool": "ip", "prefix": ROUTE, "exit": 0, "stdout": json.dumps(self.default_route)},
            {"tool": "ip", "prefix": ADDRS, "exit": 0, "stdout": json.dumps(self.addresses)},
            {"tool": "ip", "prefix": ["addr", "add"], "exit": self.add_exit},
            {"tool": "ip", "prefix": ["addr", "del"], "exit": self.del_exit},
            {"tool": "arping", "prefix": [], "exit": self.arping_exit, "stdout": said},
        ]
        for folder in ("tools", "decoy"):
            self.write(self.path(folder + "/plan.json"), json.dumps(rules))

    def calls(self, folder="tools"):
        try:
            with open(self.path(folder + "/calls.jsonl")) as handle:
                return [json.loads(line) for line in handle]
        except FileNotFoundError:
            return []

    def vectors(self):
        return [[call["tool"]] + call["argv"] for call in self.calls()]

    def run(self, request, arguments=(), pipe=False, end=False, environment=None, expect=None):
        """Runs the test copy once. Returns (code name, journal match). Checks bounds 8 and 9 on EVERY run."""
        self.plan()
        if os.path.exists(self.path("tools/calls.jsonl")):
            os.unlink(self.path("tools/calls.jsonl"))
        ours, theirs = socket.socketpair()
        reader = writer = None
        if pipe:
            reader, writer = os.pipe()
        process = subprocess.Popen(
            [sys.executable, "-I", "-S", "-B", self.copy, *arguments],
            stdin=reader if pipe else theirs.fileno(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env={} if environment is None else environment, cwd=self.root,
        )
        theirs.close()
        try:
            if pipe:
                os.close(reader)
                os.write(writer, request)
                os.close(writer)
            else:
                try:
                    ours.sendall(request)
                    if end:
                        ours.shutdown(socket.SHUT_WR)
                except OSError:
                    pass  # the helper refused before it read everything and has gone
            answer, journal = process.communicate(timeout=30)
        finally:
            ours.close()
        case = self.case
        match = JOURNAL.match(journal.decode("ascii"))
        case.assertIsNotNone(match, "bound 8: exactly one journal line of the fixed form, got %r" % journal)
        name = match.group(4)
        case.assertIn(name, CODES, "bound 9: a result outside the closed set")
        case.assertEqual(int(match.group(5)), CODES[name])
        case.assertEqual(answer, ("%d %s\n" % (CODES[name], name)).encode("ascii"), "bound 9: the answer is the code and its name")
        case.assertEqual(process.returncode, CODES[name], "bound 9: the exit status is the code")
        if expect is not None:
            case.assertEqual(name, expect)
        return name, match


ADD = b"add 192.168.1.250/24 30\n"
DEL = b"del 192.168.1.250/24\n"
ARPING_VECTOR = ["arping", "-D", "-c", "2", "-w", "3", "-I", CAMERA, "192.168.1.250"]
ADD_VECTOR = ["ip", "addr", "add", "192.168.1.250/24", "dev", CAMERA, "valid_lft", "1800", "preferred_lft", "1800"]
DEL_VECTOR = ["ip", "addr", "del", "192.168.1.250/24", "dev", CAMERA]
READS = [["ip"] + ROUTE, ["ip"] + ADDRS]


@unittest.skipIf(os.getuid() == 0, "these tests are never run as root")
class HelperCase(unittest.TestCase):
    maxDiff = None

    def bench(self, **options):
        return Bench(self, **options)

    def refused_without_any_tool(self, bench, request, expect, **options):
        name, match = bench.run(request, expect=expect, **options)
        self.assertEqual(bench.vectors(), [], "a refused request starts no tool")
        self.assertEqual(bench.marks(), [])
        return match


class TheWork(HelperCase):
    """What the helper does when everything is in order: the exact argument vectors."""

    def test_add_runs_route_read_address_read_conflict_check_then_add(self):
        bench = self.bench()
        _, match = bench.run(ADD, expect="OK")
        self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR, ADD_VECTOR])
        self.assertEqual(match.group(1), str(os.getuid()))
        self.assertEqual((match.group(2), match.group(3)), ("add", "192.168.1.250/24"))

    def test_del_of_a_marked_address_runs_one_del(self):
        bench = self.bench()
        bench.mark("192.168.1.250")
        bench.hold("192.168.1.250")
        _, match = bench.run(DEL, expect="OK")
        self.assertEqual(bench.vectors(), READS + [DEL_VECTOR])
        self.assertEqual(bench.marks(), [])
        self.assertEqual((match.group(2), match.group(3)), ("del", "192.168.1.250/24"))

    def test_the_three_private_ranges_and_both_ends_of_the_host_part_are_accepted(self):
        for address in ("10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.254", "192.168.0.1", "192.168.255.254"):
            with self.subTest(address=address):
                bench = self.bench()
                bench.run(("add %s/24 30\n" % address).encode(), expect="OK")
                self.assertEqual(bench.vectors()[-1][:4], ["ip", "addr", "add", address + "/24"])
                self.assertEqual(bench.marks(), [address])


class Bound1Interface(HelperCase):
    """S13-08 (1): the interface is the one line of the root-owned file, never the caller's."""

    def test_interface_not_the_configured_one_cannot_be_named_by_the_caller(self):
        bench = self.bench()
        self.refused_without_any_tool(bench, b"add eth0 192.168.1.250/24\n", "ADDRESS_MALFORMED")  # the form of input-av
        self.refused_without_any_tool(bench, b"add 192.168.1.250/24 30 eth0\n", "REQUEST_MALFORMED")
        self.refused_without_any_tool(bench, b"del eth0 192.168.1.250/24\n", "REQUEST_MALFORMED")
        self.refused_without_any_tool(bench, b"add 192.168.1.250/24 dev eth0\n", "REQUEST_MALFORMED")
        # and what is accepted goes to the configured interface only
        bench.run(ADD, expect="OK")
        self.assertEqual([vector[vector.index("-I") + 1] for vector in bench.vectors() if vector[0] == "arping"], [CAMERA])
        self.assertEqual([vector[5] for vector in bench.vectors() if vector[1:3] == ["addr", "add"]], [CAMERA])

    def test_path_traversal_and_other_bad_names_in_the_interface_file(self):
        for text in ("..\n", "../../etc/passwd\n", "../eth1\n", "-eth1\n", "--help\n", ".eth1\n", "eth1;reboot\n",
                     "eth1 eth0\n", "eth1\neth0\n", "eth1\n\n", "\n", "", "abcdefghijklmnop\n", "eth1\x00\n",
                     "eth/1\n", "$(reboot)\n", "eth1\r\n", " eth1\n", "éth1\n"):
            with self.subTest(text=text):
                bench = self.bench()
                bench.write(bench.interface_file, text)
                self.refused_without_any_tool(bench, ADD, "INTERFACE_NAME_INVALID")

    def test_interface_file_writable_by_group_or_others_a_link_or_missing(self):
        bench = self.bench()
        os.chmod(bench.interface_file, 0o664)
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")
        os.chmod(bench.interface_file, 0o646)
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")
        os.unlink(bench.interface_file)
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")
        bench.write(bench.path("etc/real"), CAMERA + "\n")
        os.symlink(bench.path("etc/real"), bench.interface_file)
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")

    def test_interface_file_in_a_folder_others_can_write(self):
        bench = self.bench()
        os.chmod(bench.path("etc"), 0o777)
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")

    def test_interface_file_too_large(self):
        bench = self.bench()
        bench.write(bench.interface_file, "e" * 65 + "\n")
        self.refused_without_any_tool(bench, ADD, "INTERFACE_FILE_UNSAFE")

    def test_files_not_owned_by_the_trusted_owner_are_not_believed(self):
        # The copy keeps the delivered owner (root, 0); on this Mac every fixture belongs to the
        # test's user, so the first file the helper reads is already refused.
        bench = self.bench(trusted_uid=0)
        self.refused_without_any_tool(bench, ADD, "SERVICE_USER_UNRESOLVED")

    def test_interface_absent_from_the_kernel_list(self):
        bench = self.bench()
        bench.write(bench.interface_file, "eth7\n")
        self.refused_without_any_tool(bench, ADD, "INTERFACE_ABSENT")

    def test_interface_of_the_default_route_is_refused_for_both_verbs(self):
        for route in ([{"dst": "default", "gateway": "192.168.100.254", "dev": CAMERA}],
                      [{"dst": "default", "nexthops": [{"gateway": "10.20.0.1", "dev": OFFICE}, {"gateway": "192.168.100.254", "dev": CAMERA}]}]):
            with self.subTest(route=route):
                bench = self.bench()
                bench.mark("192.168.1.250")
                bench.default_route = route
                bench.run(ADD, expect="INTERFACE_HAS_DEFAULT_ROUTE")
                self.assertEqual(bench.vectors(), [["ip"] + ROUTE])
                bench.run(DEL, expect="INTERFACE_HAS_DEFAULT_ROUTE")
                self.assertEqual(bench.vectors(), [["ip"] + ROUTE])
                self.assertEqual(bench.marks(), ["192.168.1.250"])

    def test_route_table_that_cannot_be_read(self):
        for output in ("", "not json", "{}", "[1]", '[{"dev": "eth0", "nexthops": 3}]'):
            with self.subTest(output=output):
                bench = self.bench()
                bench.default_route = None
                bench.plan = lambda b=bench, o=output: [b.write(b.path(f + "/plan.json"), json.dumps(
                    [{"tool": "ip", "prefix": ROUTE, "exit": 0, "stdout": o}])) for f in ("tools", "decoy")]
                bench.run(ADD, expect="HOST_STATE_UNREADABLE")
                self.assertEqual(bench.vectors(), [["ip"] + ROUTE])


class Bound2Address(HelperCase):
    """S13-08 (2): an RFC 1918 address with /24 only, host part 1 to 254."""

    TABLE = (
        ("ADDRESS_NOT_PRIVATE", ("8.8.8.8", "1.1.1.1", "172.15.0.5", "172.32.0.5", "192.169.1.5", "192.167.1.5", "11.0.0.5",
                                 "9.255.255.5", "100.64.0.5", "0.0.0.0", "0.1.2.3", "255.255.255.255", "240.0.0.5",
                                 "198.18.0.5", "203.0.113.5")),
        ("ADDRESS_LOOPBACK", ("127.0.0.1", "127.255.255.254", "127.0.0.0")),
        ("ADDRESS_LINK_LOCAL", ("169.254.0.5", "169.254.169.254")),
        ("ADDRESS_MULTICAST", ("224.0.0.1", "239.255.255.250", "232.1.1.1")),
        ("HOST_PART_OUT_OF_RANGE", ("192.168.1.0", "192.168.1.255", "10.0.0.0", "172.16.5.255")),
    )

    def test_address_not_private_loopback_link_local_multicast_and_octet_out_of_range(self):
        for expect, addresses in self.TABLE:
            for address in addresses:
                for request in ("add %s/24 30\n" % address, "del %s/24\n" % address):
                    with self.subTest(request=request):
                        bench = self.bench()
                        bench.mark("192.168.1.250")
                        name, match = bench.run(request.encode(), expect=expect)
                        self.assertEqual(bench.vectors(), [])
                        self.assertEqual(match.group(3), "-", "an address that failed a check is not printed")

    def test_prefix_not_24(self):
        for prefix in ("0", "8", "16", "23", "25", "30", "32", "33", "99"):
            with self.subTest(prefix=prefix):
                self.refused_without_any_tool(self.bench(), ("add 192.168.1.250/%s 30\n" % prefix).encode(), "PREFIX_NOT_24")
                self.refused_without_any_tool(self.bench(), ("del 192.168.1.250/%s\n" % prefix).encode(), "PREFIX_NOT_24")

    def test_malformed_address(self):
        for token in ("192.168.1.250", "192.168.1.250/", "192.168.1/24", "192.168.1.250.1/24", "192.168.1.256/24",
                      "192.168.01.250/24", "192.168.1.0250/24", "0xC0.168.1.250/24", "3232235770/24", "192.168.1.250/024",
                      "192.168.1.250/24/24", "192.168.1.250/2a", "192.168.1.-5/24", "192.168.1.250/-24", "+192.168.1.250/24",
                      "::ffff:192.168.1.250/24", "fe80::1/24", "camera.local/24", "localhost/24", "192,168,1,250/24",
                      "192.168.1.250/255.255.255.0", "/24", "eth1", "1e2.168.1.250/24"):
            with self.subTest(token=token):
                self.refused_without_any_tool(self.bench(), ("add %s 30\n" % token).encode(), "ADDRESS_MALFORMED")
                self.refused_without_any_tool(self.bench(), ("del %s\n" % token).encode(), "ADDRESS_MALFORMED")


class Bound3OtherInterfaceAndLimit(HelperCase):
    """S13-08 (3): never a /24 another interface holds; never more marked addresses than the limit."""

    def test_another_interface_holds_an_address_in_that_24(self):
        bench = self.bench()
        bench.addresses[1] = link(OFFICE, ("192.168.1.7", 24))
        bench.run(ADD, expect="OTHER_INTERFACE_HOLDS_SUBNET")
        self.assertEqual(bench.vectors(), READS)
        self.assertEqual(bench.marks(), [])

    def test_another_interface_holds_a_wider_or_narrower_network_over_that_24(self):
        for held, request in ((("10.0.0.5", 8), b"add 10.9.9.9/24 30\n"), (("192.168.0.5", 16), ADD),
                              (("192.168.1.130", 25), ADD), (("192.168.1.9", 32), ADD)):
            with self.subTest(held=held):
                bench = self.bench()
                bench.addresses.append(link("wlan0", held))
                bench.run(request, expect="OTHER_INTERFACE_HOLDS_SUBNET")
                self.assertEqual(bench.vectors(), READS)

    def test_a_second_alias_while_one_is_active_is_refused(self):
        bench = self.bench()
        bench.mark("192.168.1.250")
        bench.hold("192.168.1.250")
        for request in (b"add 192.168.2.250/24 30\n", b"add 192.168.1.251/24 30\n", b"add 10.1.1.250/24 5\n"):
            with self.subTest(request=request):
                bench.run(request, expect="ALIAS_LIMIT_REACHED")
                self.assertEqual(bench.vectors(), READS)
                self.assertEqual(bench.marks(), ["192.168.1.250"])

    def test_a_third_alias_is_refused(self):
        bench = self.bench()
        for address in ("192.168.1.250", "192.168.2.250"):
            bench.mark(address)
            bench.hold(address)
        bench.run(b"add 192.168.3.250/24 30\n", expect="ALIAS_LIMIT_REACHED")
        self.assertEqual(bench.vectors(), READS)

    def test_the_limit_is_one_in_the_delivered_file(self):
        with open(DELIVERED, encoding="ascii") as handle:
            self.assertEqual(re.findall(r"^MAX_MARKED = (.+)$", handle.read(), re.M), ["1"])

    def test_a_mark_whose_address_the_kernel_expired_does_not_count(self):
        bench = self.bench()
        bench.mark("192.168.9.250")
        bench.run(ADD, expect="OK")
        self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR, ADD_VECTOR])
        self.assertEqual(bench.marks(), ["192.168.1.250"])

    def test_an_address_the_host_already_holds_and_a_subnet_the_camera_port_already_has(self):
        bench = self.bench()
        bench.run(b"add 192.168.100.1/24 30\n", expect="ADDRESS_ALREADY_PRESENT")
        self.assertEqual(bench.vectors(), READS)
        bench.run(b"add 192.168.100.9/24 30\n", expect="CAMERA_INTERFACE_HOLDS_SUBNET")
        self.assertEqual(bench.vectors(), READS)
        self.assertEqual(bench.marks(), [])

    def test_address_list_that_cannot_be_read(self):
        for addresses in ("x", [1], [{"ifname": 5}], [{"ifname": "eth0", "addr_info": [{"family": "inet", "local": "10.0.0.300", "prefixlen": 24}]}],
                          [{"ifname": "eth0", "addr_info": [{"family": "inet", "local": "10.0.0.3", "prefixlen": "24"}]}]):
            with self.subTest(addresses=addresses):
                bench = self.bench()
                bench.addresses = addresses
                bench.run(ADD, expect="HOST_STATE_UNREADABLE")
                self.assertEqual(bench.vectors(), READS)


class Bound4ConflictCheck(HelperCase):
    """S13-08 (4): the conflict check always runs; no tool, no address."""

    def test_conflict_tool_missing_not_executable_or_writable_by_others(self):
        for damage in ("missing", "not-executable", "writable"):
            with self.subTest(damage=damage):
                bench = self.bench()
                tool = bench.path("tools/arping")
                if damage == "missing":
                    os.unlink(tool)
                else:
                    os.chmod(tool, 0o644 if damage == "not-executable" else 0o757)
                self.refused_without_any_tool(bench, ADD, "CONFLICT_TOOL_MISSING")

    def test_ip_tool_missing(self):
        bench = self.bench()
        os.unlink(bench.path("tools/ip"))
        self.refused_without_any_tool(bench, ADD, "TOOL_MISSING")

    def test_an_address_another_device_answers_for_is_not_added(self):
        bench = self.bench()
        bench.arping_exit = 1
        bench.run(ADD, expect="ADDRESS_IN_USE")
        self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR])
        self.assertEqual(bench.marks(), [])

    def test_a_conflict_check_that_fails_is_not_a_free_address(self):
        for status in (2, 97, 255):
            with self.subTest(status=status):
                bench = self.bench()
                bench.arping_exit = status
                bench.run(ADD, expect="CONFLICT_CHECK_FAILED")
                self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR])
                self.assertEqual(bench.marks(), [])

    # --- caution R119-01: exit status 0 of a tool that did not ask is not "the address is free" ---

    def camera_flags(self, bench, flags):
        bench.addresses[2] = link(CAMERA, ("192.168.100.1", 24), flags=flags)

    def test_a_port_that_cannot_be_asked_is_refused_before_the_tool_is_started(self):
        cases = (
            ("INTERFACE_NOT_ARPABLE", ["LOOPBACK", "UP", "LOWER_UP"]),
            ("INTERFACE_NOT_ARPABLE", ["BROADCAST", "MULTICAST", "NOARP", "UP", "LOWER_UP"]),
            ("INTERFACE_NOT_ARPABLE", ["POINTOPOINT", "MULTICAST", "UP", "LOWER_UP"]),
            ("INTERFACE_NOT_ARPABLE", ["LOOPBACK", "NOARP"]),  # cannot be asked AND down: the first reason is named
            ("INTERFACE_DOWN", ["BROADCAST", "MULTICAST"]),
            ("INTERFACE_DOWN", ["BROADCAST", "MULTICAST", "LOWER_UP"]),
            ("INTERFACE_DOWN", ["NO-CARRIER", "BROADCAST", "MULTICAST", "UP"]),
            ("INTERFACE_STATE_UNKNOWN", None),
            ("INTERFACE_STATE_UNKNOWN", "BROADCAST,UP,LOWER_UP"),
            ("INTERFACE_STATE_UNKNOWN", ["BROADCAST", "UP", "LOWER_UP", 7]),
            ("INTERFACE_STATE_UNKNOWN", ["BROADCAST", "UP", "LOWER_UP", "up; reboot"]),
            ("INTERFACE_STATE_UNKNOWN", {"UP": True}),
        )
        for expect, flags in cases:
            with self.subTest(expect=expect, flags=flags):
                bench = self.bench()
                self.camera_flags(bench, flags)
                if flags is None:
                    del bench.addresses[2]["flags"]
                # The double WOULD say "free" with exit status 0: the refusal is not its answer.
                bench.run(ADD, expect=expect)
                self.assertEqual(bench.vectors(), READS, "the conflict tool is not started, nothing is added")
                self.assertEqual(bench.marks(), [])

    def test_a_camera_port_the_listing_does_not_show_or_shows_twice_is_not_asked(self):
        bench = self.bench()
        del bench.addresses[2]  # no IPv4 address on the camera port: it is not in the listing
        bench.run(ADD, expect="INTERFACE_STATE_UNKNOWN")
        self.assertEqual(bench.vectors(), READS)
        bench = self.bench()
        bench.addresses.append(link(CAMERA, ("192.168.50.1", 24)))
        bench.run(ADD, expect="INTERFACE_STATE_UNKNOWN")
        self.assertEqual(bench.vectors(), READS)
        self.assertEqual(bench.marks(), [])

    def test_the_interface_file_naming_the_loopback_no_longer_adds_without_a_check(self):
        # The reach the review names: `lo` passes the name pattern, is in the kernel's list and
        # carries no default route; the packaged tool answers 0 there without asking.
        bench = self.bench()
        bench.write(bench.interface_file, "lo\n")
        bench.arping_stdout = NOT_ARPABLE_TEXT.replace("eth1", "lo")
        bench.run(ADD, expect="INTERFACE_NOT_ARPABLE")
        self.assertEqual(bench.vectors(), READS)
        self.assertEqual(bench.marks(), [])

    def test_exit_status_0_without_the_stated_result_is_not_a_free_address(self):
        free = FREE_TEXT.replace("@LAST@", "192.168.1.250")
        texts = (
            "",
            NOT_ARPABLE_TEXT,
            'Interface "eth1" is down\n',
            NOT_ARPABLE_TEXT + free,
            free.replace("192.168.1.250", "192.168.1.251"),  # it asked for another address
            free.replace(" eth1\n", " eth0\n"),  # it asked on another interface
            free.replace("ARPING ", "arping "),
            free.replace("Sent 2 probes (2 ", "Sent 0 probes (0 "),
            free.replace("Sent 2 probes (2 ", "Sent 1 probes (1 "),  # fewer probes than were asked for
            free.replace("(2 broadcast(s))", "(0 broadcast(s))"),
            free.replace("Received 0 response(s)", "Received 1 response(s)"),  # the text and the status disagree
            free.replace("Received 0 response(s)", "Received 0 response(s) (1 request(s))"),
            free.replace("Received 0 response(s)", "Received 0 responses"),
            free.replace("Received 0 response(s)\n", ""),
            free.replace("Sent 2 probes (2 broadcast(s))\n", ""),
            free + "Received 0 response(s)\n",
            free + free,
            free[:-1],  # cut before its line end
            free.replace("Sent", "Sént"),
            free + "x" * 5000,
            # the OTHER program named arping (package `arping`) does not print these lines
            "ARPING 192.168.1.250\nTimeout\nTimeout\n\n--- 192.168.1.250 statistics ---\n"
            "2 packets transmitted, 0 packets received, 100% unanswered (0 extra)\n",
        )
        for text in texts:
            with self.subTest(text=text[:60]):
                bench = self.bench()
                bench.arping_stdout = text
                bench.run(ADD, expect="CONFLICT_RESULT_UNKNOWN")
                self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR], "nothing is added")
                self.assertEqual(bench.marks(), [])

    def test_exit_status_1_without_a_stated_response_is_not_a_result_either(self):
        for text in ("", FREE_TEXT, NOT_ARPABLE_TEXT, TAKEN_TEXT.replace("Received 1", "Received 0")):
            with self.subTest(text=text[:40]):
                bench = self.bench()
                bench.arping_exit = 1
                bench.arping_stdout = text
                bench.run(ADD, expect="CONFLICT_RESULT_UNKNOWN")
                self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR])
                self.assertEqual(bench.marks(), [])

    def test_the_stated_results_that_are_read(self):
        for status, text, expect in (
                (0, FREE_TEXT.replace("Sent 2 probes (2 ", "Sent 4 probes (4 "), "OK"),
                (0, FREE_TEXT.replace(" from 0.0.0.0 ", " from 192.168.100.1 "), "OK"),
                (1, TAKEN_TEXT.replace("Received 1 response(s)", "Received 2 response(s) (1 request(s), 1 broadcast(s))"), "ADDRESS_IN_USE"),
                (1, TAKEN_TEXT, "ADDRESS_IN_USE")):
            with self.subTest(status=status, text=text[-40:]):
                bench = self.bench()
                bench.arping_exit = status
                bench.arping_stdout = text
                bench.run(ADD, expect=expect)
                self.assertEqual(bench.marks(), ["192.168.1.250"] if expect == "OK" else [])

    def test_a_program_at_the_tools_path_that_is_not_the_packaged_one_is_never_started(self):
        def changed_after_installation(bench):
            with open(bench.path("tools/arping"), "a") as handle:
                handle.write("# another program\n")

        def recorded_for_the_other_package_only(bench):
            for name in ("iputils-arping.list", "iputils-arping.md5sums"):
                os.unlink(bench.path("dpkg/" + name))
            bench.record_package(package="arping")

        damages = (
            changed_after_installation,
            recorded_for_the_other_package_only,
            lambda bench: bench.record_package(listed=False),
            lambda bench: bench.record_package(sums=0),
            lambda bench: bench.record_package(sums=2),
            lambda bench: os.unlink(bench.path("dpkg/iputils-arping.list")),
            lambda bench: os.unlink(bench.path("dpkg/iputils-arping.md5sums")),
            lambda bench: os.chmod(bench.path("dpkg/iputils-arping.md5sums"), 0o664),
            lambda bench: os.chmod(bench.path("dpkg/iputils-arping.list"), 0o646),
            lambda bench: os.chmod(bench.path("dpkg"), 0o777),
            lambda bench: bench.write(bench.path("dpkg/iputils-arping.md5sums"), "é\n"),
            lambda bench: bench.write(bench.path("dpkg/iputils-arping.list"), "x" * 70000),
        )
        for number, damage in enumerate(damages):
            with self.subTest(damage=number):
                bench = self.bench()
                damage(bench)
                self.refused_without_any_tool(bench, ADD, "CONFLICT_TOOL_NOT_EXPECTED")
                bench.run(b"", arguments=["check"], pipe=True, expect="CONFLICT_TOOL_NOT_EXPECTED")
                self.assertEqual(bench.vectors(), [], "root's check names it at installation, and starts nothing")

    def test_the_delivered_file_names_one_program_and_reads_its_result(self):
        with open(DELIVERED, encoding="ascii") as handle:
            text = handle.read()
        self.assertEqual(re.findall(r'^CONFLICT_PACKAGE = (.+)$', text, re.M), ['"iputils-arping"'])
        self.assertEqual(re.findall(r"\[ARPING_TOOL, ([^\]]+)\]", text),
                         ['"-D", "-c", str(CONFLICT_PROBES), "-w", str(CONFLICT_WAIT_S), "-I", interface, dotted(quad)'])
        self.assertNotIn('"-q"', text, "a quiet tool states no result")
        for name, code in (("CONFLICT_TOOL_NOT_EXPECTED", 38), ("INTERFACE_NOT_ARPABLE", 46), ("INTERFACE_DOWN", 47),
                           ("INTERFACE_STATE_UNKNOWN", 48), ("CONFLICT_RESULT_UNKNOWN", 55)):
            self.assertEqual(CODES[name], code)
        self.assertEqual(len(CODES), 41)


class Bound5MarkAndLifetime(HelperCase):
    """S13-08 (5): what is added is marked, and lives 5 to 480 minutes by the kernel's own clock."""

    def test_the_mark_and_the_lifetime_of_the_shortest_and_the_longest_request(self):
        for minutes, seconds in ((5, "300"), (480, "28800"), (30, "1800")):
            with self.subTest(minutes=minutes):
                bench = self.bench()
                bench.run(("add 192.168.1.250/24 %d\n" % minutes).encode(), expect="OK")
                self.assertEqual(bench.vectors()[-1], ADD_VECTOR[:6] + ["valid_lft", seconds, "preferred_lft", seconds])
                mark = bench.path("run/marks/192.168.1.250")
                with open(mark) as handle:
                    self.assertRegex(handle.read(), r"\A192\.168\.1\.250/24 eth1 [0-9]+ %d\n\Z" % minutes)
                self.assertEqual(stat.S_IMODE(os.stat(mark).st_mode), 0o644)

    def test_lifetime_out_of_range_or_not_a_plain_number(self):
        for minutes in ("0", "1", "4", "481", "999", "030", "005", "1000", "-5", "+30", "5.5", "1e2", "abc", "0x1e", "30m"):
            with self.subTest(minutes=minutes):
                self.refused_without_any_tool(self.bench(), ("add 192.168.1.250/24 %s\n" % minutes).encode(), "LIFETIME_OUT_OF_RANGE")

    def test_an_add_the_tool_refuses_leaves_no_mark(self):
        bench = self.bench()
        bench.add_exit = 2
        bench.run(ADD, expect="ADD_FAILED")
        self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR, ADD_VECTOR])
        self.assertEqual(bench.marks(), [])

    def test_marks_folder_others_can_write_or_with_a_foreign_entry(self):
        bench = self.bench()
        os.chmod(bench.path("run/marks"), 0o777)
        self.assertEqual(bench.run(ADD, expect="STATE_DIR_UNSAFE")[0], "STATE_DIR_UNSAFE")
        self.assertEqual(bench.vectors(), [])
        os.chmod(bench.path("run/marks"), 0o755)
        for name in ("notes.txt", "192.168.1.250.tmp", "192.168.01.250"):
            with self.subTest(name=name):
                bench.write(bench.path("run/marks/" + name), "x")
                bench.run(ADD, expect="STATE_DIR_UNSAFE")
                self.assertEqual(bench.vectors(), [])
                os.unlink(bench.path("run/marks/" + name))
        os.symlink(bench.interface_file, bench.path("run/marks/192.168.1.250"))
        bench.run(DEL, expect="STATE_DIR_UNSAFE")
        self.assertEqual(bench.vectors(), [])


class Bound6DelOnlyWhatWasMarked(HelperCase):
    """S13-08 (6): `del` removes an address this helper marked, and no other."""

    def test_the_camera_ports_own_address_and_any_unmarked_address_are_never_removed(self):
        for address in ("192.168.100.1", "10.20.0.5", "192.168.1.250"):
            with self.subTest(address=address):
                bench = self.bench()
                bench.mark("192.168.77.250")
                bench.hold("192.168.77.250")
                bench.run(("del %s/24\n" % address).encode(), expect="NOT_MARKED")
                self.assertEqual(bench.vectors(), [["ip"] + ROUTE], "no removal vector was built")
                self.assertEqual(bench.marks(), ["192.168.77.250"])

    def test_a_marked_address_that_is_already_gone_is_done_without_a_removal(self):
        bench = self.bench()
        bench.mark("192.168.1.250")
        _, match = bench.run(DEL, expect="OK")
        self.assertEqual(bench.vectors(), READS)
        self.assertEqual(bench.marks(), [])
        self.assertEqual(match.group(6), " note=already-absent")

    def test_a_removal_the_tool_refuses_keeps_the_mark(self):
        bench = self.bench()
        bench.mark("192.168.1.250")
        bench.hold("192.168.1.250")
        bench.del_exit = 2
        bench.run(DEL, expect="DEL_FAILED")
        self.assertEqual(bench.vectors(), READS + [DEL_VECTOR])
        self.assertEqual(bench.marks(), ["192.168.1.250"])

    def test_del_needs_no_conflict_tool(self):
        bench = self.bench()
        bench.mark("192.168.1.250")
        bench.hold("192.168.1.250")
        os.unlink(bench.path("tools/arping"))
        bench.run(DEL, expect="OK")
        self.assertEqual(bench.vectors(), READS + [DEL_VECTOR])

    # --- caution R119-02: a mark never outlives the address it was written for ---

    def test_a_mark_past_its_lifetime_does_not_remove_an_address_somebody_else_set(self):
        # Ours expired; later the same address was set on the camera port by another hand.
        for age, lifetime in ((1800 + 61, FOREVER), (1800 + 61, 900), (9 * 3600, FOREVER)):
            with self.subTest(age=age, lifetime=lifetime):
                bench = self.bench()
                bench.mark("192.168.1.250", age=age)
                bench.hold("192.168.1.250", lifetime)
                bench.run(DEL, expect="NOT_MARKED")
                self.assertEqual(bench.vectors(), READS, "no removal vector was built")
                self.assertEqual(bench.marks(), [], "the stale mark is gone")

    def test_an_address_set_again_by_hand_inside_the_marks_lifetime_is_not_removed(self):
        # Ours was removed by hand; the address there now has no lifetime, or a longer one than was asked.
        for lifetime in (FOREVER, 1801, 28800):
            with self.subTest(lifetime=lifetime):
                bench = self.bench()
                bench.mark("192.168.1.250", age=120)
                bench.hold("192.168.1.250", lifetime)
                bench.run(DEL, expect="NOT_MARKED")
                self.assertEqual(bench.vectors(), READS)
                self.assertEqual(bench.marks(), [])

    def test_a_mark_inside_its_lifetime_and_its_grace_still_removes_its_own_address(self):
        for age, lifetime in ((0, 1800), (900, 900), (1799, 1), (1800 + 30, 0)):
            with self.subTest(age=age):
                bench = self.bench()
                bench.mark("192.168.1.250", age=age)
                bench.hold("192.168.1.250", lifetime)
                bench.run(DEL, expect="OK")
                self.assertEqual(bench.vectors(), READS + [DEL_VECTOR])
                self.assertEqual(bench.marks(), [])

    def test_a_stale_mark_whose_address_is_gone_is_dropped_and_del_is_done(self):
        # The lifetime bound, a removal by hand: no address, so what was asked is already so.
        for age in (0, 1800 + 61, 9 * 3600):
            with self.subTest(age=age):
                bench = self.bench()
                bench.mark("192.168.1.250", age=age)
                _, match = bench.run(DEL, expect="OK")
                self.assertEqual(bench.vectors(), READS)
                self.assertEqual(bench.marks(), [])
                self.assertEqual(match.group(6), " note=already-absent")

    def test_a_mark_that_is_not_what_the_helper_writes_is_no_mark(self):
        def from_before_this_boot(bench):
            bench.mark("192.168.1.250", age=-3600)  # written "later" than the clock reads now

        cases = (
            from_before_this_boot,
            lambda bench: bench.mark("192.168.1.250", interface=OFFICE),
            lambda bench: bench.mark("192.168.1.250", minutes=481),
            lambda bench: bench.mark("192.168.1.250", minutes=4),
            lambda bench: bench.write(bench.path("run/marks/192.168.1.250"), ""),
            lambda bench: bench.write(bench.path("run/marks/192.168.1.250"), "192.168.1.251/24 eth1 1 30\n"),
            lambda bench: bench.write(bench.path("run/marks/192.168.1.250"), "192.168.1.250/24 eth1 1 30\nx\n"),
            lambda bench: bench.write(bench.path("run/marks/192.168.1.250"), "192.168.1.250/24 eth1 soon 30\n"),
            lambda bench: bench.write(bench.path("run/marks/192.168.1.250"), "x" * 200),
        )
        for number, case in enumerate(cases):
            with self.subTest(case=number):
                bench = self.bench()
                case(bench)
                bench.hold("192.168.1.250")
                bench.run(DEL, expect="NOT_MARKED")
                self.assertEqual(bench.vectors(), READS)
                self.assertEqual(bench.marks(), [])

    def test_an_address_whose_lifetime_the_listing_does_not_state_is_not_judged(self):
        for request, expect in ((DEL, "HOST_STATE_UNREADABLE"), (b"add 192.168.2.250/24 30\n", "HOST_STATE_UNREADABLE")):
            with self.subTest(request=request):
                bench = self.bench()
                bench.mark("192.168.1.250", age=60)
                bench.hold("192.168.1.250", None)
                bench.run(request, expect=expect)
                self.assertEqual(bench.vectors(), READS, "nothing is removed and nothing is added")
                self.assertEqual(bench.marks(), ["192.168.1.250"], "a mark that cannot be judged is kept")

    def test_a_stale_mark_does_not_count_and_does_not_stay_at_the_next_add(self):
        cases = (
            lambda bench: bench.mark("192.168.9.250", age=1800 + 61),  # expired by the kernel
            lambda bench: bench.mark("192.168.9.250", age=60),  # removed by hand inside its lifetime
            lambda bench: (bench.mark("192.168.9.250", age=1800 + 61), bench.hold("192.168.9.250", FOREVER)),
            lambda bench: (bench.mark("192.168.9.250", age=60), bench.hold("192.168.9.250", FOREVER)),
            lambda bench: (bench.mark("192.168.9.250", age=60, interface=OFFICE), bench.mark("192.168.8.250", age=-5)),
        )
        for number, case in enumerate(cases):
            with self.subTest(case=number):
                bench = self.bench()
                case(bench)
                bench.run(ADD, expect="OK")
                self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR, ADD_VECTOR])
                self.assertEqual(bench.marks(), ["192.168.1.250"], "only the mark of the address just added is left")

    def test_del_of_one_marked_address_drops_every_other_stale_mark(self):
        bench = self.bench()
        bench.mark("192.168.1.250", age=60)
        bench.hold("192.168.1.250")
        bench.mark("192.168.9.250", age=1800 + 61)
        bench.mark("192.168.8.250", age=60)
        bench.run(DEL, expect="OK")
        self.assertEqual(bench.vectors(), READS + [DEL_VECTOR])
        self.assertEqual(bench.marks(), [])

    def test_add_then_del_then_add_leaves_one_mark_at_most_at_every_step(self):
        bench = self.bench()
        bench.run(ADD, expect="OK")
        self.assertEqual(bench.marks(), ["192.168.1.250"])
        with open(bench.path("run/marks/192.168.1.250")) as handle:
            written = int(handle.read().split(" ")[2])
        self.assertLessEqual(abs(written - int(time.monotonic())), 30, "the mark carries the monotonic clock, not the wall clock")
        bench.hold("192.168.1.250", 1795)
        bench.run(DEL, expect="OK")
        self.assertEqual(bench.marks(), [])
        del bench.addresses[2]["addr_info"][-1]
        bench.run(b"add 192.168.2.250/24 5\n", expect="OK")
        self.assertEqual(bench.marks(), ["192.168.2.250"])
        # the lifetime bound took it, nobody called: the next add finds no address and leaves no old mark
        bench.run(ADD, expect="OK")
        self.assertEqual(bench.marks(), ["192.168.1.250"])


class Bound7NoInjectionPoint(HelperCase):
    """S13-08 (7), S13-16 (1): absolute tools, own search path, nothing from the environment, no evaluation."""

    def test_a_hostile_environment_changes_nothing(self):
        bench = self.bench()
        decoy = bench.path("decoy")
        hostile = {
            "PATH": decoy, "IP_TOOL": decoy + "/ip", "ARPING_TOOL": decoy + "/arping", "INTERFACE_FILE": "/dev/null",
            "MARKS_DIR": decoy, "PYTHONPATH": decoy, "PYTHONSTARTUP": decoy + "/ip", "PYTHONHOME": decoy,
            "LD_PRELOAD": decoy + "/x.so", "IFS": "/", "ENV": decoy + "/ip",
            "BASH_ENV": decoy + "/ip", "SUDO_USER": "root", "SUDO_UID": "0", "DEMS_NETALIAS_INTERFACE": OFFICE,
            "LC_ALL": "tr_TR.UTF-8", "HOME": decoy, "SHELL": decoy + "/ip",
        }
        bench.run(ADD, environment=hostile, expect="OK")
        self.assertEqual(bench.calls("decoy"), [], "no tool was found by search path or by a variable")
        self.assertEqual(bench.vectors(), READS + [ARPING_VECTOR, ADD_VECTOR])
        for call in bench.calls():
            given = {key: value for key, value in call["env"].items() if not key.startswith("__CF")}
            self.assertEqual(given, {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"})
            self.assertEqual(call["cwd"], "/")

    def test_shell_metacharacters_are_never_evaluated(self):
        canary = self.bench()
        for text in ("add 192.168.1.250/24;reboot 30", "add 192.168.1.250/24 30;touch CANARY", "add $(touch CANARY)/24 30",
                     "add `touch CANARY`/24 30", "add 192.168.1.250/24 30|sh", "add 192.168.1.250/24 30&&id",
                     "add 192.168.1.250/24 $((6*5))", "add 192.168.1.250/24 30 >CANARY", "add 192.168.1.250/24 30 #",
                     "add 192.168.1.*/24 30", "add ${IFS}192.168.1.250/24 30", "add 192.168.1.250/24\\n30", "add '192.168.1.250/24' 30",
                     'add "192.168.1.250/24" 30', "del 192.168.1.250/24;id", "del 192.168.1.250/24 || true", "add 192.168.1.250/24 %s",
                     "add {0}/24 30", "add 192.168.1.250/24 30\x00", "__import__('os').system('id')", "add 192.168.1.250/24 30\radd"):
            with self.subTest(text=text):
                name, _ = canary.run(text.encode() + b"\n")
                self.assertNotEqual(name, "OK")
                self.assertEqual(canary.vectors(), [])
                self.assertEqual(sorted(os.listdir(canary.root)), ["copy", "decoy", "dpkg", "etc", "run", "sys", "tools"])
                self.assertEqual(canary.marks(), [])

    def test_option_injection_with_a_leading_dash(self):
        for text, expect in (("add -h/24 30", "ADDRESS_MALFORMED"), ("add --help 30", "ADDRESS_MALFORMED"),
                             ("add -I 30", "ADDRESS_MALFORMED"), ("del -D", "ADDRESS_MALFORMED"), ("del --", "ADDRESS_MALFORMED"),
                             ("add -192.168.1.250/24 30", "ADDRESS_MALFORMED"), ("add 192.168.1.250/24 -30", "LIFETIME_OUT_OF_RANGE"),
                             ("add 192.168.1.250/24 --", "LIFETIME_OUT_OF_RANGE"), ("-add 192.168.1.250/24 30", "VERB_UNKNOWN"),
                             ("--help", "VERB_UNKNOWN"), ("-h", "VERB_UNKNOWN"), ("-- add 192.168.1.250/24 30", "VERB_UNKNOWN"),
                             ("add 192.168.1.250/24 30 -f", "REQUEST_MALFORMED"), ("del 192.168.1.250/24 -all", "REQUEST_MALFORMED")):
            with self.subTest(text=text):
                self.refused_without_any_tool(self.bench(), text.encode() + b"\n", expect)

    def test_path_traversal_in_the_request(self):
        for text in ("add ../../etc/passwd 30", "del ../../etc/passwd", "del ../marks/192.168.1.250/24", "add /etc/shadow/24 30",
                     "del ./192.168.1.250/24", "del 192.168.1.250/../24", "add ../eth0 192.168.1.250/24"):
            with self.subTest(text=text):
                self.refused_without_any_tool(self.bench(), text.encode() + b"\n", "ADDRESS_MALFORMED")

    def test_the_delivered_file_holds_absolute_constants_and_no_way_around_them(self):
        constants = build.delivered_constants()
        self.assertEqual(constants, {
            "IP_TOOL": "/usr/sbin/ip", "ARPING_TOOL": "/usr/bin/arping", "INTERFACE_FILE": "/etc/dems/netalias-interface",
            "SYSFS_NET": "/sys/class/net", "MARKS_DIR": "/run/dems-core-netalias/marks",
            "DPKG_INFO_DIR": "/var/lib/dpkg/info", "GROUP_FILE": "/etc/group",
            "PASSWD_FILE": "/etc/passwd", "TRUSTED_OWNER_UID": 0, "PEER_OPTION_LEVEL": 1, "PEER_OPTION_NAME": 17, "PEER_STRUCT": "3i",
        })
        self.assertEqual(sorted(constants), sorted(build.SUBSTITUTED))
        with open(DELIVERED, encoding="ascii") as handle:
            text = handle.read()
        code = "\n".join(line for line in text.split("\n") if not line.lstrip().startswith("#"))
        for needle in (r"os\.environ", r"getenv", r"putenv", r"environb", r"\beval\(", r"\bexec\(", r"shell=True", r"os\.system",
                       r"os\.popen", r"\bimport (argparse|optparse|getopt|shlex|importlib|pickle|ctypes)", r"__import__",
                       r"(?<![.\w])compile\(", r"expanduser", r"expandvars", r"\bwhich\(", r"execvp", r"execlp", r"spawn[lv]p"):
            self.assertIsNone(re.search(needle, code), "the delivered file holds %s" % needle)
        self.assertEqual(len(re.findall(r"subprocess\.run\(", code)), 1, "tools are started in one place")
        self.assertEqual(re.findall(r"sys\.argv\[[^\]]*\]", code), ["sys.argv[1:]"])
        self.assertIn('if arguments == ["check"]:', code)
        self.assertEqual(text.split("\n")[0], "#!/usr/bin/python3 -ISB")
        # every vector starts with one of the two constants
        self.assertEqual(sorted(set(re.findall(r"\[(IP_TOOL|ARPING_TOOL),", code))), ["ARPING_TOOL", "IP_TOOL"])
        self.assertEqual(len(re.findall(r"run_tool\(|_json_list\(\[", code)) - 2, len(re.findall(r"\[(?:IP_TOOL|ARPING_TOOL),", code)))

    def test_the_delivered_files_have_the_recorded_hashes(self):
        with open(os.path.join(HERE, "SHA256SUMS"), encoding="ascii") as handle:
            recorded = dict(reversed(line.split("  ")) for line in handle.read().splitlines())
        self.assertEqual(sorted(recorded), sorted(DELIVERY))
        for name in DELIVERY:
            with open(os.path.join(HERE, name), "rb") as handle:
                self.assertEqual(hashlib.sha256(handle.read()).hexdigest(), recorded[name], name)

    def test_the_test_copy_differs_from_the_delivered_file_in_the_constants_only(self):
        bench = self.bench()
        with open(DELIVERED, encoding="ascii") as handle:
            delivered = handle.read().split("\n")
        with open(bench.copy, encoding="ascii") as handle:
            copy = handle.read().split("\n")
        self.assertEqual(len(delivered), len(copy))
        changed = [delivered[index] for index in range(len(copy)) if delivered[index] != copy[index]]
        self.assertEqual(sorted(line.split(" = ")[0] for line in changed), sorted(build.SUBSTITUTED))

    def test_the_build_step_writes_no_copy_beside_the_delivered_file_and_takes_no_other_name(self):
        values = dict.fromkeys(build.SUBSTITUTED, "x")
        with self.assertRaises(ValueError):
            build.make_test_copy(os.path.join(HERE, "copy-of-helper"), values)
        self.assertFalse(os.path.exists(os.path.join(HERE, "copy-of-helper")))
        bench = self.bench()
        for wrong in (dict(values, MAX_MARKED=9), dict(values, SERVICE_GROUP="wheel"), {"IP_TOOL": "x"}):
            with self.assertRaises(ValueError):
                build.make_test_copy(bench.path("copy/other"), wrong)
        self.assertFalse(os.path.exists(bench.path("copy/other")))

    def test_the_unit_files_start_the_helper_without_arguments_as_the_only_command(self):
        with open(os.path.join(HERE, "dems-core-netalias@.service"), encoding="ascii") as handle:
            service = handle.read()
        self.assertEqual(re.findall(r"^Exec[A-Za-z]*=.*$", service, re.M),
                         ["ExecStart=/usr/bin/python3 -I -S -B /usr/local/sbin/dems-core-netalias"])
        for line in ("User=root", "StandardInput=socket", "StandardOutput=socket", "StandardError=journal", "NoNewPrivileges=yes",
                     "CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW", "RuntimeDirectory=dems-core-netalias/marks"):
            self.assertIn("\n" + line + "\n", service)
        self.assertIsNone(re.search(r"^(Environment|EnvironmentFile|PassEnvironment)=", service, re.M))
        self.assertNotIn("%", service.replace("# ", ""), "no specifier: nothing of the connection reaches the command line")
        with open(os.path.join(HERE, "dems-core-netalias.socket"), encoding="ascii") as handle:
            unit = handle.read()
        for line in ("ListenStream=/run/dems-core-netalias/socket", "SocketUser=root", "SocketGroup=dems-netalias", "SocketMode=0660",
                     "Accept=yes", "MaxConnections=1", "MaxConnectionsPerSource=1"):
            self.assertIn("\n" + line + "\n", unit)
        self.assertEqual(len(re.findall(r"^Listen[A-Za-z]*=", unit, re.M)), 1, "one local socket, no network address")


class Bound8And9JournalAndCodes(HelperCase):
    """S13-08 (8), (9): one journal line per call (checked on every run of this file), fixed codes, no caller text."""

    def test_the_codes_are_distinct(self):
        self.assertEqual(len(set(CODES.values())), len(CODES))
        self.assertEqual(CODES["OK"], 0)
        self.assertGreaterEqual(len(CODES), 30)
        self.assertTrue(all(0 < code < 126 for name, code in CODES.items() if name != "OK"))

    def test_no_text_of_the_caller_reaches_the_answer_or_the_journal(self):
        for request in (b"ZZMARKERZZ 192.168.1.250/24 30\n", b"add ZZMARKERZZ/24 30\n", b"add 192.168.1.250/24 ZZMARKERZZ\n",
                        b"del ZZMARKERZZ\n", b"add 8.8.8.8/24 30\n", b"add 192.168.1.250/16 30\n", b"ZZMARKERZZ\n",
                        b"add 192.168.1.250/24 30 ZZMARKERZZ\n", b"ZZMARKERZZ" * 30 + b"\n"):
            with self.subTest(request=request):
                bench = self.bench()
                bench.plan()
                ours, theirs = socket.socketpair()
                done = subprocess.Popen([sys.executable, "-I", "-S", "-B", bench.copy], stdin=theirs.fileno(),
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={})
                theirs.close()
                try:
                    ours.sendall(request)
                except OSError:
                    pass
                answer, journal = done.communicate(timeout=30)
                ours.close()
                for output in (answer, journal):
                    self.assertNotIn(b"ZZMARKERZZ", output)
                    self.assertNotIn(b"8.8.8.8", output)
                    self.assertNotIn(b"/16", output)
                self.assertRegex(journal.decode(), r"address=- result=")

    def test_one_journal_line_for_a_done_call_names_user_verb_address_result(self):
        bench = self.bench()
        _, match = bench.run(ADD, expect="OK")
        self.assertEqual(match.group(0), "dems-core-netalias: caller_uid=%d verb=add address=192.168.1.250/24 result=OK code=0\n" % os.getuid())
        bench.hold("192.168.1.250")
        _, match = bench.run(DEL, expect="OK")
        self.assertEqual(match.group(0), "dems-core-netalias: caller_uid=%d verb=del address=192.168.1.250/24 result=OK code=0\n" % os.getuid())


class TheFormOfTheCall(HelperCase):
    """Decision C19 (decisions/103, PF-3 to PF-5, PF-10): one line on the connection, no argument, the peer checked."""

    def test_any_command_line_argument_is_refused(self):
        for arguments in (["add", "192.168.1.250/24"], ["add", "eth1", "192.168.1.250/24"], ["--help"], ["-h"], ["check", "x"],
                          ["--check"], ["Check"], ["-c", "import os"], [""], ["listen", "eth1", "5"]):
            with self.subTest(arguments=arguments):
                self.refused_without_any_tool(self.bench(), ADD, "ARGUMENTS", arguments=arguments)

    def test_malformed_input(self):
        for request in (b"\n", b" \n", b"add\n", b"del\n", b"add 192.168.1.250/24\n", b"del 192.168.1.250/24 30\n",
                        b" add 192.168.1.250/24 30\n", b"add  192.168.1.250/24 30\n", b"add 192.168.1.250/24 30 \n",
                        b"add\t192.168.1.250/24\t30\n", b"add 192.168.1.250/24 30\r\n", b"add 192.168.1.250/24 30\x00\n",
                        b"add 192.168.1.250/24 3\xc2\xa00\n", b"\xff\xfe\n", b"add 192.168.1.250/24 30\x7f\n", b"\x1b[2Jadd 192.168.1.250/24 30\n"):
            with self.subTest(request=request):
                self.refused_without_any_tool(self.bench(), request, "REQUEST_MALFORMED")

    def test_a_request_without_a_line_end_and_an_empty_connection(self):
        self.refused_without_any_tool(self.bench(), b"add 192.168.1.250/24 30", "REQUEST_MALFORMED", end=True)
        self.refused_without_any_tool(self.bench(), b"", "REQUEST_MALFORMED", end=True)

    def test_a_second_line_is_refused(self):
        for request in (ADD + DEL, ADD + ADD, ADD + b"\n", ADD + b"x", DEL + b"add 10.0.0.9/24 30\n"):
            with self.subTest(request=request):
                bench = self.bench()
                bench.mark("192.168.1.250")
                bench.run(request, expect="REQUEST_MALFORMED")
                self.assertEqual(bench.vectors(), [])

    def test_oversized_input(self):
        valid_then_padding = b"add 192.168.1.250/24 30" + b" " * 41  # 64 bytes, the line end is byte 65
        for request, expect in ((valid_then_padding + b"\n", "REQUEST_TOO_LONG"), (b"a" * 65 + b"\n", "REQUEST_TOO_LONG"),
                                (b"add " + b"1" * 4096 + b"\n", "REQUEST_TOO_LONG"), (b"x" * 200000, "REQUEST_TOO_LONG"),
                                (b"a" * 63 + b"\n", "VERB_UNKNOWN"), (b"add 192.168.1.250/24 30" + b" " * 40 + b"\n", "REQUEST_MALFORMED")):
            with self.subTest(length=len(request)):
                self.refused_without_any_tool(self.bench(), request, expect)

    def test_unknown_verbs_and_the_third_verb_of_input_av(self):
        for request in (b"listen eth1 5\n", b"ADD 192.168.1.250/24 30\n", b"Del 192.168.1.250/24\n", b"replace 192.168.1.250/24\n",
                        b"flush\n", b"check\n", b"addr 192.168.1.250/24 30\n", b"delete 192.168.1.250/24\n"):
            with self.subTest(request=request):
                self.refused_without_any_tool(self.bench(), request, "VERB_UNKNOWN")

    def test_a_peer_that_is_not_the_service_user_is_refused(self):
        bench = self.bench(service_uid=os.getuid() + 1)
        match = self.refused_without_any_tool(bench, ADD, "PEER_NOT_SERVICE_USER")
        self.assertEqual(match.group(1), str(os.getuid()), "the journal names the user the kernel reported")
        self.assertEqual((match.group(2), match.group(3)), ("-", "-"), "the request of a foreign peer is not read")

    def test_standard_input_that_is_not_a_local_socket_has_no_caller(self):
        match = self.refused_without_any_tool(self.bench(), ADD, "PEER_UNKNOWN", pipe=True)
        self.assertEqual(match.group(1), "-")

    def test_the_service_user_is_the_one_member_of_the_group_or_nobody(self):
        for members, uid, group in ((["dems-core", "mallory"], os.getuid(), "dems-netalias"), ([], os.getuid(), "dems-netalias"),
                                    (["ghost"], os.getuid(), "dems-netalias"), (["dems-core"], os.getuid(), "audio2"),
                                    (["dems-core"], 0, "dems-netalias"), (["Dems Core"], os.getuid(), "dems-netalias")):
            with self.subTest(members=members, uid=uid, group=group):
                bench = self.bench()
                bench.accounts(members, uid, group)
                self.refused_without_any_tool(bench, ADD, "SERVICE_USER_UNRESOLVED")
        bench = self.bench()
        os.chmod(bench.path("etc/group"), 0o666)
        self.refused_without_any_tool(bench, ADD, "SERVICE_USER_UNRESOLVED")

    def test_a_silent_connection_is_closed_after_the_time_bound(self):
        self.refused_without_any_tool(self.bench(), b"add 192.168.1.250/24", "REQUEST_TIMEOUT")

    def test_check_reads_and_changes_nothing(self):
        bench = self.bench()
        _, match = bench.run(b"", arguments=["check"], pipe=True, expect="OK")
        self.assertEqual(bench.vectors(), [["ip"] + ROUTE])
        self.assertEqual((match.group(1), match.group(2), match.group(3)), (str(os.getuid()), "check", "-"))
        os.unlink(bench.path("tools/arping"))
        bench.run(b"", arguments=["check"], pipe=True, expect="CONFLICT_TOOL_MISSING")
        self.assertEqual(bench.vectors(), [])
        bench.run(ADD, arguments=["check"], expect="CONFLICT_TOOL_MISSING")
        self.assertEqual(bench.marks(), [])


CAPTURED = os.path.join(HERE, "captured")
# (file under captured/arping, the interface and the address that run asked, its exit status, the verdict).
# The table of captured/README.md, which is the table of test/h3_helper_parser_captures.md section 5.
CAPTURED_ARPING = (
    ("iputils_free_other_subnet.stdout", "eth0", "192.168.1.250", 0, "FREE"),
    ("iputils_free_same_subnet.stdout", "eth0", "172.31.203.222", 0, "FREE"),
    ("iputils_in_use.stdout", "eth0", "172.31.203.50", 1, "ADDRESS_IN_USE"),
    ("iputils_loopback_not_arpable.stdout", "lo", "192.0.2.1", 0, "CONFLICT_RESULT_UNKNOWN"),
    ("iputils_noarp_not_arpable.stdout", "h3na", "203.0.113.77", 0, "CONFLICT_RESULT_UNKNOWN"),
    ("iputils_interface_down.stdout", "h3dn", "192.0.2.77", 2, "CONFLICT_CHECK_FAILED"),
    # The text and the status of a free address although nobody could be asked: only the flag words stop it.
    ("iputils_no_carrier_prints_free.stdout", "h3nc", "198.51.100.77", 0, "FREE"),
    ("iputils_no_such_interface.stdout", "h3none", "192.0.2.1", 2, "CONFLICT_CHECK_FAILED"),
    ("other_program_free.stdout", "eth0", "172.31.203.223", 1, "CONFLICT_RESULT_UNKNOWN"),
    ("other_program_in_use.stdout", "eth0", "172.31.203.50", 0, "CONFLICT_RESULT_UNKNOWN"),
)
# (file under captured/ip, {interface: the refusal of the flag check, None when the port may be asked}).
# Section 4 of the same record. `h3none` is in no listing.
CAPTURED_LISTINGS = (
    ("addr_eth0_and_lo.json", {"eth0": None, "lo": "INTERFACE_NOT_ARPABLE", "h3none": "INTERFACE_STATE_UNKNOWN"}),
    ("addr_made_interfaces.json", {
        "eth0": None, "h3up": None, "lo": "INTERFACE_NOT_ARPABLE", "h3na": "INTERFACE_NOT_ARPABLE",
        "h3dm": "INTERFACE_NOT_ARPABLE", "h3dn": "INTERFACE_DOWN", "h3nc": "INTERFACE_DOWN",
        "h3none": "INTERFACE_STATE_UNKNOWN"}),
    ("addr_eth0_down.json", {"eth0": "INTERFACE_DOWN", "h3up": None, "lo": "INTERFACE_NOT_ARPABLE"}),
)
# Captures no function of the helper reads: what the container showed beside the two records.
CAPTURED_NOT_AN_INPUT = ("README.md", "dpkg/dpkg_S_usr_bin_arping.txt", "dpkg/ls_ln_dpkg_info.txt")


def captured(relative):
    """One captured text, byte for byte."""
    with open(os.path.join(CAPTURED, relative), "rb") as handle:
        return handle.read()


class CapturedTexts(HelperCase):
    """Pass I-9b: the real tool texts of row H3 (`captured/`, an Ubuntu 24.04 CONTAINER, not a host) are fed
    to the helper's own reading functions, each with the verdict the record of row H3 states.

    HOW. The functions are those of a TEST COPY (never of the delivered file): its text is executed without
    its last line, the call of `main`, so nothing is served and the constants are the bench's - the two
    tools are the recording doubles, every path lies in the temporary folder. A listing reaches `host_state`
    as the standard output of the `ip` double, a conflict text reaches `conflict_verdict` as the bytes of
    the file. No real tool is started and no file of this Mac outside the bench is read.
    """

    def functions(self, bench):
        with open(bench.copy, encoding="ascii") as handle:
            text = handle.read()
        self.assertTrue(text.endswith("\nmain()\n"), "the last line of the helper is the call of main")
        namespace = {"__name__": "captured_texts"}
        exec(compile(text[: -len("main()\n")], bench.copy, "exec"), namespace)  # noqa: S102 - the test copy
        return namespace

    def plan_captured(self, bench, listing, arping_exit=97, arping_text=""):
        """The doubles answer with captured bytes; `Bench.run` calls this in the place of its own plan."""
        rules = [
            {"tool": "ip", "prefix": ROUTE, "exit": 0, "stdout": captured("ip/route_default_none.json").decode("ascii")},
            {"tool": "ip", "prefix": ADDRS, "exit": 0, "stdout": captured("ip/" + listing).decode("ascii")},
            {"tool": "ip", "prefix": ["addr", "add"], "exit": 0},
            {"tool": "arping", "prefix": [], "exit": arping_exit, "stdout": arping_text},
        ]
        bench.plan = lambda: bench.write(bench.path("tools/plan.json"), json.dumps(rules))
        bench.plan()

    def test_every_captured_file_is_read_by_a_case_of_this_class(self):
        found = sorted(os.path.relpath(os.path.join(folder, name), CAPTURED).replace(os.sep, "/")
                       for folder, _, names in os.walk(CAPTURED) for name in names)
        read = (["arping/" + row[0] for row in CAPTURED_ARPING] + ["ip/" + row[0] for row in CAPTURED_LISTINGS]
                + ["ip/route_default_none.json"] + list(CAPTURED_NOT_AN_INPUT)
                + ["dpkg/" + name for name in ("iputils-arping.list", "iputils-arping.md5sums",
                                               "other_package_arping.list", "other_package_arping.md5sums")])
        self.assertEqual(found, sorted(read))
        self.assertEqual(len(found), 21)

    def test_the_ten_conflict_texts_get_the_verdict_the_record_states(self):
        helper = self.functions(self.bench())
        for name, interface, address, status, verdict in CAPTURED_ARPING:
            with self.subTest(capture=name):
                quad = helper["parse_quad"](address)
                self.assertEqual(helper["conflict_verdict"](status, captured("arping/" + name), interface, quad), verdict)
        # The same bytes under the other status, another interface or another address are no result.
        free = captured("arping/iputils_free_other_subnet.stdout")
        quad = helper["parse_quad"]("192.168.1.250")
        self.assertEqual(helper["conflict_verdict"](1, free, "eth0", quad), "CONFLICT_RESULT_UNKNOWN")
        self.assertEqual(helper["conflict_verdict"](0, free, "eth1", quad), "CONFLICT_RESULT_UNKNOWN")
        self.assertEqual(helper["conflict_verdict"](0, free, "eth0", helper["parse_quad"]("192.168.1.251")), "CONFLICT_RESULT_UNKNOWN")
        self.assertEqual(helper["conflict_verdict"](0, captured("arping/iputils_in_use.stdout"), "eth0", helper["parse_quad"]("172.31.203.50")),
                         "CONFLICT_RESULT_UNKNOWN")

    def test_the_three_listings_and_the_route_text_are_read_and_each_port_gets_its_flag_verdict(self):
        for listing, ports in CAPTURED_LISTINGS:
            bench = self.bench()
            helper = self.functions(bench)
            self.plan_captured(bench, listing)
            self.assertEqual(helper["default_route_interfaces"](), set(), "an internal network has no default route")
            addresses, flags = helper["host_state"]()
            self.assertEqual(sorted(flags), sorted(entry["ifname"] for entry in json.loads(captured("ip/" + listing))))
            self.assertNotIn(None, flags.values(), "every flag word of the real listing is one the helper reads")
            for interface, refusal in ports.items():
                with self.subTest(listing=listing, interface=interface):
                    if refusal is None:
                        helper["refuse_unless_askable"](interface, flags)
                        continue
                    with self.assertRaises(helper["Refusal"]) as raised:
                        helper["refuse_unless_askable"](interface, flags)
                    self.assertEqual(raised.exception.name, refusal)
            # The lifetime: 4294967295 for an address without one, the seconds left for one that has one.
            self.assertIn(("lo", (127, 0, 0, 1), 8, FOREVER), addresses)
            self.assertNotIn(None, [lifetime for _, _, _, lifetime in addresses])
            if listing != "addr_eth0_and_lo.json":
                self.assertIn(("h3na", (10, 203, 5, 10), 24, 300 if listing == "addr_made_interfaces.json" else 288), addresses)
            self.assertEqual([call["argv"] for call in bench.calls()], [ROUTE, ADDRS], "two reads, nothing else was started")

    def test_through_the_helper_a_free_address_on_the_captured_port_is_added_and_a_port_without_carrier_is_never_asked(self):
        free = captured("arping/iputils_free_other_subnet.stdout").decode("ascii")  # eth0, 192.168.1.250: the address of ADD
        bench = self.bench()
        bench.write(bench.interface_file, "eth0\n")
        self.plan_captured(bench, "addr_eth0_and_lo.json", 0, free)
        bench.run(ADD, expect="OK")
        self.assertEqual(bench.vectors(), READS + [["arping", "-D", "-c", "2", "-w", "3", "-I", "eth0", "192.168.1.250"],
                                                   ["ip", "addr", "add", "192.168.1.250/24", "dev", "eth0", "valid_lft", "1800", "preferred_lft", "1800"]])
        self.assertEqual(bench.marks(), ["192.168.1.250"])
        # Observation O-1 of row H3: without carrier the program prints the whole free text and ends 0.
        # The double WOULD print exactly that captured text; the flag words (no LOWER_UP) refuse first.
        bench = self.bench()
        os.mkdir(bench.path("sys/h3nc"))
        bench.write(bench.interface_file, "h3nc\n")
        self.plan_captured(bench, "addr_made_interfaces.json", 0, captured("arping/iputils_no_carrier_prints_free.stdout").decode("ascii"))
        bench.run(ADD, expect="INTERFACE_DOWN")
        self.assertEqual(bench.vectors(), READS, "the conflict tool is not started, nothing is added")
        self.assertEqual(bench.marks(), [])

    def test_the_two_package_records_have_the_form_the_program_check_reads(self):
        bench = self.bench()
        helper = self.functions(bench)
        # The records name the delivered path; the PROGRAM is a stand-in of the bench (the captured program is not in the repository).
        delivered = build.delivered_constants()
        helper["ARPING_TOOL"] = delivered["ARPING_TOOL"]
        helper["_read_program"] = lambda path, limit: captured("README.md") if path == delivered["ARPING_TOOL"] else b""
        self.assertEqual(captured("dpkg/dpkg_S_usr_bin_arping.txt").decode("ascii"), "%s: %s\n" % (helper["CONFLICT_PACKAGE"], delivered["ARPING_TOOL"]))

        def records(package, listing, sums):
            for name in os.listdir(bench.path("dpkg")):
                os.unlink(bench.path("dpkg/" + name))
            for suffix, data in ((".list", listing), (".md5sums", sums)):
                with open(bench.path("dpkg/" + package + suffix), "wb") as handle:
                    handle.write(data)
                os.chmod(bench.path("dpkg/" + package + suffix), 0o644)  # the mode of captured/dpkg/ls_ln_dpkg_info.txt
            return helper["_expected_conflict_tool"]()

        listing, sums = captured("dpkg/iputils-arping.list"), captured("dpkg/iputils-arping.md5sums")
        recorded = b"4e42a0d8a1cfd199153cb067545913f6  usr/bin/arping\n"
        self.assertEqual(sums.count(recorded), 1)
        # Byte for byte: the records are read, and a program that is not the recorded one is refused (state 7 of the record: 38).
        self.assertFalse(records("iputils-arping", listing, sums))
        # THE FORM (state 1): the same two files with ONE field replaced, the checksum, by the stand-in's own - then the check passes.
        own = hashlib.md5(captured("README.md"), usedforsecurity=False).hexdigest().encode("ascii")
        self.assertTrue(records("iputils-arping", listing, sums.replace(recorded[:32], own)))
        # The OTHER package's records, under its own name (states 5, 6) and in the place of the expected ones: refused.
        other = captured("dpkg/other_package_arping.list"), captured("dpkg/other_package_arping.md5sums")
        self.assertFalse(records("arping", *other))
        self.assertFalse(records("iputils-arping", *other))
        self.assertFalse(records("iputils-arping", listing, other[1]))
        self.assertEqual(bench.calls(), [], "nothing is started to learn this")


if __name__ == "__main__":
    unittest.main(verbosity=1)
