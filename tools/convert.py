"""
frames_*.json (render_frames.js 결과) → img/<key>/NN.webp 변환
사용: python convert.py <frames_*.json이 있는 폴더> <출력 img 폴더>
필요: pip install pillow numpy
"""
import json, base64, os, sys, glob, io
from PIL import Image
import numpy as np

src_dir, out_dir = sys.argv[1], sys.argv[2]
BG = np.array([241, 244, 239])
files = sorted(glob.glob(os.path.join(src_dir, 'frames_*.json')))
assert files, 'frames_*.json 없음'

# 1) 전체 프레임 디코딩 + 공통 크롭 박스 계산
sets = {}
x0, y0, x1, y1 = 9999, 9999, 0, 0
for p in files:
    d = json.load(open(p, encoding='utf-8'))
    imgs = []
    for b in d['frames']:
        im = Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB')
        imgs.append(im)
        a = np.asarray(im).astype(int)
        diff = np.abs(a - BG).sum(2)
        sat = a.max(2) - a.min(2)
        m = (diff > 60) | (sat > 40)   # 그림자(연회색)는 제외
        ys, xs = np.where(m)
        if len(xs):
            x0, x1 = min(x0, xs.min()), max(x1, xs.max())
            y0, y1 = min(y0, ys.min()), max(y1, ys.max())
    sets[d['key']] = imgs
W, H = imgs[0].size
cw = min(W, int((x1 - x0) * 1.08)); ch = int(cw * 0.75)
if ch > H: ch = H; cw = int(ch / 0.75)
cx = (x0 + x1) // 2
cy = y1 - ch // 2 + int(ch * 0.06)
left = max(0, min(W - cw, cx - cw // 2)); top = max(0, min(H - ch, cy - ch // 2))

# 2) 크롭 + WebP 저장
tot = 0
for key, imgs in sets.items():
    d = os.path.join(out_dir, key); os.makedirs(d, exist_ok=True)
    for i, im in enumerate(imgs):
        out = im.crop((left, top, left + cw, top + ch)).resize((1200, 900), Image.LANCZOS)
        fp = os.path.join(d, f'{i:02d}.webp'); out.save(fp, 'WEBP', quality=82, method=6); tot += os.path.getsize(fp)
print(f'{len(sets)} sets, {sum(len(v) for v in sets.values())} frames, {tot/1e6:.1f} MB')
