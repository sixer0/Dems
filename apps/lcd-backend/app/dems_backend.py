#!/usr/bin/env python3
"""
BACKEND DEMS-EDGE — N kanal rekam, satu panel ESP32 lewat USB.

Kebenaran status ada di mesin rekam; backend hanya menjembatani dan menghitung
kesehatan. Panel melihat AGREGAT (ada/tidak ada kanal yang merekam) + strip per-kanal.

KANAL
  Nama dari env DEMS_CH_NAMES (default "CH1,CH2,CH3,CH4"); id = 1..N.

API (JSON; tanpa autentikasi — jangan dibuka ke jaringan)
  GET  /                          halaman pantau (tabel per-kanal)
  GET  /api/dems/status           semua kanal + agregat + health + statistik
  POST /api/dems/status           {"channel":1,"rec":"start","file":"CH1_0845.wav"}
                                  "channel" boleh 1..N, "CH1", daftar, atau "all"
  GET|POST /api/dems/ch/<id>/status   bentuk pendek, id di path
  POST /api/dems/ch/<id>/cam      {"connected":true|false}   kabar kehadiran kamera
  GET  /api/dems/log              jejak kejadian (audit: waktu, kanal, aksi, sumber)
  POST /api/dems/health           {"health":"warn|fail","note":"..."}; "auto"/"ok" = lepas
  GET  /healthz                   ok|warn|fail (HTTP 503 saat fail) -> healthcheck Docker

Field lain pada POST /status: "ups":"online|battery|fault", "clear_file":true,
"lease":<detik> — lihat catatan Lease di bawah. "cam":true|false (kehadiran kamera).
Kamera yang belum dilaporkan dianggap BELUM
TERCOLOK (merah) — panel tidak pernah mengarang hijau.

**Lease (TTL) untuk pemicu eksternal.** Karena yang mengirim status adalah sistem
lain di mesin ini, kegagalan mereka tidak boleh membuat panel berbohong:
`{"rec":"start","lease":120}` berarti "anggap REKAM sampai 120 detik ke depan,
kecuali kau kabar lagi". Setiap POST start memperbarui jatuh tempo. Habis lease
-> kanal jadi STOP sendiri dan tercatat sebagai `STOP_LEASE_HABIS`. Default dari
env `DEMS_LEASE_S` (0 = tanpa jatuh tempo, untuk operator yang menekan manual).
Kanal berstatus REKAM tanpa
kamera terhitung gejala nyata: health turun ke WASPADA ("CHn rekam tanpa kamera").

PANEL (USB /dev/ttyACM0; satu baris JSON + \n, hanya baris berawalan '{' = protokol)
  alat -> backend : {"v":1,"req":"status","dev":"DEMS-EDGE","up":12345}
  backend -> alat : {"v":2,"rec":"start","nrec":2,"n":4,"health":"ok","ups":"online",
                     "ch":[{"c":1,"rec":"start","file":"CH1_0845.wav"}, ...],
                     "satker":"DITRESKRIMUM POLDA METRO JAYA"}   # opsional, dari DEMS_SATKER
"""
import base64
import collections
import glob
import html
import io
import json, os, re, secrets, shutil, struct, threading, time, urllib.error, urllib.parse, urllib.request
import math
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial

# Port serial: JANGAN bergantung pada indeks /dev/ttyACMx. Nomor itu berpindah setiap
# kabel dicabut-pasang (terbukti 29 Okt: ttyACM0 -> ttyACM1), dan proses yang memegang nama
# lama tetap hidup sambil gagal membuka port — korbannya panel menampilkan BACKEND DIAM.
# Urutan pemilihan: (1) DEMS_DEV kalau masih ada, (2) cari lewat IDENTITAS perangkat
# (DEMS_USB_SERIAL, opsional dipersempit DEMS_USB_VIDPID), (3) glob /dev/serial/by-id.
# Perangkat lain di mesin yang sama (Uno R3, antarmuka audio USB) tidak pernah dibuka:
# yang tidak cocok identitasnya dilewati, bukan dicoba.
DEV          = os.environ.get("DEMS_DEV", "/dev/ttyACM0")
WANT_SERIAL  = os.environ.get("DEMS_USB_SERIAL", "").strip()
WANT_VIDPID  = os.environ.get("DEMS_USB_VIDPID", "").strip().lower()
RETRY_S      = float(os.environ.get("DEMS_USB_RETRY_S", "2"))      # backoff sampai 10 dtk
# Line DTR/RTS: dipasang SATU KALI setelah open dan tidak pernah diutak-atik lagi, supaya
# reconnect tidak memancing rangkaian auto-reset ESP32 (EN/GPIO0). Bisa diubah kalau papan
# tertentu butuh keadaan lain; efeknya dipantau lewat penghitung uptime panel (lihat "up").
DTR_ON       = os.environ.get("DEMS_DTR", "1") not in ("0", "", "false")
RTS_ON       = os.environ.get("DEMS_RTS", "1") not in ("0", "", "false")
BAUD         = int(os.environ.get("DEMS_BAUD", "115200"))
PORT       = int(os.environ.get("DEMS_PORT", "8090"))
# Default AMAN: loopback saja. API ini tidak punya autentikasi, dan di deploy native
# (mesin DEMS Edge) ia ikut terpapar ke LAN kalau bind melebar. Jalur Docker menutupinya
# lewat publish "127.0.0.1:8090:8090" + DEMS_BIND=0.0.0.0 eksplisit di docker-compose.yml
# (di dalam network namespace kontainer, bind loopback justru membuat port publish mati).
BIND       = os.environ.get("DEMS_BIND", "127.0.0.1")
# Sumber kebenaran sisa ruang rekam. Di mesin DEMS Edge variabel ini bernama
# DEMS_MEDIA_DIR (dipakai Core, ada di /etc/dems/core.env); DEMS_REKAM_DIR tetap
# diterima untuk kompatibilitas deployment lama & kontainer. Kalau keduanya kosong,
# /data/rekam (jalur Docker). Yang penting direktorinya bisa di-stat oleh user
# service — kalau tidak, health() melapor "dir tak terbaca" dan layar WASPADA selamanya.
REKAM_DIR  = (os.environ.get("DEMS_REKAM_DIR") or os.environ.get("DEMS_MEDIA_DIR")
              or "/data/rekam")
MIN_FREE_GB  = float(os.environ.get("DEMS_MIN_FREE_GB", "20"))
CRIT_FREE_GB = float(os.environ.get("DEMS_CRIT_FREE_GB", "5"))
CH_STALE_S = int(os.environ.get("DEMS_CH_STALE_S", "0"))    # >0: REC tanpa kabar = WASPADA
LEASE_DEFAULT = float(os.environ.get("DEMS_LEASE_S", "0"))   # TTL default 'start' (0 = tanpa)
PANEL_SILENT_S = float(os.environ.get("DEMS_PANEL_SILENT_S", "10"))
PUSH_S     = float(os.environ.get("DEMS_PUSH_S", "1.0"))    # dorong status tiap sekian detik
# Satu sesi DEMS Edge = SATU kamera; dua view yang tampil di layar adalah dua LENSA pada
# kamera yang sama (VIDEO-01 + VIDEO-02 menunjuk ke perangkat yang sama, profil berbeda).
# Jembatan LCD DEMS Core mengirim satu entri per TREK, jadi mode 'device' menggabungkan trek
# yang perangkatnya sama -> satu kanal panel = satu kamera fisik = satu relay.
# 'track' = perilaku lama (satu trek = satu kanal), dipakai kalau dua kamera memang terpasang.
CH_MODE    = (os.environ.get("DEMS_CH_MODE", "track").strip().lower() or "track")
NAMES      = [s.strip() for s in
              os.environ.get("DEMS_CH_NAMES", "CH1,CH2,CH3,CH4").split(",") if s.strip()]
N = len(NAMES)
# ── Identitas layar, dan LAPISANNYA (ditegaskan prinsipal DEMS Edge, 29 Okt) ──────────
#   DEMS_CLIENT  = nama client/pemakai produk (baris ke-2 header, dulu "BARESKRIM - POLRI"
#                  yang dipatenkan di firmware). Diisi saat PROSES PRE-DELIVER oleh prinsipal
#                  → penulisannya dijaga DEMS_PROVISION_KEY.
#   DEMS_SATKER  = satuan kerja tempat mesin terpasang (baris ke-3). Boleh diisi/diubah
#                  SETELAH serah-terima → tidak dikunci kunci provisi.
# Nilai runtime disimpan di file (DEMS_IDENTITY_FILE) supaya bertahan lewat restart service;
# env hanya nilai awal. Panel membacanya dari payload yang sama seperti field lain.
SATKER_DEFAULT  = os.environ.get("DEMS_SATKER", "").strip()
# Bawaan HARUS kosong: dengan nilai contoh di sini, unit baru akan terlihat "sudah disetup"
# padahal belum, dan layar keadaan pabrik tidak pernah muncul. Nama instansi hanya datang dari
# DEMS_CLIENT (bawaan pabrik lama) atau dari setup pre-deliver lewat /api/dems/identity.
CLIENT_DEFAULT  = os.environ.get("DEMS_CLIENT", "").strip()
IDENTITY_FILE   = os.environ.get("DEMS_IDENTITY_FILE", "").strip()
PROVISION_KEY   = os.environ.get("DEMS_PROVISION_KEY", "").strip()

# ═══════════════════════════════════════════════════════════════════════════════════════
# LOGO PRE-DELIVER (lapisan L1) + GERBANG IDENTITAS AKUN VENDOR (D57)
# ───────────────────────────────────────────────────────────────────────────────────────
# Kontrak ke alat (ditetapkan prinsipal, sama persis dengan firmware):
#   {"evt":"logo","id":"client|splash","seq":N,"of":M,"bytes":len,"crc":CRC16,"data":"<b64>"}
#   plus "w","h" pada seq==0 ; data = potongan RGB565 little-endian (W*H*2 byte utuh)
#   crc  = CRC16-CCITT (poly 0x1021, init 0xFFFF, tanpa XOR-out) atas SELURUH gambar.
#   Alat membalas {"ack":"logo","id":...,"ok":true|false,"crc":...,"w":...,"h":...[,"why":...]}
# Satu potongan dikirim, tunggu ACK, baru potongan berikutnya — alat juga melayani
# pertanyaan status tiap 2 detik, jadi jalur ini jangan dibanjiri.
#
# Latar flatten: splash = PUTIH (layar pra-kirim berlatar putih), client = HITAM
# (pojok halaman operasi berlatar hitam). Alpha tidak ada di panel: dia dibakar ke latar.
# ═══════════════════════════════════════════════════════════════════════════════════════

LOGO_IDS      = ("client", "splash")
LOGO_DEFAULT  = {"client": (85, 48), "splash": (227, 128)}
LOGO_BG       = {"client": (0, 0, 0), "splash": (255, 255, 255)}
IDENTITY_DIR  = os.path.dirname(IDENTITY_FILE) if IDENTITY_FILE else ""
LOGO_DIR      = (os.environ.get("DEMS_LOGO_DIR") or IDENTITY_DIR or "/var/lib/dems-lcd").strip()
LOGO_CHUNK    = max(64, int(os.environ.get("DEMS_LOGO_CHUNK", "1024")))
LOGO_ACK_S    = float(os.environ.get("DEMS_LOGO_ACK_S", "3"))          # tunggu ACK per potongan
LOGO_GAP_S    = float(os.environ.get("DEMS_LOGO_GAP_S", "0.08"))       # jeda antar potongan
LOGO_MAX_TRIES = int(os.environ.get("DEMS_LOGO_MAX_TRIES", "3"))       # stop push otomatis
LOGO_REPUSH_MIN_S = float(os.environ.get("DEMS_LOGO_REPUSH_MIN_S", "30"))
LOGO_WAIT_S   = float(os.environ.get("DEMS_LOGO_WAIT_S", "45"))        # tunggu selesai utk pemanggil
LOGO_AUTOPUSH = os.environ.get("DEMS_LOGO_AUTOPUSH", "1") not in ("0", "", "false")
MAX_UPLOAD_B  = int(os.environ.get("DEMS_LOGO_MAX_BYTE", str(6 * 1024 * 1024)))
# D57: badan JSON modul konsol memuat logo base64 — 4/3 dari batas unggah ditambah ruang medan lain.
MAX_SETUP_JSON_B = int(MAX_UPLOAD_B * 4 / 3) + 65536
LOGO_MAX_W    = int(os.environ.get("DEMS_LOGO_MAX_W", "480"))          # penahan anggaran LittleFS
LOGO_MAX_H    = int(os.environ.get("DEMS_LOGO_MAX_H", "320"))
# Core produksi (loopback). Halaman setup TIDAK menyimpan sandi: kredensial hanya dilewatkan
# sekali ke sign-in Core, dan peran dibaca dari jawaban sesi Core yang SUDAH ADA.
CORE_URL      = (os.environ.get("DEMS_CORE_URL") or "http://127.0.0.1:4420").rstrip("/")
CORE_ORIGIN   = os.environ.get("DEMS_CORE_CONSOLE_ORIGIN", "http://127.0.0.1:5173").rstrip("/")
# D57 (2026-11-03, principal): gerbang pre-delivery adalah IDENTITAS akun vendor, bukan peran -
# root berperan SUPERVISOR (peran justru tidak membedakan dia dari supervisor klien), dan
# teknisi klien tidak boleh masuk. Nama akun dibaca dari jawaban sesi Core, bukan dari form.
AKUN_VENDOR   = ("root", "gsp.teknisi")
SETUP_TTL_S   = float(os.environ.get("DEMS_SETUP_TTL_S", "900"))
try:                                                        # PIL sudah ada di interpreter service
    from PIL import Image as _PILImage                       # (diperiksa: 10.2.0 / 3.12.3)
    PUNYA_PIL = True
