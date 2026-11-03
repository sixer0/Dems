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

    def test_initial_cameras_are_never_green(self):
        reply = backend.snapshot()
        self.assertEqual(reply['v'], 2)
        self.assertTrue(all(not ch['cam'] and ch['rec'] == 'stop' for ch in reply['ch']))
        self.assertLess(len(backend.json.dumps(reply).encode()), 640)


if __name__ == '__main__':
    unittest.main()
