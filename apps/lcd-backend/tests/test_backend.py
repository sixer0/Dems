"""Protocol tests without opening USB; exercises the supplied backend implementation."""
import importlib.util
import pathlib
import sys
import time
import types
import unittest
import io
import json
from unittest.mock import MagicMock, patch

sys.modules.setdefault('serial', types.ModuleType('serial'))
spec = importlib.util.spec_from_file_location('lcd_backend', pathlib.Path(__file__).parents[1] / 'app/dems_backend.py')
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class _Stop(BaseException):
    """Escapes serial_worker's endless loops; BaseException so its `except Exception` does not catch it."""


def _handler(path, body=None, headers=None):
    """An H instance without a socket: enough state for do_POST and _send."""
    h = backend.H.__new__(backend.H)
    raw = json.dumps(body).encode() if body is not None else b''
    h.path, h.command, h.request_version = path, 'POST', 'HTTP/1.1'
    h.requestline = 'POST %s HTTP/1.1' % path
    h.client_address = ('127.0.0.1', 50000)
    h.headers = dict(headers or {}, **{'Content-Length': str(len(raw))})
    h.rfile, h.wfile = io.BytesIO(raw), io.BytesIO()
    h.close_connection = False
    return h


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


    # ── row 97 (C-LCD): DF-34, DF-36, DF-38 ──
    def test_df34_successful_open_clears_stale_last_err(self):
        backend.G['last_err'] = 'USB putus: lama'
        seen = []
        port = MagicMock()
        def read(_n):
            seen.append(backend.G['last_err'])
            raise _Stop()
        port.read.side_effect = read
        with patch.object(backend, 'resolve_port', return_value=('/dev/ttyTEST', 'uji')), \
             patch.object(backend.serial, 'Serial', create=True, return_value=port), \
             patch.object(backend, 'logo_jadwalkan'), patch.object(backend, 'log'), \
             patch.object(backend.time, 'sleep'):
            with self.assertRaises(_Stop):
                backend.serial_worker()
        self.assertEqual(seen, [''])
        self.assertEqual(backend.G['last_err'], '')     # the value GET /api/dems/status serves

    def test_df36_json_door_rejects_both_and_defaults_to_client(self):
        gate = (True, '', {'nama': 'uji'}, None)
        with patch.object(backend, 'gerbang_teknisi', return_value=gate), \
             patch.object(backend, 'siapkan_logo', return_value=(b'\x00\x00', 1, 1)) as prep, \
             patch.object(backend, 'simpan_logo') as keep, patch.object(backend, 'logo_antre') as queue, \
             patch.object(backend, 'event'):
            for target in ('both', 'BOTH', 'semua'):
                h = _handler('/api/dems/setup', {'logo_base64': 'AA==', 'logo_target': target})
                with patch.object(backend.H, '_send') as send:
                    h.do_POST()
                self.assertEqual(send.call_args.args[0], 400, target)
                self.assertNotIn('both', send.call_args.args[1]['error'])
            prep.assert_not_called(); keep.assert_not_called(); queue.assert_not_called()
            for body in ({'logo_base64': 'AA=='}, {'logo_base64': 'AA==', 'logo_target': ''}):
                h = _handler('/api/dems/setup', body)
                with patch.object(backend.H, '_send') as send:
                    h.do_POST()
                self.assertEqual(send.call_args.args[0], 200)
            self.assertEqual([c.args[0] for c in queue.call_args_list], ['client', 'client'])

    def test_df36_push_door_rejects_both_before_queueing(self):
        gate = (True, '', {'nama': 'uji'}, None)
        with patch.object(backend, 'gerbang_teknisi', return_value=gate), \
             patch.object(backend, 'logo_antre', return_value='antre') as queue:
            for given in ('both', 'semua', 'none'):
                h = _handler('/api/dems/logo/push')
                with patch.object(backend.H, '_form', return_value=(b'x', {'id': given}, {})), \
                     patch.object(backend.H, '_send') as send:
                    h.do_POST()
                self.assertEqual(send.call_args.args[0], 400, given)
            queue.assert_not_called()
            h = _handler('/api/dems/logo/push')
            with patch.object(backend.H, '_form', return_value=(b'x', {'id': 'splash'}, {})), \
                 patch.object(backend.H, '_send') as send:
                h.do_POST()
            self.assertEqual(send.call_args.args[0], 200)
            self.assertEqual([c.args[0] for c in queue.call_args_list], ['splash'])

    def test_df38_client_hangup_during_reply_logs_one_line(self):
        h = _handler('/api/dems/status')
        h.command = 'GET'
        h.wfile = MagicMock()
        h.wfile.write.side_effect = BrokenPipeError(32, 'Broken pipe')
        with patch.object(backend, 'log') as log, patch.object(backend.H, 'log_message'):
            h._send(200, {'ok': True})          # must not raise
        self.assertEqual(log.call_count, 1)
        self.assertIn('BrokenPipeError', log.call_args.args[0])
        self.assertTrue(h.close_connection)


if __name__ == '__main__':
    unittest.main()
