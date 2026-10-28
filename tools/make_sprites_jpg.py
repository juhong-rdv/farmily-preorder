"""img/<key>/00..35.webp → <dst>/<key>-a.jpg, <key>-b.jpg (아임웹 삽입용 스프라이트: 세트당 2장, 각 2열x9행, 프레임 960x720)
a = 0~17번 프레임, b = 18~35번 프레임.  사용: python make_sprites_jpg.py <img 폴더> <출력 폴더> [key ...]"""
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; only = sys.argv[3:]
FW, FH, COLS, PER = 960, 720, 2, 18
os.makedirs(dst, exist_ok=True)
for key in sorted(os.listdir(src)):
    d = os.path.join(src, key)
    if not os.path.isdir(d) or (only and key not in only): continue
    for s, suffix in enumerate('ab'):
        sheet = Image.new('RGB', (FW * COLS, FH * (PER // COLS)), (242, 245, 241))
        for j in range(PER):
            i = s * PER + j
            im = Image.open(os.path.join(d, f'{i:02d}.webp')).convert('RGB').resize((FW, FH), Image.LANCZOS)
            sheet.paste(im, ((j % COLS) * FW, (j // COLS) * FH))
        fp = os.path.join(dst, f'{key}-{suffix}.jpg'); sheet.save(fp, 'JPEG', quality=86, optimize=True, progressive=True)
        print(fp, f'{os.path.getsize(fp)/1e6:.2f} MB')
