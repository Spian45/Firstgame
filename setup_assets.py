import os, sys, zlib, struct, math

def save_png(filename, w, h, pixel_data):
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw_lines = bytearray()
    s = w * 4
    for y in range(h):
        raw_lines.append(0)
        raw_lines.extend(pixel_data[y * s : (y + 1) * s])
    idat_data = zlib.compress(bytes(raw_lines), 9)
    def chunk(tag, cdata):
        crc = zlib.crc32(tag + cdata) & 0xffffffff
        return struct.pack('>I', len(cdata)) + tag + cdata + struct.pack('>I', crc)
    png_bytes = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat_data) + chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as out_f:
        out_f.write(png_bytes)
    print(f'Saved {filename} ({w}x{h})')

def load_png(filename):
    with open(filename, 'rb') as f:
        data = f.read()
    pos = 8
    w, h = 0, 0
    idat = bytearray()
    while pos < len(data):
        length, = struct.unpack('>I', data[pos:pos+4])
        ctype = data[pos+4:pos+8]
        if ctype == b'IHDR':
            w, h = struct.unpack('>II', data[pos+8:pos+16])
        elif ctype == b'IDAT':
            idat.extend(data[pos+8:pos+8+length])
        pos += 12 + length
    raw = bytearray(zlib.decompress(idat))
    stride = w * 4
    recon = bytearray(w * h * 4)
    for y in range(h):
        filter_type = raw[y * (stride + 1)]
        line_raw = raw[y * (stride + 1) + 1 : (y + 1) * (stride + 1)]
        prior = recon[(y - 1) * stride : y * stride] if y > 0 else bytearray(stride)
        curr = bytearray(stride)
        if filter_type == 0:
            curr[:] = line_raw
        elif filter_type == 2:
            for i in range(stride):
                curr[i] = (line_raw[i] + prior[i]) & 0xff
        recon[y * stride : (y + 1) * stride] = curr
    return w, h, recon

def extract_frame(src_pixels, src_w, src_h, fx, fy, fw, fh):
    out = bytearray(fw * fh * 4)
    for y in range(fh):
        sy = fy + y
        if 0 <= sy < src_h:
            for x in range(fw):
                sx = fx + x
                if 0 <= sx < src_w:
                    s_idx = (sy * src_w + sx) * 4
                    o_idx = (y * fw + x) * 4
                    out[o_idx:o_idx+4] = src_pixels[s_idx:s_idx+4]
    return out

def blit(dest, dest_w, dest_h, src, src_w, src_h, dx, dy, alpha_mult=1.0):
    for y in range(src_h):
        target_y = dy + y
        if 0 <= target_y < dest_h:
            for x in range(src_w):
                target_x = dx + x
                if 0 <= target_x < dest_w:
                    s_idx = (y * src_w + x) * 4
                    sa = src[s_idx + 3] / 255.0 * alpha_mult
                    if sa <= 0.001:
                        continue
                    d_idx = (target_y * dest_w + target_x) * 4
                    da = dest[d_idx + 3] / 255.0
                    out_a = sa + da * (1.0 - sa)
                    if out_a > 0:
                        dest[d_idx] = int((src[s_idx] * sa + dest[d_idx] * da * (1.0 - sa)) / out_a)
                        dest[d_idx+1] = int((src[s_idx+1] * sa + dest[d_idx+1] * da * (1.0 - sa)) / out_a)
                        dest[d_idx+2] = int((src[s_idx+2] * sa + dest[d_idx+2] * da * (1.0 - sa)) / out_a)
                        dest[d_idx+3] = int(out_a * 255)

