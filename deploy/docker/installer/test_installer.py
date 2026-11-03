"""Installer behavior tests: every Docker operation is a local stub, never a real deployment."""
import hashlib
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).with_name('install.sh')

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='dems-installer-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        shutil.copy2(SOURCE, self.root / 'install.sh')
        (self.root / 'PACKAGE-ARCH').write_text('amd64\n')
        (self.root / 'images.env').write_text('DEMS_IMAGE=dems/test:core\nDEMS_POSTGRES_IMAGE=dems/test:postgres\n')
        (self.root / 'images.tar.gz').write_bytes(b'synthetic image fixture; never loaded')
        (self.root / 'compose.yaml').write_text('services: {}\n')
        (self.root / '.env.example').write_text('DEMS_CORE_PORT=4420\n')
        self.checksums()
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        tools = {
          'uname': '#!/bin/bash\n[ "$1" = -s ] && echo Linux || echo x86_64\n',
          'ss': '#!/bin/bash\nexit 0\n',
          'readlink': '#!/bin/bash\necho \"$2\"\n',
          'stat': '#!/bin/bash\necho 20\n',
          'docker': '''#!/bin/bash
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
case "$*" in
  'context inspect '*) echo unix:///var/run/docker.sock ;;
  'info '*) echo 'Ubuntu 24.04' ;;
  'volume inspect '*) [ "${MOCK_VOLUME:-0}" = 1 ] && exit 0 || exit 1 ;;
  'image inspect '*) echo amd64 ;;
  'inspect '*) echo healthy ;;
  *'ps -q '*) echo synthetic-container-id ;;
esac
exit 0
'''
        }
        for name, text in tools.items():
            path = bin_dir / name
            path.write_text(text)
            path.chmod(0o755)
        self.env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'], MOCK_DOCKER_LOG=str(self.root/'docker.log'))
        self.env.pop('DOCKER_HOST', None)

    def checksums(self):
        files = ['install.sh', 'PACKAGE-ARCH', 'images.env', 'images.tar.gz', 'compose.yaml', '.env.example']
        (self.root / 'SHA256SUMS').write_text(''.join(hashlib.sha256((self.root/f).read_bytes()).hexdigest()+'  '+f+'\n' for f in files))

    def run_installer(self, *args):
        return subprocess.run(['bash', str(self.root/'install.sh'), *args], cwd=self.root, env=self.env, text=True, capture_output=True, timeout=10)

    def test_verify_has_no_docker_side_effects(self):
        r = self.run_installer('verify')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse((self.root/'docker.log').exists())

    def test_corrupt_payload_refused_before_docker_or_config(self):
        (self.root/'images.tar.gz').write_bytes(b'corrupt')
        self.assertNotEqual(self.run_installer('install', '--without-lcd').returncode, 0)
        self.assertFalse((self.root/'docker.log').exists())
        self.assertFalse((self.root/'.env').exists())

    def test_missing_usb_requires_explicit_opt_out(self):
        r = self.run_installer('install', '--lcd-device', '/dev/dems-nonexistent-test-panel')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('--without-lcd', r.stderr)
        self.assertFalse((self.root/'.env').exists())
        self.assertNotIn('load -i', (self.root/'docker.log').read_text())

    def test_does_not_overwrite_existing_configuration(self):
        (self.root/'.env').write_text('existing user configuration\n')
        r = self.run_installer('install', '--without-lcd')
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((self.root/'.env').read_text(), 'existing user configuration\n')
        self.assertFalse((self.root/'secrets').exists())

    def test_existing_volume_refused(self):
        self.env['MOCK_VOLUME'] = '1'
        r = self.run_installer('install', '--without-lcd')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('existing DEMS data', r.stderr)
        self.assertFalse((self.root/'secrets').exists())

    def test_wrong_architecture_refused(self):
        (self.root/'PACKAGE-ARCH').write_text('arm64\n')
        self.checksums()
        r = self.run_installer('install', '--without-lcd')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('wrong package architecture', r.stderr)
        self.assertFalse((self.root/'docker.log').exists())

    def test_new_install_offline_then_start_stop_preserve_secrets(self):
        r = self.run_installer('install', '--without-lcd')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((self.root/'.installed').is_file())
        text = (self.root/'.env').read_text()
        self.assertIn('COMPOSE_PROFILES=console\n', text)
        passwords = {p.name:p.read_bytes() for p in (self.root/'secrets').iterdir()}
        self.assertEqual(len(passwords), 3)
        self.assertEqual(len(set(passwords.values())), 3)
        calls = (self.root/'docker.log').read_text()
        self.assertIn('db:migrate --database dems_demo', calls)
        self.assertIn('--pull never', calls)
        self.assertNotIn(' pull ', calls)
        for command in ['start', 'stop', 'status']:
            self.assertEqual(self.run_installer(command).returncode, 0)
        self.assertEqual(passwords, {p.name:p.read_bytes() for p in (self.root/'secrets').iterdir()})
        self.assertNotIn('--volumes', (self.root/'docker.log').read_text())

    def test_lcd_install_sets_bridge_and_usb_group_automatically(self):
        # /dev/null is only a character-device preflight fixture; all Docker calls are stubbed.
        r = self.run_installer('install', '--lcd-device', '/dev/null')
        self.assertEqual(r.returncode, 0, r.stderr)
        text = (self.root/'.env').read_text()
        self.assertIn('COMPOSE_PROFILES=console,lcd\n', text)
        self.assertIn('DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090', text)
        self.assertIn('DEMS_LCD_SERIAL_DEVICE=/dev/null', text)
        self.assertIn('DEMS_LCD_SERIAL_GID=20', text)
        self.assertTrue((self.root/'.installed').is_file())

    def test_start_refuses_partial_install(self):
        (self.root/'.env').write_text('partial\n')
        r = self.run_installer('start')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('did not complete', r.stderr)

if __name__ == '__main__':
    unittest.main()
