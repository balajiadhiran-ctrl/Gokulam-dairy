"""Generate simple brand PNG icons for the PWA using only the stdlib.
Green rounded-ish square with a gold ring + light disc. Replace with a
professionally designed icon before production."""
import struct
import zlib
from pathlib import Path

GREEN = (99, 149, 237)   # brand blue #6395ED (name kept for minimal diff)
LIGHT = (239, 244, 254)
GOLD = (240, 192, 64)


def make_png(size: int, path: Path) -> None:
    cx = cy = size / 2
    r_disc = size * 0.26
    r_ring_out = size * 0.30
    r_ring_in = size * 0.27
    corner = size * 0.18

    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter byte: none
        for x in range(size):
            # rounded corners -> transparent
            dx = max(corner - x, x - (size - corner), 0)
            dy = max(corner - y, y - (size - corner), 0)
            if dx * dx + dy * dy > corner * corner:
                rows += bytes((0, 0, 0, 0))
                continue
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r_disc:
                rows += bytes((*LIGHT, 255))
            elif r_ring_in <= d <= r_ring_out:
                rows += bytes((*GOLD, 255))
            else:
                rows += bytes((*GREEN, 255))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(rows), 9)
    path.write_bytes(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "frontend" / "public"
    out.mkdir(parents=True, exist_ok=True)
    make_png(192, out / "icon-192.png")
    make_png(512, out / "icon-512.png")