def main():
    print("Setting up game assets...")
    w, h, run_pixels = load_png('assets/sprites/player_run.png')
    
    # 1. Generate Idle Spritesheet (4 frames of breathing / subtle tail wag)
    idle_sheet = bytearray(128 * 4 * 128 * 4)
    # Use frame 0 and frame 4 as key poses
    frame0 = extract_frame(run_pixels, w, h, 0, 0, 128, 128)
    frame4 = extract_frame(run_pixels, w, h, 128 * 4, 0, 128, 128)
    
    # We can create a 4-frame breathing idle animation from frame 0
    for f in range(4):
        # f = 0, 1, 2, 3
        # Slight bobbing: 0: dy=0, 1: dy=-1, 2: dy=-2, 3: dy=-1
        dy = [0, -1, -2, -1][f]
        for y in range(128):
            src_y = y - dy
            if 0 <= src_y < 128:
                for x in range(128):
                    s_idx = (src_y * 128 + x) * 4
                    d_idx = (y * (128 * 4) + (f * 128 + x)) * 4
                    idle_sheet[d_idx:d_idx+4] = frame0[s_idx:s_idx+4]
    save_png('assets/sprites/player_idle.png', 128 * 4, 128, idle_sheet)

    # 2. Generate Jump Spritesheet (2 frames: Jump Rise from frame 2, Fall from frame 6)
    jump_sheet = bytearray(128 * 2 * 128 * 4)
    frame_jump = extract_frame(run_pixels, w, h, 128 * 2, 0, 128, 128)
    frame_fall = extract_frame(run_pixels, w, h, 128 * 6, 0, 128, 128)
    blit(jump_sheet, 256, 128, frame_jump, 128, 128, 0, 0)
    blit(jump_sheet, 256, 128, frame_fall, 128, 128, 128, 0)
    save_png('assets/sprites/player_jump.png', 256, 128, jump_sheet)

    # 3. Generate Attack Spritesheet (4 frames of combo slashes with glowing spirit blade arcs)
    attack_sheet = bytearray(128 * 4 * 128 * 4)
    attack_bases = [
        extract_frame(run_pixels, w, h, 128 * 1, 0, 128, 128),
        extract_frame(run_pixels, w, h, 128 * 3, 0, 128, 128),
        extract_frame(run_pixels, w, h, 128 * 5, 0, 128, 128),
        extract_frame(run_pixels, w, h, 128 * 7, 0, 128, 128)
    ]
    for f in range(4):
        base = attack_bases[f]
        blit(attack_sheet, 512, 128, base, 128, 128, f * 128, 0)
        # Add dynamic spectral fox claw / blade slash arc
        cx = f * 128 + 92
        cy = 64
        arc_color = [(255, 180, 50), (255, 90, 30), (140, 220, 255), (255, 230, 100)][f]
        radius = 36 + f * 5
        thickness = 8
        for angle_deg in range(-60, 60):
            rad = math.radians(angle_deg + (f * 15))
            for r in range(radius - thickness, radius + thickness):
                px = int(cx + math.cos(rad) * r)
                py = int(cy + math.sin(rad) * r)
                if 0 <= px < 512 and 0 <= py < 128:
                    idx = (py * 512 + px) * 4
                    dist_to_center_r = abs(r - radius) / float(thickness)
                    alpha = max(0, min(255, int(240 * (1.0 - dist_to_center_r))))
                    if alpha > attack_sheet[idx+3]:
                        attack_sheet[idx] = arc_color[0]
                        attack_sheet[idx+1] = arc_color[1]
                        attack_sheet[idx+2] = arc_color[2]
                        attack_sheet[idx+3] = alpha
    save_png('assets/sprites/player_attack.png', 512, 128, attack_sheet)

    # 4. Generate Portrait for Ren (Fox Girl Dialogue Avatar, 128x128 cropped bust)
    portrait_ren = bytearray(128 * 128 * 4)
    # Crop head and shoulders from Frame 0: X: 45 to 110, Y: 0 to 75
    # Scaled to fill 128x128 nicely with a decorative portrait circle
    head_crop = extract_frame(run_pixels, w, h, 42, 2, 68, 70)
    # Scale up ~1.7x to 116x119 and blit into center
    for y in range(120):
        sy = int(y / 1.7)
        if sy < 70:
            for x in range(116):
                sx = int(x / 1.7)
                if sx < 68:
                    s_idx = (sy * 68 + sx) * 4
                    if head_crop[s_idx+3] > 10:
                        dx = 6 + x
                        dy = 4 + y
                        d_idx = (dy * 128 + dx) * 4
                        portrait_ren[d_idx:d_idx+4] = head_crop[s_idx:s_idx+4]
    save_png('assets/sprites/portrait_ren.png', 128, 128, portrait_ren)

    # 5. Generate Elder Spirit NPC Portrait (Mystical white fox elder with blue markings)
    portrait_elder = bytearray(128 * 128 * 4)
    # Color shift Ren's hair to mystical silver/white and green sweater to shrine maiden indigo/red
    for i in range(0, len(portrait_ren), 4):
        r, g, b, a = portrait_ren[i:i+4]
        if a > 0:
            # Check if orange hair
            if r > 120 and g > 50 and b < 60:
                # shift to silver-white fox hair
                gray = int((r + g + b) / 3 * 1.3)
                portrait_elder[i] = min(255, gray + 20)
                portrait_elder[i+1] = min(255, gray + 25)
                portrait_elder[i+2] = min(255, gray + 45)
                portrait_elder[i+3] = a
            # Check if green sweater
            elif g > r and g > b:
                # shift to shrine maiden sacred scarlet
                portrait_elder[i] = 200
                portrait_elder[i+1] = 40
                portrait_elder[i+2] = 50
                portrait_elder[i+3] = a
            else:
                portrait_elder[i:i+4] = portrait_ren[i:i+4]
    save_png('assets/sprites/portrait_elder.png', 128, 128, portrait_elder)

    # 6. Generate Enemy Sprite: Corrupted Shadow Hound (64x64, 4 frames walk/run = 256x64)
    hound_sheet = bytearray(256 * 64 * 4)
    for f in range(4):
        cx = f * 64 + 32
        cy = 40
        # Draw dark beast body
        for y in range(64):
            for x in range(64):
                px = f * 64 + x
                idx = (y * 256 + px) * 4
                # Beast torso and head
                dx = x - 32
                dy = y - 36 + int(math.sin(f * math.pi / 2) * 3)
                # Ellipse body
                in_body = (dx**2 / 18**2 + dy**2 / 10**2) <= 1.0
                # Head
                hx = x - 46
                hy = y - 28 + int(math.sin(f * math.pi / 2) * 2)
                in_head = (hx**2 / 9**2 + hy**2 / 8**2) <= 1.0
                # Snout
                snx = x - 54
                sny = y - 26
                in_snout = (snx**2 / 6**2 + sny**2 / 4**2) <= 1.0
                # Legs
                leg1 = abs(x - 24) < 3 and 38 < y < 58 + int(math.sin(f * 1.5) * 4)
                leg2 = abs(x - 40) < 3 and 38 < y < 58 - int(math.sin(f * 1.5) * 4)
                # Glowing violet/crimson eyes
                eye = (x == 49 or x == 50) and (y == 26 + int(math.sin(f * math.pi / 2) * 2))

                if eye:
                    hound_sheet[idx] = 255
                    hound_sheet[idx+1] = 50
                    hound_sheet[idx+2] = 100
                    hound_sheet[idx+3] = 255
                elif in_body or in_head or in_snout or leg1 or leg2:
                    # shadowy corrupted texture
                    hound_sheet[idx] = 35 + int(math.sin(x*0.5)*15)
                    hound_sheet[idx+1] = 20
                    hound_sheet[idx+2] = 55 + int(math.cos(y*0.5)*20)
                    hound_sheet[idx+3] = 245
    save_png('assets/sprites/enemy_shadow.png', 256, 64, hound_sheet)

    # 7. Generate Boss Sprite: Blight Kitsune Lord (160x160, 4 frames = 640x160)
    boss_sheet = bytearray(640 * 160 * 4)
    for f in range(4):
        for y in range(160):
            for x in range(160):
                px = f * 160 + x
                idx = (y * 640 + px) * 4
                bob = int(math.sin(f * math.pi / 2) * 4)
                dx = x - 80
                dy = y - 90 + bob
                # Massive spectral body
                in_body = (dx**2 / 40**2 + dy**2 / 28**2) <= 1.0
                # 3 Spectral Tails
                in_tail = False
                for t in [-40, -15, 10]:
                    tdx = x - (35 + t//2)
                    tdy = y - (70 + t + int(math.sin(f + t)*8))
                    if (tdx**2 / 16**2 + tdy**2 / 40**2) <= 1.0:
                        in_tail = True
                # Horns / Ears
                ear1 = abs(x - 95) < 8 and 30 < y - bob < 65
                ear2 = abs(x - 75) < 8 and 30 < y - bob < 65
                # Glowing core
                core = (dx**2 + dy**2) < 14**2
                # Boss eyes
                b_eye = (x in (95, 96, 97)) and (y == 72 + bob)

                if b_eye:
                    boss_sheet[idx] = 255
                    boss_sheet[idx+1] = 230
                    boss_sheet[idx+2] = 60
                    boss_sheet[idx+3] = 255
                elif core:
                    boss_sheet[idx] = 200
                    boss_sheet[idx+1] = 40
                    boss_sheet[idx+2] = 255
                    boss_sheet[idx+3] = 255
                elif in_body or in_tail or ear1 or ear2:
                    boss_sheet[idx] = 45 + int(math.sin(x*0.2)*20)
                    boss_sheet[idx+1] = 18
                    boss_sheet[idx+2] = 75 + int(math.cos(y*0.2)*25)
                    boss_sheet[idx+3] = 230
    save_png('assets/sprites/enemy_boss.png', 640, 160, boss_sheet)

    print("All game assets generated successfully!")

if __name__ == '__main__':
    main()
