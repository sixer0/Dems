"""Protocol tests without opening USB; exercises the supplied backend implementation."""
import importlib.util
import pathlib
import sys
import time
import types
import unittest
from unittest.mock import patch

sys.modules.setdefault('serial', types.ModuleType('serial'))
spec = importlib.util.spec_from_file_location('lcd_backend', pathlib.Path(__file__).parents[1] / 'app/dems_backend.py')
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class BackendTests(unittest.TestCase):
    def setUp(self):
        for channel in backend.CH:
            channel.update(rec=False, cam=False, file='', set_at=0.0, last_post=0.0, expires_at=0.0, src='-')
        backend.EVENTS.clear()
        backend.G.update(health_override=None, health_note='', last_req_ms=0, tx=0)

    def test_lease_renewal_keeps_recording_start_time(self):
        backend.set_channel([0], {'rec': 'start', 'cam': True, 'lease': 6}, 'test')
        started = backend.CH[0]['set_at']
        expiry = backend.CH[0]['expires_at']
        backend.set_channel([0], {'rec': 'start', 'cam': True, 'lease': 6}, 'test')
        self.assertEqual(backend.CH[0]['set_at'], started)
        self.assertGreaterEqual(backend.CH[0]['expires_at'], expiry)

    def test_reaper_stops_expired_recording(self):
        backend.set_channel([0], {'rec': 'start', 'lease': 1}, 'test')
        backend.CH[0]['expires_at'] = time.time() - 1
        with patch.object(backend.time, 'sleep', side_effect=[None, StopIteration]):
            with self.assertRaises(StopIteration):
                backend.reaper()
        self.assertFalse(backend.CH[0]['rec'])
        self.assertEqual(backend.EVENTS[-1]['action'], 'STOP_LEASE_HABIS')

    def test_stop_and_clear_file(self):
        backend.set_channel([0], {'rec': 'start', 'file': 'synthetic.wav', 'cam': True}, 'test')
        reply = backend.set_channel([0], {'rec': 'stop', 'clear_file': True, 'cam': False}, 'test')
        self.assertEqual(reply['rec'], 'stop')
        self.assertEqual(backend.CH[0]['file'], '')
        self.assertFalse(reply['ch'][0]['cam'])

    def test_d57_login_gate_accepts_vendor_identity_not_role(self):
        # root berperan SUPERVISOR: gerbang D57 melihat nama akun, bukan peran.
        ses = {'session': {'operator': {'id': '1', 'role': 'SUPERVISOR', 'username': 'root', 'displayName': 'Root'}}}
        hdrs = {'Set-Cookie': 'dems_session=abc; HttpOnly'}
        with patch.object(backend, '_core_call', return_value=(200, ses, hdrs)) as call:
            token, err, info = backend.teknisi_login('root', 'rahasia')
        self.assertEqual(err, '')
        self.assertIsNotNone(token)
        self.assertEqual(info['akun'], 'root')
        with backend.L:
            self.assertEqual(backend.SETUP[token]['akun'], 'root')
            backend.SETUP.pop(token, None)

    def test_d57_login_gate_rejects_client_account_even_with_technician_role(self):
        ses = {'session': {'operator': {'id': '2', 'role': 'TECHNICIAN', 'username': 'rina.wijaya'}}}
        hdrs = {'Set-Cookie': 'dems_session=xyz; HttpOnly'}
        seen = []
        def fake_call(path, obj=None, cookie=None, **kw):
            seen.append(path)
            return (200, ses, hdrs) if path.endswith('sign-in') else (200, {}, {})
        with patch.object(backend, '_core_call', side_effect=fake_call):
            token, err, info = backend.teknisi_login('rina.wijaya', 'rahasia')
        self.assertIsNone(token)
        self.assertIn('root / gsp.teknisi', err)
        self.assertIn('/api/v1/auth/sign-out', seen)  # sesi klien langsung ditutup

    def test_d57_reverification_follows_account_not_role(self):
        with backend.L:
            backend.SETUP['t'] = {'core_cookie': 'c', 'peran': 'TECHNICIAN', 'nama': 'Rina',
                                  'akun': 'rina.wijaya', 'dibuat': time.time(), 'exp': time.time() + 60}
        ses = {'operator': {'role': 'TECHNICIAN', 'username': 'rina.wijaya'}}
        with patch.object(backend, '_core_call', return_value=(200, ses, {})):
            ok, err, _info = backend.teknisi_peran('t')
        self.assertFalse(ok)
        self.assertIn('rina.wijaya', err)
        with backend.L:
            backend.SETUP.pop('t', None)

    def test_initial_cameras_are_never_green(self):
        reply = backend.snapshot()
        self.assertEqual(reply['v'], 2)
        self.assertTrue(all(not ch['cam'] and ch['rec'] == 'stop' for ch in reply['ch']))
        self.assertLess(len(backend.json.dumps(reply).encode()), 640)


if __name__ == '__main__':
    unittest.main()
