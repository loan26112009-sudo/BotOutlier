"""Génère des icônes PNG simples pour l'extension Chrome, sans dépendance externe
(juste zlib + struct, disponibles dans la stdlib)."""

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent.parent / "extension" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = (17, 24, 39, 255)  # bleu nuit
ACCENT = (239, 68, 68, 255)  # rouge "outlier" pour la flèche qui décolle
BAR = (75, 85, 99, 255)  # gris pour les barres "normales"


def png_bytes(size: int) -> bytes:
    pixels = [[BG for _ in range(size)] for _ in range(size)]

    def set_px(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            pixels[y][x] = color

    def fill_rect(x0, y0, x1, y1, color):
        for y in range(y0, y1):
            for x in range(x0, x1):
                set_px(x, y, color)

    margin = max(1, size // 8)
    bar_w = max(1, size // 8)
    gap = max(1, size // 16)
    base_y = size - margin

    heights = [0.3, 0.45, 0.35]
    x = margin
    for h in heights:
        bh = int((size - 2 * margin) * h)
        fill_rect(x, base_y - bh, x + bar_w, base_y, BAR)
        x += bar_w + gap

    spike_h = int((size - 2 * margin) * 0.85)
    fill_rect(x, base_y - spike_h, x + bar_w, base_y, ACCENT)

    for i in range(max(1, size // 24)):
        fill_rect(x - gap - i - 1, base_y - spike_h - i * 2, x - gap - i, base_y - spike_h + 2, ACCENT)

    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for (r, g, b, a) in row:
            raw.extend((r, g, b, a))

    def chunk(tag, data):
        return (
            struct.pack("!I", len(data))
            + tag
            + data
            + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


for size in (16, 48, 128):
    path = OUT_DIR / f"icon{size}.png"
    path.write_bytes(png_bytes(size))
    print("wrote", path)
