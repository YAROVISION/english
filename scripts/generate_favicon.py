#!/usr/bin/env python3
import struct
import zlib
import math

def point_in_polygon(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def rounded_rect_dist(x, y, w, h, r):
    # Center origin
    cx = w / 2.0
    cy = h / 2.0
    px = abs(x - cx) - (cx - r)
    py = abs(y - cy) - (cy - r)
    qx = max(px, 0.0)
    qy = max(py, 0.0)
    d = math.hypot(qx, qy) + min(max(px, py), 0.0) - r
    return d

def generate_icon(size):
    # Bolt polygon normalized to [0, 1]
    # Coordinates based on SVG:
    # 35.5/64, 8/64 -> (0.555, 0.125)
    # 18/64, 34/64 -> (0.281, 0.531)
    # 31/64, 34/64 -> (0.484, 0.531)
    # 24/64, 56/64 -> (0.375, 0.875)
    # 47/64, 28/64 -> (0.734, 0.438)
    # 34.5/64, 28/64 -> (0.539, 0.438)
    # 39.5/64, 8/64 -> (0.617, 0.125)
    bolt_pts = [
        (0.555 * size, 0.125 * size),
        (0.281 * size, 0.531 * size),
        (0.484 * size, 0.531 * size),
        (0.375 * size, 0.875 * size),
        (0.734 * size, 0.438 * size),
        (0.539 * size, 0.438 * size),
        (0.617 * size, 0.125 * size)
    ]
    
    # Highlight polygon (inner shine)
    bolt_shine = [
        (0.555 * size, 0.125 * size),
        (0.375 * size, 0.484 * size),
        (0.516 * size, 0.438 * size),
        (0.438 * size, 0.734 * size),
        (0.672 * size, 0.438 * size),
        (0.531 * size, 0.438 * size),
        (0.586 * size, 0.188 * size)
    ]

    radius = size * 0.24
    margin = size * 0.04
    rect_w = size - 2 * margin
    rect_h = size - 2 * margin

    scale = 3  # 3x supersampling for ultra smooth antialiasing
    ss_size = size * scale

    raw_data = bytearray()
    
    for y in range(size):
        raw_data.append(0)  # Filter byte 0 (None)
        for x in range(size):
            r_acc, g_acc, b_acc, a_acc = 0, 0, 0, 0
            
            for sy in range(scale):
                py = y + (sy + 0.5) / scale
                for sx in range(scale):
                    px = x + (sx + 0.5) / scale
                    
                    # Check squircle container
                    d = rounded_rect_dist(px - margin, py - margin, rect_w, rect_h, radius)
                    
                    if d > 0.5:
                        # Outside
                        continue
                    
                    # Alpha edge
                    alpha = 1.0 if d <= -0.5 else max(0.0, min(1.0, 0.5 - d))
                    
                    # Background gradient: Indigo (#4f46e5) to Sky (#0284c7)
                    t = (px + py) / (2.0 * size)
                    t = max(0.0, min(1.0, t))
                    bg_r = 79 * (1 - t) + 2 * t
                    bg_g = 70 * (1 - t) + 132 * t
                    bg_b = 229 * (1 - t) + 199 * t
                    
                    # Top-half subtle gloss
                    if py < size * 0.48 and d <= -1.0:
                        gloss = 0.18 * (1.0 - py / (size * 0.48))
                        bg_r = bg_r * (1 - gloss) + 255 * gloss
                        bg_g = bg_g * (1 - gloss) + 255 * gloss
                        bg_b = bg_b * (1 - gloss) + 255 * gloss

                    # Border glow (white stroke)
                    if -1.5 <= d <= 0.0:
                        border_t = max(0.0, min(1.0, (d + 1.5) / 1.5))
                        stroke_alpha = 0.3 * (1.0 - border_t)
                        bg_r = bg_r * (1 - stroke_alpha) + 255 * stroke_alpha
                        bg_g = bg_g * (1 - stroke_alpha) + 255 * stroke_alpha
                        bg_b = bg_b * (1 - stroke_alpha) + 255 * stroke_alpha

                    cur_r, cur_g, cur_b = bg_r, bg_g, bg_b

                    # Check Lightning Bolt
                    in_bolt = point_in_polygon(px, py, bolt_pts)
                    if in_bolt:
                        # Gold gradient: top light yellow (#fef08a) to bottom amber (#f59e0b)
                        bt = max(0.0, min(1.0, (py - size * 0.125) / (size * 0.75)))
                        b_r = 254 * (1 - bt) + 245 * bt
                        b_g = 240 * (1 - bt) + 158 * bt
                        b_b = 138 * (1 - bt) + 11 * bt
                        
                        # Inner shine
                        if point_in_polygon(px, py, bolt_shine):
                            b_r = b_r * 0.6 + 255 * 0.4
                            b_g = b_g * 0.6 + 255 * 0.4
                            b_b = b_b * 0.6 + 255 * 0.4
                            
                        cur_r, cur_g, cur_b = b_r, b_g, b_b

                    r_acc += cur_r * alpha
                    g_acc += cur_g * alpha
                    b_acc += cur_b * alpha
                    a_acc += 255.0 * alpha

            total_samples = scale * scale
            raw_data.append(int(round(r_acc / total_samples)))
            raw_data.append(int(round(g_acc / total_samples)))
            raw_data.append(int(round(b_acc / total_samples)))
            raw_data.append(int(round(a_acc / total_samples)))

    return create_png(size, size, bytes(raw_data))

def create_png(width, height, raw_scanlines):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack(">I", crc)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(raw_scanlines, 9))
    iend = chunk(b"IEND", b"")
    return header + ihdr + idat + iend

def create_ico(png_data, size=32):
    # ICO containing one PNG image
    # ICONDIR
    ico_header = struct.pack("<HHH", 0, 1, 1)
    # ICONDIRENTRY: bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes, dwImageOffset
    w = 0 if size >= 256 else size
    h = 0 if size >= 256 else size
    offset = 6 + 16  # header + 1 entry
    ico_entry = struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(png_data), offset)
    return ico_header + ico_entry + png_data

if __name__ == "__main__":
    print("Generating favicon-32.png...")
    png32 = generate_icon(32)
    with open("favicon-32x32.png", "wb") as f:
        f.write(png32)
    
    print("Generating favicon.ico...")
    ico = create_ico(png32, 32)
    with open("favicon.ico", "wb") as f:
        f.write(ico)
        
    print("Generating apple-touch-icon.png (180x180)...")
    png180 = generate_icon(180)
    with open("apple-touch-icon.png", "wb") as f:
        f.write(png180)

    print("All favicon assets generated successfully!")
