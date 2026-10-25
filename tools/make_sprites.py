"""img/<key>/00..35.webp → img_sprites/<key>.webp (6x6 스프라이트 시트, 프레임 900x675)
아임웹 삽입용: 세트당 이미지 1장씩 8장만 업로드하면 됨"""
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
FW, FH, COLS = 900, 675, 6
os.makedirs(dst, exist_ok=True)
for key in sorted(os.listdir(src)):
    d = os.path.join(src, key)
    if not os.path.isdir(d): continue
    sheet = Image.new('RGB', (FW * COLS, FH * 6), (242, 245, 241))
    for i in range(36):
        im = Image.open(os.path.join(d, f'{i:02d}.webp')).convert('RGB').resize((FW, FH), Image.LANCZOS)
        sheet.paste(im, ((i % COLS) * FW, (i // COLS) * FH))
    fp = os.path.join(dst, f'{key}.webp'); sheet.save(fp, 'WEBP', quality=82, method=6)
    print(key, f'{os.path.getsize(fp)/1e6:.2f} MB')
