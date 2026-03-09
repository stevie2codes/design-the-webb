"""Apply heavy geometric block distortion to portrait image."""
import random
from PIL import Image

random.seed(99)

img = Image.open("public/stephen-portrait-original.jpg")
w, h = img.size
result = img.copy()

# Define the face region (roughly center of the image)
face_cx, face_cy = w * 0.48, h * 0.38
face_radius_x, face_radius_y = w * 0.28, h * 0.35

# Block parameters — bigger, more, bolder
block_sizes = [(100, 80), (150, 100), (80, 130), (130, 60), (90, 90), (170, 70), (60, 150), (110, 110), (200, 50), (50, 180)]
num_blocks = 24
max_offset = 45

for i in range(num_blocks):
    bw, bh = random.choice(block_sizes)

    # Place blocks around and across the face area
    spread = random.uniform(0.2, 1.3)
    cx = int(face_cx + spread * face_radius_x * (random.uniform(-1, 1)))
    cy = int(face_cy + spread * face_radius_y * (random.uniform(-1, 1)))

    x1 = max(0, cx - bw // 2)
    y1 = max(0, cy - bh // 2)
    x2 = min(w, x1 + bw)
    y2 = min(h, y1 + bh)

    if x2 - x1 < 20 or y2 - y1 < 20:
        continue

    block = img.crop((x1, y1, x2, y2))

    # Offset — more dramatic across the board
    ox = random.randint(-max_offset, max_offset)
    oy = random.randint(-max_offset, max_offset)

    # 40% chance of very dramatic offset
    if random.random() < 0.4:
        ox = random.randint(-80, 80)
        oy = random.randint(-80, 80)

    nx = max(0, min(w - (x2 - x1), x1 + ox))
    ny = max(0, min(h - (y2 - y1), y1 + oy))

    result.paste(block, (nx, ny))

# More horizontal slice shifts, wider offsets
for _ in range(12):
    sy = random.randint(int(face_cy - face_radius_y * 1.2), int(face_cy + face_radius_y * 1.2))
    sh = random.randint(4, 18)
    sx_offset = random.choice([-40, -30, -20, -15, 15, 20, 30, 40, 50])

    if 0 <= sy < h and sy + sh < h:
        strip = img.crop((0, sy, w, sy + sh))
        shifted = Image.new("RGB", (w, sh), (250, 249, 245))
        if sx_offset >= 0:
            shifted.paste(strip.crop((0, 0, w - sx_offset, sh)), (sx_offset, 0))
        else:
            shifted.paste(strip.crop((-sx_offset, 0, w, sh)), (0, 0))
        result.paste(shifted, (0, sy))

result.save("public/stephen-portrait.jpg", quality=92)
print(f"Done — distorted {num_blocks} blocks + 12 glitch slices")