except Exception:                                           # fallback: PNG murni, tanpa pasang apa pun
    _PILImage = None
    PUNYA_PIL = False


def logo_berkas(gid): return os.path.join(LOGO_DIR, "logo_%s.raw" % gid)
def logo_meta(gid):   return os.path.join(LOGO_DIR, "logo_%s.json" % gid)


def logo_kosong(gid):
    return {"id": gid, "tersimpan": False, "berkas": logo_berkas(gid), "w": 0, "h": 0,
            "byte": 0, "crc": 0, "crc_hex": "0x0000", "potongan": 0, "kapan": "", "sumber": "",
            "status": "kosong", "ack": None, "why": "", "percobaan": 0, "gagal_berturut": 0,
            "siap_pada": "", "sumber_pil": "PIL" if PUNYA_PIL else "png-murni"}


LOGO = {g: logo_kosong(g) for g in LOGO_IDS}
XFER = None         # transfer aktif (hanya serial_worker yang menulis)
JADWAL = {}         # gid -> {"sejak": epoch, "alasan": str}: push ulang yang menunggu giliran
SETUP = {}          # token sesi halaman setup -> {"core_cookie","role","nama","exp"}


# ── CRC16-CCITT (poly 0x1021, init 0xFFFF, tanpa XOR-out) ──────────────────────────────
def crc16_ccitt(data, crc=0xFFFF):
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc


