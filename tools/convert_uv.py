"""frames_uv-*.json (render_uv.js 결과) → img/<key>/NN.webp
convert.py와 같지만 세로로 긴 UV(리프트 상승 포함)에 맞춰 높이 기준으로 4:3 크롭.
사용: python convert_uv.py <frames_uv-*.json 폴더> <출력 img 폴더>"""
import json, base64, os, sys, glob, io
from PIL import Image
import numpy as np
src_dir, out_dir = sys.argv[1], sys.argv[2]
BG = np.array([241, 244, 239])
files = sorted(glob.glob(os.path.join(src_dir, 'frames_uv-*.json')))
assert files, 'frames_uv-*.json 없음'
sets = {}
x0, y0, x1, y1 = 9999, 9999, 0, 0
for p in files:
    d = json.load(open(p, encoding='utf-8'))
    imgs = []
    for b in d['frames']:
        im = Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB')
        imgs.append(im)
        a = np.asarray(im).astype(int)
        diff = np.abs(a - BG).sum(2); sat = a.max(2) - a.min(2)
        m = (a.sum(2) < 420) | (sat > 40)   # 어두운 부품 또는 유채색만 (연회색 그림자·바닥 제외)
        ys, xs = np.where(m)
        if len(xs):
            x0, x1 = min(x0, xs.min()), max(x1, xs.max()); y0, y1 = min(y0, ys.min()), max(y1, ys.max())
    sets[d['key']] = imgs
W, H = imgs[0].size
cw = int((x1 - x0) * 1.12); ch = int((y1 - y0) * 1.10)
if ch < cw * 0.75: ch = int(cw * 0.75)
else: cw = int(ch / 0.75)
if cw > W or ch > H:   # 프레임보다 크면 프레임 전체(4:3 가정) 사용
    cw, ch = (W, int(W * 0.75)) if W * 0.75 <= H else (int(H / 0.75), H)
cx = (x0 + x1) // 2
cy = y1 - ch // 2 + int(ch * 0.06)
left = max(0, min(W - cw, cx - cw // 2)); top = max(0, min(H - ch, cy - ch // 2))
print('bbox', x0, y0, x1, y1, 'crop', left, top, cw, ch)
tot = 0
for key, imgs in sets.items():
    d = os.path.join(out_dir, key); os.makedirs(d, exist_ok=True)
    for i, im in enumerate(imgs):
        out = im.crop((left, top, left + cw, top + ch)).resize((1200, 900), Image.LANCZOS)
        fp = os.path.join(d, f'{i:02d}.webp'); out.save(fp, 'WEBP', quality=82, method=6); tot += os.path.getsize(fp)
print(f'{len(sets)} sets, {sum(len(v) for v in sets.values())} frames, {tot/1e6:.1f} MB')