def pack_rgb565_le(rgb):
    """RGB 8-bit per kanal -> RGB565 little-endian, rumus sama dengan tools/gen_logo.py."""
    out = bytearray((len(rgb) // 3) * 2)
    o = 0
    for i in range(0, len(rgb) - 2, 3):
        v = ((rgb[i] & 0xF8) << 8) | ((rgb[i + 1] & 0xFC) << 3) | (rgb[i + 2] >> 3)
        out[o] = v & 0xFF
        out[o + 1] = v >> 8
        o += 2
    return bytes(out)


def flatten_rgba(rgba, w, h, bg):
    """Alpha dibakar ke latar (bg = tuple RGB). Panel tidak punya channel alpha."""
    out = bytearray(w * h * 3)
    for i in range(w * h):
        a = rgba[i * 4 + 3]
        s, d = i * 4, i * 3
        if a == 255:
            out[d], out[d + 1], out[d + 2] = rgba[s], rgba[s + 1], rgba[s + 2]
        elif a == 0:
            out[d], out[d + 1], out[d + 2] = bg
        else:
            ia = 255 - a
            for k in range(3):
                out[d + k] = (rgba[s + k] * a + bg[k] * ia + 127) // 255
    return bytes(out)


def bbox_alpha(rgba, w, h):
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        baris = y * w * 4
        for x in range(w):
            if rgba[baris + x * 4 + 3]:
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    if x1 < 0:
        return 0, 0, w, h
    return x0, y0, x1 + 1, y1 + 1


# ── Pembaca PNG tanpa PIL (fallback: tidak boleh memasang paket apa pun) ───────────────
def png_dekode(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("bukan PNG")
    pos, idat, plte, trns, ihdr = 8, bytearray(), b"", b"", None
    while pos + 8 <= len(data):
        panjang = int.from_bytes(data[pos:pos + 4], "big")
        tipe = data[pos + 4:pos + 8]
        isi = data[pos + 8:pos + 8 + panjang]
        if tipe == b"IHDR":   ihdr = isi
        elif tipe == b"PLTE": plte = isi
        elif tipe == b"tRNS": trns = isi
        elif tipe == b"IDAT": idat += isi
        elif tipe == b"IEND": break
        pos += 12 + panjang
    if not ihdr:
        raise ValueError("PNG tanpa IHDR")
    w, h, depth, ctype, _c, _f, inter = struct.unpack(">IIBBBBB", ihdr[:13])
    if depth != 8 or inter != 0:
        raise ValueError("fallback hanya mampu PNG 8-bit non-interlaced (dapat %d-bit interlace=%d)"
                         % (depth, inter))
    kanal = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(ctype)
    if kanal is None:
        raise ValueError("tipe warna PNG %d tidak didukung fallback" % ctype)
    raw = zlib.decompress(bytes(idat))
    stride = w * kanal
    prev, out, x = bytearray(stride), bytearray(), 0
    for _y in range(h):
        f = raw[x]; x += 1
        baris = bytearray(raw[x:x + stride]); x += stride
        if f == 1:
            for i in range(kanal, stride):
                baris[i] = (baris[i] + baris[i - kanal]) & 255
        elif f == 2:
            for i in range(stride):
                baris[i] = (baris[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = baris[i - kanal] if i >= kanal else 0
                baris[i] = (baris[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = baris[i - kanal] if i >= kanal else 0
                b_, c_ = prev[i], (prev[i - kanal] if i >= kanal else 0)
                p = a + b_ - c_
                pa, pb, pc = abs(p - a), abs(p - b_), abs(p - c_)
                duga = a if (pa <= pb and pa <= pc) else (b_ if pb <= pc else c_)
                baris[i] = (baris[i] + duga) & 255
        elif f != 0:
            raise ValueError("filter PNG %d tidak dikenal" % f)
        prev = baris
        out += baris
    rgba = bytearray(w * h * 4)
    if ctype == 6:
        rgba[:] = out
    elif ctype == 2:
        for i in range(w * h):
            rgba[i * 4:i * 4 + 3] = out[i * 3:i * 3 + 3]; rgba[i * 4 + 3] = 255
    elif ctype == 0:
        for i in range(w * h):
            g = out[i]; rgba[i * 4:i * 4 + 3] = bytes((g, g, g)); rgba[i * 4 + 3] = 255
    elif ctype == 4:
        for i in range(w * h):
            g, a = out[i * 2], out[i * 2 + 1]
            rgba[i * 4:i * 4 + 3] = bytes((g, g, g)); rgba[i * 4 + 3] = a
    elif ctype == 3:
        for i in range(w * h):
            idx = out[i]
            rgba[i * 4:i * 4 + 3] = plte[idx * 3:idx * 3 + 3]
            rgba[i * 4 + 3] = trns[idx] if idx < len(trns) else 255
    return w, h, bytes(rgba)


def _lanczos3(x):
    if x == 0: return 1.0
    if x >= 3.0: return 0.0
    px = math.pi * x
    return 3.0 * math.sin(px) * math.sin(px / 3.0) / (px * px)


def resample_lanczos(rgba, w, h, nw, nh):
    """Lanczos3 separable (horizon lalu vertikal) — jalur tanpa PIL."""
    if (nw, nh) == (w, h):
        return rgba
    def berat(n_src, n_dst):
        skala = max(1.0, n_src / n_dst)
        dukungan = 3.0 * skala
        peta = []
        for ox in range(n_dst):
            tengah = (ox + 0.5) * n_src / n_dst - 0.5
            lo = max(0, int(math.floor(tengah - dukungan)))
            hi = min(n_src - 1, int(math.ceil(tengah + dukungan)))
            pasangan = [(ix, _lanczos3((ix - tengah) / skala)) for ix in range(lo, hi + 1)]
            jml = sum(v for _ix, v in pasangan) or 1.0
            peta.append(pasangan if jml else [(0, 1.0)])
        return peta
    bx, by = berat(w, nw), berat(h, nh)
    tmp = bytearray(nw * h * 4)
    for y in range(h):
        dasar = y * w * 4
        for ox, pasangan in enumerate(bx):
            ak = [0.0, 0.0, 0.0, 0.0]
            jml = sum(v for _ix, v in pasangan) or 1.0
            for ix, v in pasangan:
                o = dasar + ix * 4
                for k in range(4):
                    ak[k] += rgba[o + k] * v
            t = (y * nw + ox) * 4
            for k in range(4):
                tmp[t + k] = max(0, min(255, int(round(ak[k] / jml))))
    out = bytearray(nw * nh * 4)
    for oy, pasangan in enumerate(by):
        jml = sum(v for _iy, v in pasangan) or 1.0
        for x in range(nw):
            ak = [0.0, 0.0, 0.0, 0.0]
            for iy, v in pasangan:
                o = (iy * nw + x) * 4
                for k in range(4):
                    ak[k] += tmp[o + k] * v
            t = (oy * nw + x) * 4
            for k in range(4):
                out[t + k] = max(0, min(255, int(round(ak[k] / jml))))
    return bytes(out)


def baca_gambar(data):
    """-> (w, h, rgba). JPEG/WEBP hanya bisa lewat PIL; PNG bisa dua-duanya."""
    kalau_png = data[:8] == b"\x89PNG\r\n\x1a\n"
    if PUNYA_PIL:
        im = _PILImage.open(io.BytesIO(data))
        im.load()
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        return im.width, im.height, im.tobytes()
    if kalau_png:
        return png_dekode(data)
    raise ValueError("PIL tidak tersedia di interpreter service: hanya PNG 8-bit non-interlaced "
                     "yang bisa diolah (JPEG/WEBP butuh PIL). Tidak ada paket yang dipasang.")


def tempel_kanvas(rgb, iw, ih, tw, th, bg):
    """Tempel hasil resize di tengah kanvas tw x th berlatar bg (tidak pernah meregang)."""
    if (iw, ih) == (tw, th):
        return rgb
    kanvas = bytearray(tw * th * 3)
    satu_baris = bytes((bg[0], bg[1], bg[2])) * tw
    for yy in range(th):
        o = yy * tw * 3
        kanvas[o:o + tw * 3] = satu_baris
    ox0, oy0 = (tw - iw) // 2, (th - ih) // 2
    for yy in range(ih):
        d = ((oy0 + yy) * tw + ox0) * 3
        s = yy * iw * 3
        kanvas[d:d + iw * 3] = rgb[s:s + iw * 3]
    return bytes(kanvas)


def siapkan_logo(data, gid, w=None, h=None, fit="contain"):
    """Unggahan -> byte RGB565 little-endian berukuran PERSIS tw*th*2, plus CRC-nya."""
    if gid not in LOGO_IDS:
        raise ValueError("id harus client|splash")
    tw, th = LOGO_DEFAULT[gid]
    try:
        if w: tw = int(w)
        if h: th = int(h)
    except Exception:
        raise ValueError("w/h harus angka piksel")
    tw = max(1, min(tw, LOGO_MAX_W))
    th = max(1, min(th, LOGO_MAX_H))
    sw, sh, rgba = baca_gambar(data)
    x0, y0, x1, y1 = bbox_alpha(rgba, sw, sh)                    # buang margin transparan
    if (x1 - x0, y1 - y0) != (sw, sh):
        rgba = bytes(rgba[(y0 * sw) * 4:(y1 * sw) * 4])
        sw, sh = x1 - x0, y1 - y0
    if not sw or not sh:
        raise ValueError("gambar kosong")
    if str(fit).lower() == "stretch":
        nw, nh = tw, th
    else:
        k = min(tw / sw, th / sh)
        nw, nh = max(1, int(round(sw * k))), max(1, int(round(sh * k)))
    if PUNYA_PIL:
        hasil = _PILImage.frombytes("RGBA", (sw, sh), rgba).resize(
            (nw, nh), _PILImage.Resampling.LANCZOS).tobytes()
    else:
        hasil = resample_lanczos(rgba, sw, sh, nw, nh)
    rgb = flatten_rgba(hasil, nw, nh, LOGO_BG[gid])
    kanvas = tempel_kanvas(rgb, nw, nh, tw, th, LOGO_BG[gid])
    return pack_rgb565_le(kanvas), tw, th


# ── Simpan / muat state logo ───────────────────────────────────────────────────────────
def simpan_logo(gid, raw, w, h, sumber):
    crc = crc16_ccitt(raw)
    try:
        os.makedirs(LOGO_DIR, exist_ok=True)
    except Exception as e:
        log("[logo] gagal membuat", LOGO_DIR, ":", str(e)[:60])
    tmp = logo_berkas(gid) + ".tmp"
    with open(tmp, "wb") as f:
        f.write(raw)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, logo_berkas(gid))
    meta = {"id": gid, "w": w, "h": h, "byte": len(raw), "crc": crc,
            "crc_hex": "0x%04X" % crc, "potongan": (len(raw) + LOGO_CHUNK - 1) // LOGO_CHUNK,
            "chunk": LOGO_CHUNK, "kapan": time.strftime("%Y-%m-%d %H:%M:%S"),
            "sumber": str(sumber)[:60], "olahan": "PIL" if PUNYA_PIL else "png-murni"}
    with open(logo_meta(gid), "w", encoding="utf8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    with L:
        LOGO[gid].update({"tersimpan": True, "raw": raw, "w": w, "h": h, "byte": len(raw), "crc": crc,
                          "crc_hex": "0x%04X" % crc, "potongan": meta["potongan"],
                          "kapan": meta["kapan"], "sumber": meta["sumber"],
                          "status": "tersimpan", "why": "", "ack": None, "gagal_berturut": 0})
    return crc


def muat_logo():
    for gid in LOGO_IDS:
        try:
            with open(logo_berkas(gid), "rb") as f:
                raw = f.read()
        except Exception:
            continue
        try:
            with open(logo_meta(gid), encoding="utf8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
        crc = crc16_ccitt(raw)
        w = int(meta.get("w") or 0) or LOGO_DEFAULT[gid][0]
        h = int(meta.get("h") or 0) or LOGO_DEFAULT[gid][1]
        cocok = (len(raw) == w * h * 2)
        with L:
            LOGO[gid].update({"tersimpan": True, "raw": raw, "w": w, "h": h, "byte": len(raw),
                              "crc": crc, "crc_hex": "0x%04X" % crc,
                              "potongan": (len(raw) + LOGO_CHUNK - 1) // LOGO_CHUNK,
                              "kapan": str(meta.get("kapan") or ""),
                              "sumber": str(meta.get("sumber") or ""),
                              "status": "tersimpan" if cocok else "ukuran-selisih",
                              "why": "" if cocok else "panjang berkas != w*h*2"})
        log("[logo] '%s' dimuat dari %s: %dx%d, %d B, crc=0x%04X%s"
            % (gid, logo_berkas(gid), w, h, len(raw), crc, "" if cocok else " (UKURAN SELISIH)"))


# ── Mesin pengirim chunk (dijalankan serial_worker, tidak pernah memblokir) ────────────
def _xfer_bangun(gid, alasan):
    st = LOGO[gid]
    raw = st.get("raw") or b""
    if not raw:
        return None
    potongan = [raw[i:i + LOGO_CHUNK] for i in range(0, len(raw), LOGO_CHUNK)]
    st["status"] = "mengirim"
    st["ack"] = None
    st["why"] = ""
    st["percobaan"] += 1
    st["percobaan_terakhir"] = time.time()
    return {"id": gid, "potongan": potongan, "seq": 0, "of": len(potongan),
            "w": st["w"], "h": st["h"], "crc": st["crc"], "waiting": False,
            "t_kirim": 0.0, "t_jeda": 0.0, "alasan": alasan}


def logo_mulai(gid, alasan="permintaan"):
    """Mulai dorong satu logo sekarang. Return (jalan, alasan-tolak)."""
    global XFER
    with L:
        if gid not in LOGO_IDS:
            return False, "id harus client|splash"
        if XFER is not None:
            return False, "transfer '%s' masih berjalan (seq %d/%d)" % (
                XFER["id"], XFER["seq"] + 1, XFER["of"])
        if not G["port"]:
            return False, "port serial belum terbuka — panel diam, tidak ada yang dikirimi"
        xf = _xfer_bangun(gid, alasan)
        if xf is None:
            return False, "logo '%s' belum ada yang tersimpan" % gid
        XFER = xf
        JADWAL.pop(gid, None)
        st = LOGO[gid]
        info = "%s %dx%d %dB crc=0x%04X %d potongan (%s)" % (
            gid, st["w"], st["h"], st["byte"], st["crc"], xf["of"], alasan)
    log("[logo] dorong " + info)
    event("-", "LOGO_KIRIM", "-", info[:60])
    return True, ""


def logo_antre(gid, alasan="permintaan operator"):
    """Dorong sekarang kalau jalur bebas; kalau masih ada transfer, jadwalkan sesudahnya.
    Permintaan eksplisit (unggah / tombol push / POST push) melepas penahan 'gagal berturut':
    alat yang baru dicolok harus bisa diminta lagi tanpa unggah ulang."""
    global XFER
    if gid not in LOGO_IDS:
        return "id harus client|splash"
    with L:
        st = LOGO.get(gid)
        if not st or not st.get("raw"):
            return "logo '%s' belum ada yang tersimpan" % gid
        st["gagal_berturut"] = 0
        if XFER is None and G["port"]:
            XFER = _xfer_bangun(gid, alasan)
            JADWAL.pop(gid, None)
            if XFER is not None:
                return "jalan"
        if not G["port"]:
            return "port serial belum terbuka — panel diam, tidak ada yang dikirimi"
        JADWAL[gid] = {"sejak": time.time(), "alasan": alasan, "paksa": True}
        return "antre (menunggu transfer '%s' selesai)" % XFER["id"]


def logo_jadwalkan(gid, alasan):
    """Tandai satu logo untuk didorong ulang nanti (setelah reboot / ACK hilang)."""
    if not LOGO_AUTOPUSH:
        return
    with L:
        st = LOGO.get(gid)
        if not st or not st.get("raw"):
            return
        if st["gagal_berturut"] >= LOGO_MAX_TRIES:
            log("[logo] push ulang '%s' DITAHAN: %d percobaan berturut-turut tanpa balasan "
                "alat — perlu unggah ulang atau POST /api/dems/logo/push" % (gid, st["gagal_berturut"]))
            return
        JADWAL[gid] = {"sejak": time.time(), "alasan": alasan}


def _logo_bingkai(xf):
    gid = xf["id"]
    data = xf["potongan"][xf["seq"]]
    ob = {"evt": "logo", "id": gid, "seq": xf["seq"], "of": xf["of"], "bytes": len(data),
          "crc": xf["crc"], "data": base64.b64encode(data).decode()}
    if xf["seq"] == 0:
        ob["w"] = xf["w"]
        ob["h"] = xf["h"]
    return json.dumps(ob, separators=(",", ":"))


def logo_tick(s):
    """Satu potongan per jalan, lalu tunggu ACK. Dipanggil tiap iterasi loop serial."""
    global XFER
    now = time.time()
    garis = None
    with L:
        xf = XFER
        if xf is None:
            # satu jadwal per giliran; jeda minimum LOGO_REPUSH_MIN_S antar percobaan (aturan
            # koordinasi: jangan membanjiri alat yang juga melayani status tiap 2 detik)
            for gid in list(JADWAL):
                if not LOGO[gid].get("raw"):
                    JADWAL.pop(gid, None)
                    continue
                if (not JADWAL[gid].get("paksa")
                        and now - LOGO[gid].get("percobaan_terakhir", 0.0) < LOGO_REPUSH_MIN_S):
                    continue
                alasan = JADWAL.pop(gid)["alasan"]
                xf = _xfer_bangun(gid, alasan)
                if xf is not None:
                    XFER = xf
                    log("[logo] dorong ulang '%s' — %s" % (gid, alasan))
                    event("-", "LOGO_ULANG", gid[:6], alasan[:60])
                    break
        if xf is not None:
            if xf["waiting"]:
                if now - xf["t_kirim"] > LOGO_ACK_S:
                    st = LOGO[xf["id"]]
                    st["status"] = "tanpa-ack"
                    st["why"] = ("potongan %d/%d tanpa balasan alat dalam %.0f dtk"
                                 % (xf["seq"] + 1, xf["of"], LOGO_ACK_S))
                    st["gagal_berturut"] += 1
                    XFER = None
                    log("[logo] '%s' — %s (gagal berturut %d/%d; alat kemungkinan belum "
                        "paham protokol chunk)" % (xf["id"], st["why"], st["gagal_berturut"],
                                                   LOGO_MAX_TRIES))
                    event("-", "LOGO_TANPA_ACK", xf["id"][:6], st["why"][:60])
            elif now - xf["t_jeda"] >= LOGO_GAP_S:
                garis = _logo_bingkai(xf)
                xf["waiting"] = True
                xf["t_kirim"] = now
    if garis:
        s.write(garis.encode() + b"\n")
        G["tx"] += 1


def logo_handle_ack(req):
    """Satu baris {'ack':'logo'} dari alat."""
    global XFER
    now = time.time()
    with L:
        xf = XFER
        if xf is None or str(req.get("id", "")) != xf["id"]:
            log("[logo] ACK tak diharapkan:", json.dumps(req, separators=(",", ":"))[:120])
            return
        st = LOGO[xf["id"]]
        xf["waiting"] = False
        xf["t_jeda"] = now
        st["ack"] = {k: req.get(k) for k in ("ok", "crc", "w", "h", "why") if k in req}
        if not truthy(req.get("ok", True)):
            st["status"] = "ditolak"
            st["why"] = str(req.get("why", "alat menolak tanpa alasan"))[:90]
            st["gagal_berturut"] += 1
            XFER = None
            log("[logo] '%s' DITOLAK alat: %s" % (xf["id"], st["why"]))
            event("-", "LOGO_DITOLAK", xf["id"][:6], st["why"][:60])
            return
        xf["seq"] += 1
        if xf["seq"] >= xf["of"]:
            ack_crc = req.get("crc")
            st["status"] = "siap"
            st["siap_pada"] = time.strftime("%Y-%m-%d %H:%M:%S")
            st["gagal_berturut"] = 0
            st["why"] = "" if ack_crc in (None, st["crc"]) else "crc ACK %s != crc gambar 0x%04X" % (
                ack_crc, st["crc"])
            if st["why"]:
                st["status"] = "crc-selisih"
            XFER = None
            log("[logo] '%s' SIAP di alat — ACK %s" % (
                xf["id"], json.dumps(req, separators=(",", ":"))[:110]))
            event("-", "LOGO_SIAP", xf["id"][:6],
                  "%s %sx%s" % (req.get("crc"), req.get("w"), req.get("h"))[:60])


def logo_tunggu_selesai(gid):
    """Panggil HTTP hanya boleh menunggu: sampai transfer berhenti atau batas waktu."""
    batas = time.time() + LOGO_WAIT_S
    while time.time() < batas:
        with L:
            st = LOGO[gid]["status"]
            sedang = (XFER is not None and XFER["id"] == gid)
            menanti = gid in JADWAL
        if st != "mengirim" and not sedang and not menanti:
            return st
        time.sleep(0.1)
    return "menunggu-alat"


def logo_status_dict(gid):
    with L:
        st = dict(LOGO[gid])
        aktif = XFER["id"] if XFER else ""
    st.pop("raw", None)
    st["sedang_dikirim"] = (aktif == gid)
    st["protokol"] = {"chunk": LOGO_CHUNK, "ack_tunggu_s": LOGO_ACK_S,
                      "max_percobaan_otomatis": LOGO_MAX_TRIES,
                      "jeda_ulang_s": LOGO_REPUSH_MIN_S} if not st.get("tersimpan") else None
    return st


def logo_semua_status():
    out = {g: logo_status_dict(g) for g in LOGO_IDS}
    for g in LOGO_IDS:
        out[g].pop("protokol", None)
    try:
        anggaran = len(json.dumps(snapshot(), separators=(",", ":")).encode())
    except Exception:
        anggaran = -1
    return {"logo": out, "direktori": LOGO_DIR, "olahan": "PIL" if PUNYA_PIL else "png-murni",
            "protokol": {"evt": "logo", "chunk_byte": LOGO_CHUNK, "ack_tunggu_s": LOGO_ACK_S,
                         "ulang_min_s": LOGO_REPUSH_MIN_S, "maks_ulang": LOGO_MAX_TRIES,
                         "auto_push": LOGO_AUTOPUSH, "crc": "CRC16-CCITT poly 0x1021 init 0xFFFF"},
            "transfer": (XFER["id"] if XFER else ""),
            # anggaran payload panel: snapshot tidak boleh lewat 600 B (diperiksa tiap GET)
            "snapshot_b": anggaran, "anggaran_snapshot_b": 600}


# ── Jembatan ke Core: buktikan peran, bukan menebak kredensial ─────────────────────────
def parse_multipart(raw, ctype):
    """Parser multipart/form-data secukupnya (stdlib TIDAK punya lagi sejak cgi dihapus
    Python 3.13). Return (medan, berkas): nama->teks dan nama->(nama_berkas, byte)."""
    batas = ""
    for bagian in ctype.split(";")[1:]:
        bagian = bagian.strip()
        if bagian.lower().startswith("boundary="):
            batas = bagian.split("=", 1)[1].strip().strip('"')
    if not batas:
        raise ValueError("multipart tanpa boundary")
    pemisah = b"--" + batas.encode()
    medan, berkas = {}, {}
    for potongan in raw.split(pemisah):
        potongan = potongan.strip(b"\r\n")
        if not potongan or potongan == b"--":
            continue
        kepala, _, isi = potongan.partition(b"\r\n\r\n")
        if not _:
            continue
        teks = kepala.decode("utf8", "replace")
        nama = re.search(r'name="([^"]*)"', teks)
        nama_f = re.search(r'filename="([^"]*)"', teks)
        if not nama:
            continue
        key = nama.group(1)
        if nama_f and nama_f.group(1):
            berkas[key] = (os.path.basename(nama_f.group(1))[:80], isi.strip(b"\r\n"))
        else:
            medan[key] = isi.strip(b"\r\n").decode("utf8", "replace")
    return medan, berkas


def _core_call(path, obj=None, cookie=None, method=None, timeout=8):
    data = None if obj is None else json.dumps(obj, separators=(",", ":")).encode()
    hdr = {"Accept": "application/json", "Origin": CORE_ORIGIN}
    if data is not None:
        hdr["Content-Type"] = "application/json"
    if cookie:
        hdr["Cookie"] = cookie
    req = urllib.request.Request(CORE_URL + path, data=data, headers=hdr,
                                 method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            isi = r.read()
            try:
                return r.status, (json.loads(isi) if isi else {}), dict(r.headers)
            except Exception:
                return r.status, {"raw": isi[:160].decode("utf8", "replace")}, dict(r.headers)
    except urllib.error.HTTPError as e:
        isi = e.read()
        try:
            out = json.loads(isi) if isi else {}
        except Exception:
            out = {"error": {"code": "HTTP_%d" % e.code,
                             "message": (isi or b"")[:160].decode("utf8", "replace")}}
        return e.code, out, dict(getattr(e, "headers", {}) or {})
    except Exception as e:
        return 0, {"error": {"code": "CORE_TIDAK_TERHUBUNG", "message": str(e)[:140]}}, {}


def _alasan_core(code, js):
    """Alasan Core apa adanya — tidak disamarkan, tidak memuat sandi."""
    err = js.get("error") if isinstance(js, dict) else None
    if isinstance(err, dict):
        det = err.get("details") if isinstance(err.get("details"), dict) else {}
        tambahan = ""
        if det.get("attemptsRemaining") is not None:
            tambahan += " · sisa percobaan %s" % det["attemptsRemaining"]
        if det.get("retryInMs"):
            tambahan += " · tunggu %s ms" % det["retryInMs"]
        if det.get("reason"):
            tambahan += " · alasan: %s" % str(det["reason"])[:60]
        return "Core HTTP %s: %s — %s%s" % (code, err.get("code", "?"),
                                            str(err.get("message", ""))[:160], tambahan)
    return "Core HTTP %s tanpa keterangan" % code


def _cookie_set(headers):
    parts = []
    for k, v in (headers or {}).items():
        if k.lower() == "set-cookie":
            parts.append(v.split(";")[0].strip())
    return "; ".join(p for p in parts if "=" in p)


def teknisi_login(user, pw):
    """Sign-in ke Core lewat jalur resmi (web console: Origin, tanpa Authorization).
    Sandi hanya lewat di argumen fungsi ini — tidak pernah ke log, URL, atau berkas."""
    code, js, hdrs = _core_call("/api/v1/auth/sign-in",
                               {"username": str(user)[:64].strip(), "password": str(pw)})
    if code != 200:
        return None, _alasan_core(code, js), {}
    if not isinstance(js, dict): js = {}
    ses = js.get("session") or {}
    op = ses.get("operator") or {}
    peran = str(op.get("role") or "")
    akun = str(op.get("username") or "")
    nama = str(op.get("displayName") or op.get("name") or op.get("username") or user)[:40]
    cookie = _cookie_set(hdrs)
    info = {"peran": peran, "nama": nama, "akun": akun, "operator": str(op.get("id") or "")}
    if akun not in AKUN_VENDOR:
        if cookie:
            _core_call("/api/v1/auth/sign-out", {"reason": "USER"}, cookie=cookie)
        return None, ("Core menerima login akun %s, tapi operasi pre-delivery hanya untuk akun "
                      "vendor %s" % (nama or "?", " / ".join(AKUN_VENDOR))), info
    token = secrets.token_urlsafe(24)
    with L:
        SETUP[token] = {"core_cookie": cookie, "peran": peran, "nama": nama, "akun": akun,
                        "dibuat": time.time(), "exp": time.time() + SETUP_TTL_S}
    log("[setup] %s masuk sebagai %s (sesi Core disimpan di memori, sandi tidak)" % (nama, peran))
    event("-", "SETUP_MASUK", "-", nama[:60])
    return token, "", info


def teknisi_peran(token):
    """Buktikan ulang lewat Core bahwa token ini masih sesi akun vendor (dipanggil tiap operasi; D57)."""
    with L:
        s = SETUP.get(str(token or ""))
    if not s:
        return False, "belum ada sesi akun vendor — login dulu di halaman setup", {}
    if s["exp"] < time.time():
        with L:
            SETUP.pop(str(token), None)
        return False, "sesi setup kedaluwarsa — login lagi", {}
    code, js, _ = _core_call("/api/v1/auth/session", cookie=s["core_cookie"])
    if code != 200:
        with L:
            SETUP.pop(str(token), None)
        return False, _alasan_core(code, js), {}
    if not isinstance(js, dict): js = {}
    op = js.get("operator") or {}
    peran = str(op.get("role") or "")
    akun = str(op.get("username") or s.get("akun") or "")
    nama = str(op.get("displayName") or op.get("name") or s.get("nama") or "")[:40]
    if akun not in AKUN_VENDOR:
        return False, ("sesi Core ini akun %s — operasi pre-deliver butuh akun vendor %s"
                       % (akun or "?", " / ".join(AKUN_VENDOR))), {"peran": peran, "nama": nama}
    with L:
        if str(token) in SETUP:
            SETUP[str(token)]["exp"] = time.time() + SETUP_TTL_S
    return True, "", {"peran": peran, "nama": nama, "akun": akun}


def teknisi_logout(token):
    with L:
        s = SETUP.pop(str(token or ""), None)
    if s and s.get("core_cookie"):
        _core_call("/api/v1/auth/sign-out", {"reason": "USER"}, cookie=s["core_cookie"])
        event("-", "SETUP_KELUAR", "-", str(s.get("nama") or "")[:60])
    return bool(s)


def setup_prune():
    while True:
        time.sleep(60)
        now = time.time()
        with L:
            for t in [k for k, v in SETUP.items() if v["exp"] < now]:
                SETUP.pop(t, None)


def teknisi_akun_core(cookie_raw):
    """D57 (jalur konsol): buktikan header Cookie yang dibawa Core ke endpoint sesi Core sendiri.
    Tidak ada rahasia baru — kredensial sesi pemanggil lewat apa adanya, dan Core-lah yang
    menjawab sesi siapa ini. Nama akun dibaca dari jawaban Core, bukan dari badan permintaan."""
    if not cookie_raw or "=" not in cookie_raw:
        return False, "tidak ada sesi Core yang dibawa", {}
    kode, js, _h = _core_call("/api/v1/auth/session", cookie=cookie_raw)
    if kode != 200 or not isinstance(js, dict):
        return False, "Core tidak mengenali sesi yang dibawa (HTTP %s)" % kode, {}
    op = js.get("operator") or {}
    akun = str(op.get("username") or "")
    nama = str(op.get("displayName") or op.get("name") or akun)[:40]
    info = {"peran": str(op.get("role") or ""), "nama": nama, "akun": akun}
    if akun not in AKUN_VENDOR:
        return False, ("sesi Core yang dibawa adalah akun %s — operasi pre-delivery hanya untuk "
                       "akun vendor %s" % (akun or "?", " / ".join(AKUN_VENDOR))), info
    return True, "", info


def gerbang_teknisi(fields, token, core_cookie=None):
    """Kredensial form (login baru) ATAU token sesi yang dibuktikan ulang ke Core."""
    user = str(fields.get("username", "") or "").strip()
    pw = str(fields.get("password", "") or "")
    if user and pw:
        tok, pesan, info = teknisi_login(user, pw)
        if not tok:
            return False, pesan, info, None
        return True, "", info, tok
    ok, pesan, info = teknisi_peran(token)
    if not ok and core_cookie:
        # Jalur D57: permintaan datang lewat Core dengan sesi pemanggil yang asli.
        ok2, pesan2, info2 = teknisi_akun_core(core_cookie)
        if ok2:
            return True, "", info2, None
        return False, pesan2, info2, None
    if not ok:
        return False, pesan, info, None
    return True, "", info, token


def lanjut_identitas(bodi):
    """Teruskan ke endpoint identitas internal yang SUDAH ada, dengan X-Provision-Key dari env.
    Nilainya tidak pernah ditampilkan; hanya dipakai di header permintaan loopback ini."""
    raw = json.dumps(bodi, separators=(",", ":")).encode()
    req = urllib.request.Request("http://127.0.0.1:%d/api/dems/identity" % PORT, data=raw,
                                 headers={"Content-Type": "application/json",
                                          "X-Provision-Key": PROVISION_KEY}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {"error": {"code": "HTTP_%d" % e.code}}
    except Exception as e:
        return 0, {"error": {"code": "BACKEND_SENDIRI_DIAM", "message": str(e)[:120]}}



L = threading.RLock()          # reentrant: helper saling memanggil
CH = [{"rec": False, "cam": False, "file": "", "set_at": 0.0, "last_post": 0.0,
       "expires_at": 0.0, "src": "-", "dev": ""} for _ in range(N)]
EVENTS = collections.deque(maxlen=300)      # jejak audit: siapa men-set apa, kapan
G = {"ups": "online", "health_override": None, "health_note": "",
     "last_req_ms": 0.0, "tx": 0, "rx": 0, "opens": 0, "last_err": "",
     "started_at": time.time(),
     # diagnostik USB — supaya "BACKEND DIAM" bisa dibaca lapis mana yang putus dari satu GET
     "port": "", "port_cara": "", "port_since": 0.0, "port_changes": 0,
     "down_s": 0, "panel_up_s": 0, "resets": 0,
     "satker": SATKER_DEFAULT, "client": CLIENT_DEFAULT}


def log(*a):
    print(time.strftime("[%d-%m %H:%M:%S]"), *a, flush=True)


def event(chn, action, src, detail=""):
    """Catat kejadian untuk audit. chn = nama kanal atau '-'."""
    with L:
        EVENTS.append({"ts": time.strftime("%Y-%m-%d %H:%M:%S"), "epoch": time.time(),
                       "channel": chn, "action": action, "src": src, "detail": detail[:60]})


def chan_of(v):
    """Terima 1, '1', 'CH1', 'ch01', 'all', '*'. Return daftar indeks atau 'BAD'."""
    if v is None: return None
    s = str(v).strip().lower()
    if s in ("all", "*", "semua", "keempat"):
        return list(range(N))
    low = {n.lower(): i for i, n in enumerate(NAMES)}
    if s in low: return [low[s]]
    digits = "".join(c for c in s if c.isdigit())
    if digits:
        i = int(digits) - 1
        if 0 <= i < N: return [i]
    return "BAD"


def health():
    """Kesehatan dihitung dari gejala nyata; hanya warn/fail yang bisa dipaku."""
    lvl, alasan = "ok", []
    try:
        gb = shutil.disk_usage(REKAM_DIR).free / 1e9
        if gb < CRIT_FREE_GB:  lvl, _ = "fail", alasan.append(f"disk {gb:.1f}GB")
        elif gb < MIN_FREE_GB: lvl, _ = "warn", alasan.append(f"disk {gb:.1f}GB")
    except Exception:
        lvl, _ = "warn", alasan.append(f"dir {REKAM_DIR} tak terbaca")
    with L:
        if CH_STALE_S:
            for i, c in enumerate(CH):
                if c["rec"] and c["last_post"] and time.time() - c["last_post"] > CH_STALE_S:
                    alasan.append(f"{NAMES[i]} tanpa kabar")
                    lvl = "warn" if lvl == "ok" else lvl
        for i, c in enumerate(CH):
            if c["rec"] and not c["cam"]:
                alasan.append(f"{NAMES[i]} rekam tanpa kamera")
                lvl = "warn" if lvl == "ok" else lvl
        if G["last_req_ms"] and time.time() * 1000 - G["last_req_ms"] > PANEL_SILENT_S * 1000:
            alasan.append("panel diam")
            lvl = "warn" if lvl == "ok" else lvl
        if G["health_override"]:
            lvl = G["health_override"]
            alasan = [f"OVERRIDE: {G['health_note'] or G['health_override']}"]
    return lvl, alasan


def muat_identitas():
    """Nilai identitas tersimpan menggantikan default env (dipakai saat pre-deliver)."""
    if not IDENTITY_FILE or not os.path.exists(IDENTITY_FILE):
        return
    try:
        with open(IDENTITY_FILE, encoding="utf8") as f: isi = json.load(f)
        for k in ("satker", "client"):
            if isinstance(isi.get(k), str): G[k] = isi[k][:38]
        log("[identitas] dimuat dari", IDENTITY_FILE, "->", {k: G[k] for k in ("satker", "client")})
    except Exception as e:
        log("[identitas] gagal membaca", IDENTITY_FILE, ":", str(e)[:60])


def simpan_identitas():
    if not IDENTITY_FILE:
        return
    try:
        d = os.path.dirname(IDENTITY_FILE)
        if d: os.makedirs(d, exist_ok=True)
        sementara = IDENTITY_FILE + ".tmp"
        with open(sementara, "w", encoding="utf8") as f:
            json.dump({"satker": G["satker"], "client": G["client"]}, f, ensure_ascii=False)
        os.replace(sementara, IDENTITY_FILE)
    except Exception as e:
        log("[identitas] GAGAL menyimpan", IDENTITY_FILE, ":", str(e)[:60])


def efektif():
    """Keadaan keluaran per kanAL PANEL. Mode 'track' = apa adanya (satu trek satu kanal).
    Mode 'device' = trek-trek yang perangkatnya sama dilebur ke kanal terkecil perangkat itu:
    satu kamera dual-lens menggerakkan SATU relay. Dalam satu grup: rec = salah satu trek
    merekam, cam = SEMUA lensa trek-nya tersambung (satu lensa putus -> titik kamera padam dan
    firmware membunyikan pola 800 Hz, karena itu memang peristiwa yang harus terdengar).
    Dipanggil dengan L sudah dipegang."""
    if CH_MODE != "device":
        return [(c["rec"], bool(c["cam"]), c["file"], c["dev"]) for c in CH]
    out = [(False, False, "", "") for _ in CH]
    selesai = set()
    for i, c in enumerate(CH):
        d = c["dev"]
        if not d:
            out[i] = (c["rec"], bool(c["cam"]), c["file"], "")
            continue
        if d in selesai:
            continue
        selesai.add(d)
        anggota = [j for j, x in enumerate(CH) if x["dev"] == d]
        slot = min(anggota)
        out[slot] = (any(CH[j]["rec"] for j in anggota),
                     all(bool(CH[j]["cam"]) for j in anggota),
                     next((CH[j]["file"] for j in anggota if CH[j]["rec"] and CH[j]["file"]), ""),
                     d)
    return out


def ip_unit():
    """IPv4 utama mesin ini, untuk baris identitas di layar keadaan pabrik."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))            # tidak mengirim apa pun; cukup memicu pemilihan rute
        return s.getsockname()[0]
    except Exception:
        return ""
    finally:
        s.close()


def snapshot():
    lvl = health()[0]              # di luar kunci: health() memanggil stat() disk
    with L:
        # nama berkas dipangkas 24 char: payload panel harus muat di buffer 640 B
        eff = efektif()
        chs = [{"c": i + 1, "rec": "start" if rec else "stop", "cam": bool(cam),
                **({"file": f[:24]} if f else {})}
               for i, (rec, cam, f, dv) in enumerate(eff)]
        nrec = sum(1 for rec, cam, f, dv in eff if rec)
        msg = {"v": 2, "evt": "status", "rec": "start" if nrec else "stop",
               "nrec": nrec, "n": N, "health": lvl, "ups": G["ups"], "ch": chs}
        if G["satker"]: msg["satker"] = G["satker"][:38]
        if G["client"]: msg["client"] = G["client"][:38]
        # Keadaan pabrik: belum ada client (L1) dan belum ada SATKER (L2). Alat memakai tanda
        # ini untuk MENAHAN halaman utama — layar operasi tidak boleh terlihat sebelum setup.
        if not (G["satker"] or G["client"]):
            msg["fresh"] = 1
            ipu = ip_unit()
            if ipu: msg["ip"] = ipu
        # Anggaran buffer panel 640 B: kalau identitas membuat payload melewatinya,
        # buang client dulu lalu satker — status alat tidak boleh dikorbankan demi hiasan.
        if len(json.dumps(msg, separators=(",", ":")).encode()) > 600 and G["client"]:
            msg.pop("client", None)
            if len(json.dumps(msg, separators=(",", ":")).encode()) > 600: msg.pop("satker", None)
            msg.pop("ip", None)          # `fresh` bertahan: ia penahan halaman, bukan hiasan
        aktif = next((c["file"] for c in CH if c["rec"] and c["file"]), "")
        if aktif: msg["file"] = aktif
    return msg


def truthy(v):
    if isinstance(v, bool): return v
    return str(v).strip().lower() in ("1", "true", "on", "yes", "tercolok", "online",
                                      "terpasang", "ada", "connected")


def set_channel(idx, body, src):
    """Terapkan satu objek status ke daftar indeks kanal."""
    rec = str(body.get("rec", "")).lower()
    if rec in ("start", "rekam", "on", "rec", "1", "true"): new = True
    elif rec in ("stop", "idle", "off", "0", "false"):      new = False
    else: return None
    lease = body.get("lease", body.get("ttl", LEASE_DEFAULT))
    try: lease = float(lease)
    except Exception: lease = 0.0
    if lease < 0: lease = 0.0
    with L:
        for i in idx:
            berubah = CH[i]["rec"] != new
            CH[i]["rec"] = new
            CH[i]["last_post"] = time.time()
            CH[i]["src"] = src
            if new:
                # set_at HANYA saat transisi stop->start. Jembatan LCD DEMS Core mengirim
                # POST start tiap 2 detik untuk kanal yang sedang merekam; kalau set_at
                # diperbarui tiap POST, jam durasi di layar panel terpaku 0-2 detik selamanya.
                # Yang harus diperbarui tiap POST hanyalah expires_at (lease) — lihat di bawah.
                if berubah: CH[i]["set_at"] = time.time()
                CH[i]["expires_at"] = (time.time() + lease) if lease > 0 else 0.0
            else:
                CH[i]["expires_at"] = 0.0
            dev = str(body.get("dev", body.get("deviceId", CH[i]["dev"])) or "")[:24]
            if dev and dev != CH[i]["dev"]:
                CH[i]["dev"] = dev
                log(f"[peta] {NAMES[i]} = perangkat {dev} (mode kanal {CH_MODE})")
            if "file" in body: CH[i]["file"] = str(body["file"])[:40]
            elif not new:      CH[i]["file"] = ""
            if body.get("clear_file"): CH[i]["file"] = ""
            if berubah:
                log(f"{NAMES[i]} -> {'REKAM' if new else 'STOP'}"
                    f"{(' file=' + CH[i]['file']) if CH[i]['file'] else ''} dari {src}")
                event(NAMES[i], "REKAM" if new else "STOP", src,
                      (CH[i]["file"] + (" " if CH[i]["file"] else "")) +
                      (f"lease={lease:.0f}s" if new and lease > 0 else ""))
        if "ups" in body: G["ups"] = str(body["ups"])[:12]
    if "cam" in body or "camera" in body:
        on = truthy(body.get("cam", body.get("camera")))
        with L:
            for i in idx:
                if CH[i]["cam"] != on:
                    log(f"{NAMES[i]} kamera -> {'TERCOLOK' if on else 'LEPAS'} dari {src}")
                    event(NAMES[i], "KAMERA_" + ("TERCOLOK" if on else "LEPAS"), src)
                CH[i]["cam"] = on
    return snapshot()


def reaper():
    """Pemicu luar bisa crash setelah mengirim 'start'. Lease habis -> STOP sendiri,
    supaya panel tidak pernah menampilkan REKAM yang tidak lagi terjadi."""
    while True:
        time.sleep(1.0)
        now = time.time()
        with L:
            for i, c in enumerate(CH):
                if c["rec"] and c["expires_at"] and now > c["expires_at"]:
                    c["rec"] = False
                    c["expires_at"] = 0.0
                    log(f"{NAMES[i]} -> STOP (lease habis)")
                    event(NAMES[i], "STOP_LEASE_HABIS", "-", "pemicu berhenti mengirim")


def _comports():
    """Daftar port yang terlihat OS. pyserial memberi nomor seri + VID:PID tanpa perlu sysfs."""
    try:
        from serial.tools import list_ports
        return list(list_ports.comports())
    except Exception as e:
        log("[usb] list_ports gagal:", str(e)[:60])
        return []


def resolve_port():
    """Pilih port berDASARKAN IDENTITAS perangkat, bukan indeksnya. Return (path|None, cara).

    Keamanan perangkat: kalau identitas diset, port yang nomornya cocok tapi serinya beda
    DILEWATI. Backend tidak pernah membuka alat lain yang kebetulan ada di mesin (board
    Arduino lain, antarmuka audio USB)."""
    if DEV and os.path.exists(DEV):
        return DEV, "eksplisit"
    if WANT_SERIAL or WANT_VIDPID:
        for p in _comports():
            sn = (getattr(p, "serial_number", "") or "").strip()
            vp = "%04x:%04x" % (getattr(p, "vendor_id", 0) or 0, getattr(p, "product_id", 0) or 0)
            if WANT_SERIAL and sn.lower() != WANT_SERIAL.lower():
                continue
            if WANT_VIDPID and vp != WANT_VIDPID:
                continue
            return p.device, "identitas"
        for c in sorted(glob.glob("/dev/serial/by-id/*")):      # udev belum tentu menyiapkan
            if WANT_SERIAL and WANT_SERIAL.lower() in c.lower():
                return c, "by-id"
        return None, "tak-ditemukan"
    return None, "tanpa-identitas"


BOOT_MARK = ("rst:", "boot:", "Guru Meditation", "ets(", "panik", "panic")


def note_panel_up(req):
    """Pantau penghitung uptime alat. Firmware mengirim `up` dalam DETIK (now/1000),
    bukan milidetik. Kalau angka itu melompat mundur, panel REBOOT — itu gangguan hardware,
    dan reconnect yang memancingnya harus ketahuan, bukan diam-diam."""
    up = req.get("up")
    if not isinstance(up, (int, float)):
        return
    up = int(up)
    old = G["panel_up_s"]
    if old and up < old - 5:
        G["resets"] += 1
        log("[hw] PANEL REBOOT terdeteksi (up %d -> %d dtk, buka ke-%d) — periksa catu / DTR-RTS; "
            "backend tidak mengirim perintah apa pun saat reboot" % (old, up, G["opens"]))
        G["panel_up_s"] = up          # baseline baru: satu reboot = satu catatan, bukan tiap poll
        for _gid in LOGO_IDS:                          # state LittleFS alat bisa hilang saat reboot
            logo_jadwalkan(_gid, "panel reboot (up %d dtk)" % up)
    elif up > old:
        G["panel_up_s"] = up


def serial_worker():
    retry, down_since, last_report = RETRY_S, 0.0, 0.0
    while True:
        path, cara = resolve_port()
        if path is None:
            now = time.time()
            if not down_since:
                down_since = now
            G["down_s"] = int(now - down_since)
            G["last_err"] = ("panel %s tidak ditemukan (DEV %s tidak ada; cara: %s)"
                             % (WANT_SERIAL or WANT_VIDPID or "?", DEV, cara))
            if now - last_report >= 30:
                log("[usb] TIDAK ADA PORT selama %d dtk — %s; relay & layar alat tidak disentuh"
                    % (G["down_s"], G["last_err"]))
                last_report = now
            time.sleep(retry)
            retry = min(retry * 2, 10.0)
            continue
        gap = int(time.time() - down_since) if down_since else 0
        try:
            s = serial.Serial(path, BAUD, timeout=0.2, dsrdtr=False, rtscts=False)
            # Garis modem diset SEKALI dan tidak pernah diutak-atik lagi supaya reconnect tidak
            # memancing auto-reset ESP32. Papan CDC-USB murni (dan jalur uji lewat PTY) tidak punya
            # garis itu sama sekali: ioctl gagal (ENOTTY) dan itu BUKAN alasan untuk membuang port
            # yang baru terbuka — dicatat, lalu lanjut.
            try:
                s.dtr = DTR_ON; s.rts = RTS_ON
            except Exception as e:
                log("[usb] DTR/RTS tidak bisa diset di %s (%s) — lanjut tanpa garis modem"
                    % (path, str(e)[:40]))
            G["opens"] += 1
            prev = G["port"]
            G["port"], G["port_cara"] = path, cara
            G["port_since"] = time.time()
            if prev and prev != path:
                G["port_changes"] += 1
                log("[usb] indeks berpindah %s -> %s (identitas %s tetap) — keadaan alat tidak diubah"
                    % (prev, path, WANT_SERIAL or WANT_VIDPID))
            if gap:
                log("[usb] PULIH OTOMATIS setelah %d dtk tanpa panel (buka ke-%d di %s, cara %s)"
                    % (gap, G["opens"], path, cara))
            down_since, retry, last_report, G["down_s"] = 0.0, RETRY_S, 0.0, 0
            # DF-34 (D20f): tautan hidup lagi -> galat lama tidak boleh tetap tampil di /status.
            G["last_err"] = ""
            log("USB terbuka di %s (sesi #%d, cara %s) — %d kanal: %s"
                % (path, G["opens"], cara, N, ", ".join(NAMES)))
            for _gid in LOGO_IDS:                      # alat baru belum punya logo: dorong state kita
                logo_jadwalkan(_gid, "port serial terbuka (%s)" % cara)
            time.sleep(0.4); s.reset_input_buffer()
            buf, last_push = b"", 0.0
            while True:
                r = s.read(256)
                if r:
                    buf += r
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        line = line.strip()
                        if not line.startswith(b"{"):
                            if line:
                                txt = line.decode("utf8", "replace")
                                print("   panel:", txt, flush=True)
                                low = txt.lower()
                                if any(m in low for m in BOOT_MARK):
                                    G["resets"] += 1
                                    log("[hw] baris boot dari alat: " + txt[:90])
                            continue
                        G["rx"] += 1
                        G["last_req_ms"] = time.time() * 1000
                        try: req = json.loads(line)
                        except Exception: continue
                        note_panel_up(req)
                        if req.get("ack") == "logo":      # balasan transfer logo (lihat logo_tick)
                            logo_handle_ack(req)
                            continue
                        # Versi firmware yang dilaporkan alat sendiri — bukan tebakan kita.
                        fw_panel = str(req.get("fw") or "").strip()[:12]
                        if fw_panel and fw_panel != G.get("panel_fw"):
                            G["panel_fw"] = fw_panel
                        if req.get("req") == "status":
                            s.write(json.dumps(snapshot(), separators=(",", ":")).encode() + b"\n")
                            G["tx"] += 1
                logo_tick(s)          # satu potongan lalu tunggu ACK (tidak pernah memblokir)
                if time.time() - last_push > PUSH_S:
                    last_push = time.time()
                    s.write(json.dumps(snapshot(), separators=(",", ":")).encode() + b"\n")
                    G["tx"] += 1
        except Exception as e:
            G["last_err"] = str(e)[:90]
            if not down_since:
                down_since = time.time()
            log("USB putus:", G["last_err"], "— cari ulang port, jeda %d dtk" % retry)
            time.sleep(retry)
            retry = min(retry * 2, 10.0)


class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json", extra=None):
        raw = body.encode() if isinstance(body, str) else json.dumps(body).encode()
        # DF-38 (D20g, D25 N4): klien (jembatan Core, batas 1 dtk) bisa menutup sambungan
        # sebelum balasan selesai. Itu satu baris log, bukan traceback dari handle_error.
        try:
            self.send_response(code)
            for k, v in (extra or []):
                self.send_header(k, v)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        except ConnectionError as e:          # BrokenPipe / ConnectionReset / ConnectionAborted
            self.close_connection = True
            log("[http] klien menutup sambungan sebelum balasan %s selesai (%s %s): %s"
                % (code, getattr(self, "command", "?"), str(getattr(self, "path", "?"))[:60],
                   type(e).__name__))

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    # ── unggah logo + halaman setup (semua operasi dijaga identitas akun vendor dari Core; D57) ──
    def _cookies(self):
        out = {}
        for bagian in (self.headers.get("Cookie") or "").split(";"):
            if "=" in bagian:
                k, v = bagian.strip().split("=", 1)
                out[k] = v
        return out

    def _form(self):
        """Baca body apa pun enctype-nya -> (raw, medan, berkas). Sandi TIDAK pernah dicatat."""
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
        except Exception:
            n = 0
        if n <= 0:
            return b"", {}, {}
        if n > MAX_UPLOAD_B:
            return None, {}, {}
        raw = self.rfile.read(n)
        ct_asli = self.headers.get("Content-Type") or ""
        ct = ct_asli.lower()
        if "multipart/form-data" in ct:
            # boundary diambil dari header MENTAH: batas curl mengandung huruf besar dan
            # mencocokkannya dalam keadaan kecil membuat seluruh body jadi satu medan.
            try:
                medan, berkas = parse_multipart(raw, ct_asli)
            except Exception as e:
                return raw, {"_error": str(e)[:120]}, {}
            return raw, medan, berkas
        teks = raw.decode("utf8", "replace")
        if teks.strip().startswith("{"):
            try:
                return raw, json.loads(teks), {}
            except Exception:
                return raw, {}, {}
        medan = {k: v[0] for k, v in urllib.parse.parse_qs(teks, keep_blank_values=True).items()}
        return raw, medan, {}

    def _sesi(self, medan=None):
        medan = medan or {}
        return str(self._cookies().get("dems_setup", "") or medan.get("setup_token", "")).strip()

    def proses_unggah(self, medan, berkas, src):
        """Unggahan -> RGB565 -> simpan -> dorong chunk -> tunggu ACK. (kode, objek)."""
        if medan.get("_error"):
            return 400, {"error": "multipart tidak sah", "alasan": medan["_error"]}
        gid = str(medan.get("id", "client")).strip().lower()
        if gid not in LOGO_IDS:
            return 400, {"error": "id harus client|splash", "dapat": gid or "(kosong)"}
        ok, pesan, info, tok = gerbang_teknisi(medan, self._sesi(medan), self.headers.get("Cookie"))
        if not ok:
            log("[logo] unggahan DITOLAK dari %s: %s" % (src, pesan))
            event("-", "LOGO_TAK_BERWEWENANG", src[:12], pesan[:60])
            return 403, {"error": "BUKAN_TEKNISI", "alasan": pesan}
        nama_f, isi = (berkas or {}).get("image") or (berkas or {}).get("file") or ("", b"")
        if not isi:
            return 400, {"error": "field 'image' wajib berisi berkas gambar",
                         "medan": sorted(k for k in medan if k != "password")}
        try:
            raw565, w, h = siapkan_logo(isi, gid, medan.get("w"), medan.get("h"),
                                         medan.get("fit", "contain"))
        except Exception as e:
            return 422, {"error": "GAMBAR_GAGAL", "alasan": str(e)[:200]}
        crc = simpan_logo(gid, raw565, w, h, "unggah:%s" % (info.get("nama") or "?"))
        tolak = logo_antre(gid, "unggah oleh %s" % (info.get("nama") or "?"))
        jalan = tolak.startswith("jalan") or tolak.startswith("antre")
        akhir = logo_tunggu_selesai(gid) if jalan else "(tidak dimulai)"
        hasil = logo_status_dict(gid)
        out = {"ok": hasil["status"] == "siap", "id": gid, "w": w, "h": h,
               "byte": len(raw565), "crc": "0x%04X" % crc, "potongan": hasil["potongan"],
               "berkas": logo_berkas(gid), "mulai": jalan, "catatan": tolak,
               "status": hasil["status"], "balasan_alat": hasil.get("ack"), "akhir": akhir,
               "kenapa": hasil.get("why") or ""}
        return (200 if jalan else 503), out

    def setup_post(self, p, medan, berkas, src):
        aksi = p.split("/")[2] if len(p.split("/")) > 2 else str(medan.get("aksi", ""))
        tok = self._sesi(medan)
        extra = []

        def halaman(kode, pesan, tok_baru=None, jenis=""):
            t = tok_baru if tok_baru is not None else tok
            if t:
                extra.append(("Set-Cookie", "dems_setup=%s; Path=/; HttpOnly; SameSite=Strict" % t))
            return self._send(kode, self._setup_page(pesan, t, jenis=jenis), "text/html", extra)

        if aksi == "login":
            tok_baru, pesan, info = teknisi_login(str(medan.get("username", "")),
                                                   str(medan.get("password", "")))
            if not tok_baru:
                log("[setup] login ditolak dari %s: %s" % (src, pesan))
                return halaman(403, "DITOLAK — " + pesan, tok_baru, jenis="gagal")
            return halaman(200, "Masuk sebagai %s (%s)." % (info.get("nama"), info.get("peran")),
                           tok_baru, jenis="ok")
        if aksi == "logout":
            teknisi_logout(tok)
            return self._send(200, self._setup_page("Keluar. Sesi Core ditutup.", ""),
                              "text/html", [("Set-Cookie",
                              "dems_setup=; Path=/; HttpOnly; Max-Age=0")])

        # semua operasi berikut butuh akun vendor yang dibuktikan ulang ke Core (D57)
        if aksi == "logo":
            kode, out = self.proses_unggah(medan, berkas, src)
            if kode in (400, 403, 422):
                return halaman(kode if kode != 400 else 400,
                               "DITOLAK — " + str(out.get("alasan") or out.get("error")),
                               jenis="gagal")
            pesan = ("logo '%s' %dx%d (%d B, crc 0x%04X) %s — balasan alat: %s%s" % (
                out["id"], out["w"], out["h"], out["byte"], int(out["crc"], 16),
                out["status"], json.dumps(out.get("balasan_alat") or {}, separators=(",", ":")),
                (" | " + out["kenapa"]) if out.get("kenapa") else ""))
            return halaman(200 if out["ok"] else 503, pesan, jenis="ok" if out["ok"] else "gagal")
        if aksi == "push":
            ok, pesan, info = teknisi_peran(tok)
            if not ok:
                return halaman(403, "DITOLAK — " + pesan, jenis="gagal")
            hasil = {gid: logo_antre(gid, "tombol push ulang") for gid in LOGO_IDS}
            return halaman(200, "Push ulang: " + json.dumps(hasil, ensure_ascii=False),
                           jenis="ok")
        if aksi in ("identity", "identity-clear"):
            ok, pesan, info = teknisi_peran(tok)
            if not ok:
                return halaman(403, "DITOLAK — " + pesan, jenis="gagal")
            if aksi == "identity-clear":
                body = {"client": "", "satker": ""}
            else:
                body = {}
                for k in ("client", "satker"):
                    if k in medan:
                        body[k] = str(medan[k]).strip()[:38]
                if not body:
                    return halaman(400, "Tidak ada field yang diisi (client / satker).", jenis="gagal")
            kode, out = lanjut_identitas(body)
            if kode != 200:
                alasan = str((out.get("error") or {}).get("code") if isinstance(out.get("error"), dict)
                             else out.get("error") or out)[:160]
                return halaman(kode or 500, "Identitas DITOLAK backend sendiri (HTTP %s): %s"
                               % (kode, alasan), jenis="gagal")
            return halaman(200, "Identitas tersimpan: %s" % json.dumps(
                {k: out.get(k, "") for k in ("client", "satker")}, ensure_ascii=False), jenis="ok")
        self._send(404, {"error": "aksi setup tidak dikenal",
                         "ada": ["login", "logout", "logo", "push", "identity", "identity-clear"]})

    def _setup_page(self, pesan="", tok="", jenis=""):
        sesi_ok, sesi_pesan, info = (teknisi_peran(tok) if tok else (False, "", {}))
        st = {g: logo_status_dict(g) for g in LOGO_IDS}
        with L:
            idn = {"client": G["client"], "satker": G["satker"]}
        warna = {"ok": "#16a34a", "gagal": "#dc2626", "": "#8891a5"}[jenis]
        esc = lambda s: html.escape(str(s), quote=True)

        def baris(gid):
            d = st[gid]
            return ("<tr><td><b>%s</b></td><td>%s</td><td>%s</td><td>%dx%d</td>"
                    "<td>%d B / %d potongan</td><td><code>%s</code></td><td>%s</td>"
                    "<td>%s</td></tr>" % (
                        esc(gid), "ya" if d["tersimpan"] else "TIDAK", esc(d["status"]),
                        d["w"], d["h"], d["byte"], d["potongan"], esc(d["crc_hex"]),
                        esc(d["kapan"] or "-"),
                        esc((d["why"] or json.dumps(d["ack"] or {}, separators=(",", ":")))[:44] or "-")))

        kartu_logo = ""
        for gid, (dw, dh) in LOGO_DEFAULT.items():
            kartu_logo += (
                '<form method="post" action="/setup/logo" enctype="multipart/form-data">'
                '<input type="hidden" name="id" value="%s">'
                "<h3>Logo %s <span style='color:#8891a5;font-weight:400'>(target bawaan %dx%d, "
                "latar %s)</span></h3>"
                '<input type="file" name="image" accept="image/*" required '
                'style="color:#e8e8f0"> '
                'lebar <input name="w" value="%d" size="4" style="width:56px"> '
                'tinggi <input name="h" value="%d" size="4" style="width:56px"> '
                '<select name="fit"><option value="contain">pertahankan rasio</option>'
                '<option value="stretch">regangkan</option></select> '
                "<button type=\"submit\">Unggah &amp; dorong ke alat</button>"
                "</form>" % (esc(gid), esc(gid), dw, dh,
                             "hitam (pojok halaman operasi)" if gid == "client"
                             else "putih (layar pra-kirim)", dw, dh))

        if not sesi_ok:
            isi = (
                "<h2>1 · Masuk sebagai akun vendor (root / gsp.teknisi)</h2>"
                "<p style='color:#8891a5'>Kredensial dikirim ke Core (<code>%s</code>, jalur resmi "
                "<code>POST /api/v1/auth/sign-in</code>) hanya untuk membuktikan peran. Sandi tidak "
                "pernah disimpan, tidak masuk log, dan tidak muncul di URL.</p>"
                "<form method=post action=/setup/login>"
                'username <input name=username size=20 autocomplete=username> '
                'sandi <input name=password type=password size=20 autocomplete=current-password '
                'autocapitalize=off spellcheck=false> '
                "<button type=submit>Bukti ke Core</button></form>"
                "<p style='color:#8891a5'>%s</p>" % (esc(CORE_URL), esc(sesi_pesan or "")))
        else:
            isi = (
                "<h2>1 · Masuk</h2><p>Aktif: <b>%s</b> (%s) &nbsp; "
                '<form method=post action=/setup/logout style="display:inline">'
                "<button>Keluar</button></form></p>"
                "<h2>2 · Logo pre-deliver</h2>%s"
                '<form method=post action=/setup/push>'
                "<button>Push ulang kedua logo ke alat</button> "
                "<span style='color:#8891a5;font-size:13px'>untuk alat baru / sesudah reboot "
                "(maks %d percobaan otomatis, jeda minimum %d dtk)</span></form>"
                "<h2>3 · Nama client &amp; satker</h2>"
                "<p style='color:#8891a5'>Diteruskan ke endpoint identitas internal yang sudah ada "
                "dengan header <code>X-Provision-Key</code> dari environment service — nilainya tidak "
                "pernah ditampilkan di halaman ini (status kunci: %s).</p>"
                '<form method=post action=/setup/identity>'
                "nama client (L1) <input name=client value='%s' size=28 maxlength=38> "
                "satker (L2) <input name=satker value='%s' size=28 maxlength=38> "
                "<button>Simpan identitas</button></form>"
                '<form method=post action=/setup/identity-clear>'
                "<button>Kosongkan identitas (kembali ke keadaan pabrik)</button></form>"
                % (esc(info.get("nama") or "?"), esc(info.get("peran") or ""), kartu_logo,
                   LOGO_MAX_TRIES, int(LOGO_REPUSH_MIN_S),
                   "aktif" if PROVISION_KEY else "kosong", esc(idn["client"]), esc(idn["satker"])))
        return """<!doctype html><meta charset=utf-8><title>DEMS EDGE — setup pre-deliver</title>
<body style="font:15px system-ui;background:#0b0b12;color:#e8e8f0;padding:26px;max-width:980px">
<h1 style="font-size:21px">DEMS EDGE — setup pre-deliver</h1>
<p style="color:#8891a5">Layar ini hanya melayani 127.0.0.1. Setiap operasi dibuktikan dulu ke
DEMS Core bahwa pemanggilnya adalah akun vendor <b>root</b> atau <b>gsp.teknisi</b>; kalau bukan, alasan Core ditampilkan apa
adanya.</p>
%s%s<h2 style="font-size:16px;color:#8891a5">Keadaan logo di alat</h2>
<table cellpadding=6 style="border-collapse:collapse;font-size:13px;width:100%%">
<tr style="color:#8891a5;text-align:left"><td>ADA</td><td>STATUS</td><td>UKURAN</td>
<td>POTONGAN</td><td>CRC</td><td>KAPAN</td><td>BALASAN ALAT</td></tr>%s</table>
<h2 style="font-size:16px;color:#8891a5">Berkas state</h2>
<p style="font-size:13px"><code>%s</code> · olahan gambar: %s · protokol chunk: %d B,
tunggu ACK %.0f dtk · snapshot panel %s B (anggaran 600 B)</p>
<p style="color:#8891a5;font-size:13px">API: <code>GET/POST /api/dems/logo</code> · halaman
pantau: <code>/</code></p>
<style>input,select,button{font:inherit;background:#171724;color:#e8e8f0;border:1px solid #2a2a3a;
padding:6px 9px;border-radius:6px}button{cursor:pointer;background:#242438}
form{margin:10px 0}h2{font-size:17px;margin-top:26px}h3{font-size:15px;margin-bottom:6px}
code{background:#171724;padding:1px 4px;border-radius:4px}</style>
""" % ('<div style="border-left:4px solid %s;background:#12121c;padding:10px 12px;margin:14px 0">%s'
       '</div>' % (warna, esc(pesan)) if pesan else "", isi, baris("client") + baris("splash"),
       esc(logo_berkas("client")), "PIL" if PUNYA_PIL else "png-murni (tanpa PIL)",
       LOGO_CHUNK, LOGO_ACK_S, str(logo_semua_status().get("snapshot_b")))

    def do_GET(self):
        p = self.path.split("?")[0]
        if p.startswith("/api/dems/ch/"):
            idx = chan_of(p.split("/")[4])
            if not idx or idx == "BAD":
                return self._send(404, {"error": f"kanal harus 1..{N} atau {NAMES}"})
            i = idx[0]
            with L:
                c = dict(CH[i])
            c.update({"c": i + 1, "name": NAMES[i],
                      "rec": "start" if c["rec"] else "stop",
                      "durasi_s": int(time.time() - c["set_at"]) if c["rec"] else 0,
                      "last_post_s": int(time.time() - c["last_post"]) if c["last_post"] else None})
            return self._send(200, c)
        if p.startswith("/api/dems/logo"):
            return self._send(200, logo_semua_status())
        if p == "/setup" or p.startswith("/setup/"):
            return self._send(200, self._setup_page(), "text/html")
        if p.startswith("/api/dems/log"):        # CATATAN: /api/dems/logo sudah ditangani di atas
            try:
                n = int(self.path.split("n=")[1].split("&")[0]) if "n=" in self.path else 50
            except Exception:
                n = 50
            n = max(1, min(n, 300))
            with L:
                ev = list(EVENTS)
            return self._send(200, {"jumlah_tersimpan": len(ev), "kejadian": ev[-n:]})
        if p.startswith("/api/dems/identity"):
            with L:
                return self._send(200, {"satker": G["satker"], "client": G["client"],
                                        "tersimpan_di": IDENTITY_FILE or "(tidak ada file state)",
                                        "kunci_provisi": "aktif" if PROVISION_KEY else "kosong"})
        if p.startswith("/api/dems/status"):
            with L:
                chans = [{"c": i + 1, "name": NAMES[i],
                          "rec": "start" if c["rec"] else "stop", "cam": bool(c["cam"]),
                          "dev": c["dev"], "trek": c["dev"] or "-",
                          "file": c["file"],
                          "durasi_s": int(time.time() - c["set_at"]) if c["rec"] else 0,
                          "lease_tinggal_s": (max(0, int(c["expires_at"] - time.time()))
                                              if c["rec"] and c["expires_at"] else None),
                          "last_post_s": int(time.time() - c["last_post"]) if c["last_post"] else None,
                          "src": c["src"]} for i, c in enumerate(CH)]
                d = dict(G)
                eff = efektif()          # di dalam kunci: dibaca bersama daftar kanal
                # --- pembacaan satu lapis: siapa yang diam, alat atau mesin? ---
                now = time.time()
                posts = [c["last_post"] for c in CH if c["last_post"]]
                core_s = int(now - max(posts)) if posts else None
                bisu = int(now - G["last_req_ms"] / 1000) if G["last_req_ms"] else None
                if not G["port"]:
                    verdict = "PORT-TIDAK-ADA"          # backend tidak sampai ke alat
                elif bisu is None or bisu > PANEL_SILENT_S:
                    verdict = "PANEL-DIAM"              # port dipegang, alat tidak bertanya
                elif core_s is not None and core_s > 30:
                    verdict = "CORE-DIAM"               # alat & backend sehat, produk upstream berhenti
                else:
                    verdict = "OK"
            lvl, alasan = health()
            d.update({"channels": chans, "n": N, "names": NAMES,
                      "satker": G["satker"], "client": G["client"],
                      "lapisan": {"client": "prinsipal (pre-deliver, dikunci kunci provisi)",
                                  "satker": "operasional (boleh setelah serah-terima)",
                                  "kunci_provisi": "aktif" if PROVISION_KEY else "kosong: pagar = akses loopback/USB"},
                      "nrec": sum(1 for c in CH if c["rec"]),
                      "rec": "start" if any(c["rec"] for c in CH) else "stop",
                      "health": lvl, "alasan": alasan, "rekam_dir": REKAM_DIR,
                      "ch_stale_s": CH_STALE_S,
                      "uptime_s": int(time.time() - G["started_at"]),
                      "verdict": verdict,
                      "port": G["port"] or "(belum terbuka)", "port_cara": G["port_cara"] or "-",
                      "port_sejak_s": int(now - G["port_since"]) if G["port_since"] else None,
                      "ganti_indeks": G["port_changes"], "tanpa_panel_s": G["down_s"],
                      "buka": G["opens"],
                      "panel_up_s": G["panel_up_s"] or None,
                      "panel_reboot": G["resets"], "panel_bisu_s": bisu, "core_bisu_s": core_s,
                      "usb_target": WANT_SERIAL or WANT_VIDPID or "(kosong: hanya DEMS_DEV)",
                      # keadaan per TREK apa adanya + mode penggabungan, supaya keputusan
                      # "1 kamera = 1 relay" bisa dibaca orang lain tanpa menebak
                      "ch_mode": CH_MODE,
                      "kanal_keluaran": [{"c": i + 1, "rec": "start" if rec else "stop",
                                          "cam": bool(cam), "dev": dv}
                                         for i, (rec, cam, f, dv) in enumerate(eff)]})
            d.pop("health_override_note", None)
            for mentah in ("port_since", "down_s", "started_at"):
                d.pop(mentah, None)
            return self._send(200, d)
        if p.startswith("/healthz"):
            lvl, alasan = health()
            body = (lvl + (" " + ",".join(alasan) if alasan else "")).encode() + b"\n"
            self.close_connection = True
            try:
                self.send_response(503 if lvl == "fail" else 200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers(); self.wfile.write(body)
            except Exception:
                pass
            return
        if p == "/":
            return self._send(200, self._page(), "text/html")
        self._send(404, {"error": "endpoint tidak dikenal",
                         "coba": ["/api/dems/status", "/api/dems/ch/1/status", "/healthz"]})

    def _page(self):
        lvl, alasan = health()
        warna = {"ok": "#16a34a", "warn": "#ea580c", "fail": "#dc2626"}[lvl]
        rows = ""
        for i, c in enumerate(CH):
            if c["rec"]:
                st = '<b style="color:#dc2626">REKAM</b>'
                dur = f"{int(time.time() - c['set_at'])}s"
                if c["expires_at"]:
                    dur += f" <span style='color:#8891a5'>(lease {max(0,int(c['expires_at']-time.time()))}s)</span>"
            else:
                st = '<span style="color:#8891a5">STOP</span>'; dur = "-"
            dot = ('<span style="display:inline-block;width:13px;height:13px;'
                   'border-radius:50%;background:#16a34a"></span>' if c["cam"] else
                   '<span style="display:inline-block;width:13px;height:13px;'
                   'border-radius:50%;background:#dc2626"></span>')
            rows += (f"<tr><td>{NAMES[i]}</td><td>{dot}</td><td>{st}</td>"
                     f"<td><code>{c['file'] or '-'}</code></td><td>{dur}</td>"
                     f"<td style='color:#8891a5'>{c['src']}</td></tr>")
        with L: tx, rx = G["tx"], G["rx"]
        return f"""<!doctype html><meta charset=utf-8><title>DEMS EDGE backend</title>
<body style="font:15px system-ui;background:#0b0b12;color:#e8e8f0;padding:26px">
<h1 style="font-size:21px">DEMS EDGE — backend {N} kanal</h1>
<p>HEALTH: <b style="color:{warna}">{lvl.upper()}</b> {', '.join(alasan)} &nbsp;|&nbsp;
Tautan panel: kirim {tx} · terima {rx} &nbsp;|&nbsp; dir {REKAM_DIR}</p>
<table cellpadding=7 style="border-collapse:collapse;width:100%">
<tr style="color:#8891a5;text-align:left;border-bottom:1px solid #2a2a3a">
<th>KANAL</th><th>KAMERA</th><th>STATUS</th><th>BERKAS</th><th>DURASI</th><th>SUMBER</th></tr>{rows}</table>
<h2 style="font-size:16px;color:#8891a5">Jejak kejadian (terbaru)</h2>
<table cellpadding=4 style="border-collapse:collapse;font-size:13px">
<tr style="color:#8891a5;text-align:left"><th>WAKTU</th><th>KANAL</th><th>AKSI</th><th>SUMBER</th><th>KETERANGAN</th></tr>
{"".join(f"<tr><td style='color:#8891a5'>{e['ts']}</td><td>{e['channel']}</td><td>{e['action']}</td><td>{e['src']}</td><td><code>{e['detail']}</code></td></tr>" for e in list(EVENTS)[-12:][::-1])}</table>
<p style="color:#8891a5;font-size:13px">Auto-segar 3 detik · jejak lengkap: GET /api/dems/log</p>
<meta http-equiv=refresh content=3>
"""

    def do_POST(self):
        p = self.path.split("?")[0]
        src0 = self.client_address[0]
        if p == "/api/dems/setup":
            # D57: pintu JSON untuk modul konsol. Badan = {satker?, client?, logo_base64?, logo_target?}.
            # Gerbang sama ketatnya; sesi Core pemanggil ikut dibawa dan dibuktikan balik ke Core.
            try:
                panjang = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                panjang = -1
            if panjang < 0 or panjang > MAX_SETUP_JSON_B:
                return self._send(413, {"error": "body terlalu besar (maks %d B)" % MAX_SETUP_JSON_B})
            try:
                body = json.loads(self.rfile.read(panjang).decode("utf-8"))
                assert isinstance(body, dict)
            except Exception:
                return self._send(400, {"error": "JSON tidak sah"})
            ok, pesan, info, _tok = gerbang_teknisi({}, "", self.headers.get("Cookie"))
            if not ok:
                log("[setup-konsol] DITOLAK dari %s: %s" % (src0, pesan))
                event("-", "SETUP_TAK_BERWEWENANG", src0[:12], pesan[:60])
                return self._send(403, {"error": "BUKAN_TEKNISI", "alasan": pesan})
            ubah = {"satker": False, "client": False, "logo": False}
            # C2-1 (D77): pintu ini SEMUA-ATAU-TIDAK-SAMA-SEKALI. Tahap 1 hanya memeriksa dan
            # menyiapkan (target, base64, konversi gambar) tanpa menyentuh G, berkas, atau antrean;
            # penolakan apa pun (400/422/500) berarti tidak ada yang berubah. Dulu nama disimpan
            # dulu lalu logo ditolak 422 -> nama berubah tanpa baris audit Core (F-6-07/F-6-01).
            logo_siap = None                                   # (gid, raw565, w, h) bila ada logo
            if body.get("logo_base64"):
                # DF-36 (D20c, D57e, D29 Q3): satu slot per permintaan; "both" ditolak.
                pilih = str(body.get("logo_target") or "client").strip().lower()
                if pilih not in LOGO_IDS:
                    return self._send(400, {"error": "logo_target harus client|splash", "dapat": pilih})
                try:
                    import base64 as _b64
                    isi = _b64.b64decode(str(body["logo_base64"]), validate=True)
                except Exception:
                    return self._send(422, {"error": "GAMBAR_GAGAL", "alasan": "base64 tidak sah"})
                try:
                    raw565, w, h = siapkan_logo(isi, pilih, None, None, "contain")
                except Exception as e:
                    return self._send(422, {"error": "GAMBAR_GAGAL", "alasan": str(e)[:200]})
                logo_siap = (pilih, raw565, w, h)
            nama_baru = {k: str(body.get(k) or "").strip()[:batas]
                         for k, batas in (("satker", 38), ("client", 40)) if k in body}
            # Tahap 2: terapkan. Logo disimpan lebih dulu karena hanya langkah itu yang bisa gagal
            # di disk; bila gagal, identitas belum disentuh.
            nama_op = info.get("nama") or "?"
            if logo_siap is not None:
                gid, raw565, w, h = logo_siap
                try:
                    simpan_logo(gid, raw565, w, h, "unggah:konsol:%s" % nama_op)
                except Exception as e:
                    log("[setup-konsol] logo '%s' GAGAL disimpan: %s" % (gid, str(e)[:80]))
                    return self._send(500, {"error": "LOGO_GAGAL_DISIMPAN", "alasan": str(e)[:120]})
                ubah["logo"] = True
            with L:
                for k, v in nama_baru.items():
                    if v != G[k]:
                        G[k] = v
                        ubah[k] = True
            if ubah["satker"] or ubah["client"]:
                simpan_identitas()
            if logo_siap is not None:
                logo_antre(logo_siap[0], "unggah konsol oleh %s" % nama_op)
            logo_out = {}
            with L:
                for gid in LOGO_IDS:
                    st = dict(LOGO[gid])
                logo_out = {gid: {"tersimpan": bool(LOGO[gid].get("tersimpan"))} for gid in LOGO_IDS}
                out = {"ok": True, "satker": G["satker"], "client": G["client"],
                       "logo": logo_out, "changed": {"satker": ubah["satker"], "client": ubah["client"], "logo": ubah["logo"]}}
            event("-", "SETUP_KONSOL", "-", "%s%s%s" % ("satker " if ubah["satker"] else "", "client " if ubah["client"] else "", "logo" if ubah["logo"] else ""))
            return self._send(200, out)
        if p.startswith("/api/dems/logo"):
            raw, medan, berkas = self._form()
            if raw is None:
                return self._send(413, {"error": "body terlalu besar (maks %d B)" % MAX_UPLOAD_B})
            if p.endswith("/push"):
                ok, pesan, info, _tok = gerbang_teknisi(medan, self._sesi(medan), self.headers.get("Cookie"))
                if not ok:
                    return self._send(403, {"error": "BUKAN_TEKNISI", "alasan": pesan})
                # DF-36 (D20c, D29 Q3): "both" ditolak di pintu ini juga, dan id diperiksa SEBELUM
                # apa pun diantrekan. Tanpa id = dorong ulang setiap slot tersimpan (jalur pulih
                # yang disebut log gagal_berturut; sama dengan tombol push halaman /setup).
                pilih = str(medan.get("id") or "").strip().lower()
                if pilih and pilih not in LOGO_IDS:
                    return self._send(400, {"error": "id harus client|splash (atau tanpa id = semua slot)",
                                            "dapat": pilih})
                target = [pilih] if pilih else list(LOGO_IDS)
                hasil = {g: logo_antre(g, "POST /api/dems/logo/push") for g in target}
                return self._send(200, {"ok": any(v.startswith(("jalan", "antre")) for v in hasil.values()),
                                        "push": hasil})
            kode, out = self.proses_unggah(medan, berkas, src0)
            return self._send(kode, out)
        if p.startswith("/setup"):
            raw, medan, berkas = self._form()
            if raw is None:
                return self._send(413, self._setup_page("Berkas terlalu besar (maks %d B)."
                                                        % MAX_UPLOAD_B, "", "gagal"),
                                  "text/html")
            return self.setup_post(p, medan or {}, berkas or {}, src0)
        body = self._body()
        if body is None:
            return self._send(400, {"error": "JSON tidak sah / body kosong"})
        src = self.client_address[0]
        if p.startswith("/api/dems/ch/") and p.endswith("/cam"):
            idx = chan_of(p.split("/")[4])
            if not idx or idx == "BAD":
                return self._send(404, {"error": f"kanal harus 1..{N} atau {NAMES}"})
            v = body.get("connected", body.get("cam", body.get("value", True)))
            on = truthy(v)
            with L:
                for i in idx:
                    if CH[i]["cam"] != on:
                        event(NAMES[i], "KAMERA_" + ("TERCOLOK" if on else "LEPAS"), src,
                              "endpoint /cam")
                    CH[i]["cam"] = on
                    CH[i]["last_post"] = time.time()
                    CH[i]["src"] = src
            log(f"kamera {'semua kanal' if len(idx)>1 else NAMES[idx[0]]} -> "
                f"{'TERCOLOK' if on else 'LEPAS'} dari {src}")
            return self._send(200, snapshot())
        if p.startswith("/api/dems/ch/"):
            idx = chan_of(p.split("/")[4])
            if not idx or idx == "BAD":
                return self._send(404, {"error": f"kanal harus 1..{N} atau {NAMES}"})
            out = set_channel(idx, body, src)
            return (self._send(200, out) if out else
                    self._send(400, {"error": 'pakai "rec":"start" atau "rec":"stop"'}))
        if p.startswith("/api/dems/identity"):
            # Lapisan: "client" = prinsipal (diisi saat pre-deliver, dikunci kunci provisi);
            # "satker" = operasional (boleh setelah serah-terima). Pagar terendah tetap
            # loopback: endpoint ini tanpa autentikasi, jadi penulisannya = siapa pun yang
            # mencolokkan USB ke mesin ini.  (`body` sudah dibaca di awal do_POST.)
            src = self.client_address[0]
            kunci = str(self.headers.get("X-Provision-Key", "") or body.get("key", ""))
            ubah = {}
            with L:
                for k, lapisan in (("satker", "operasional"), ("client", "prinsipal")):
                    if k not in body: continue
                    if lapisan == "prinsipal" and PROVISION_KEY and kunci != PROVISION_KEY:
                        log(f"[identitas] DITOLAK: '{k}' lapisan prinsipal, kunci provisi salah dari {src}")
                        return self._send(403, {"error": "PROVISION_KEY_REQUIRED", "field": k,
                                                "lapisan": "prinsipal (pre-deliver)"})
                    G[k] = str(body[k]).strip()[:38]
                    ubah[k] = G[k]
                if not ubah:
                    return self._send(400, {"error": "TIDAK ADA FIELD", "diterima": ["satker", "client"]})
                simpan_identitas()
            log(f"[identitas] {ubah} dari {src}")
            event("-", "IDENTITAS", src, json.dumps(ubah, ensure_ascii=False))
            return self._send(200, {"ok": True, **ubah, "tersimpan_di": IDENTITY_FILE or "(env saja)"})
        if p.startswith("/api/dems/status"):
            v = body.get("channel", body.get("ch", body.get("channels")))
            if v is None:
                return self._send(400, {"error": f'"channel" wajib (1..{N}, nama kanal, atau "all")',
                                        "names": NAMES})
            idx = []
            for item in (v if isinstance(v, list) else [v]):
                got = chan_of(item)
                if got == "BAD" or not got:
                    return self._send(400, {"error": f"kanal tak dikenal: {item!r}", "names": NAMES})
                idx += got
            out = set_channel(sorted(set(idx)), body, src)
            return (self._send(200, out) if out else
                    self._send(400, {"error": 'pakai "rec":"start" atau "rec":"stop"'}))
        if p.startswith("/api/dems/health"):
            h = str(body.get("health", "")).lower()
            # Hanya warn|fail yang bisa dipaku; "ok"/"auto" melepas kembali ke
            # perhitungan otomatis, supaya kegagalan nyata tak bisa disembunyikan.
            with L:
                G["health_override"] = h if h in ("warn", "fail") else None
                G["health_note"] = str(body.get("note", ""))[:40]
            log("health override ->", G["health_override"] or "OTOMATIS (hitung dari gejala)")
            lvl, alasan = health()
            return self._send(200, {"health": lvl, "override": G["health_override"],
                                    "alasan": alasan})
        self._send(404, {"error": "endpoint tidak dikenal"})

    def log_message(self, *a): pass


if __name__ == "__main__":
    log(f"backend DEMS-EDGE | {N} kanal {NAMES} | USB {DEV}@{BAUD} | HTTP {BIND}:{PORT} | "
        f"disk {REKAM_DIR} (kuning <{MIN_FREE_GB}GB, merah <{CRIT_FREE_GB}GB)"
        + (f" | REC tanpa kabar >{CH_STALE_S}s = WASPADA" if CH_STALE_S else ""))
    muat_identitas()
    muat_logo()
    log("[logo] olahan gambar: %s | direktori state %s | Core %s (origin konsol %s) | "
        "gerbang identitas akun vendor %s | halaman setup http://%s:%d/setup"
        % ("PIL " + (_PILImage.__version__ if hasattr(_PILImage, "__version__") else "?")
           if PUNYA_PIL else "PNG murni tanpa PIL", LOGO_DIR, CORE_URL, CORE_ORIGIN,
           "/".join(AKUN_VENDOR), BIND, PORT))
    threading.Thread(target=setup_prune, daemon=True).start()
    threading.Thread(target=serial_worker, daemon=True).start()
    threading.Thread(target=reaper, daemon=True).start()
    ThreadingHTTPServer((BIND, PORT), H).serve_forever()
