"""frames_*.json (render_frames.js / render_uv.js, 통일 카메라 2000x1500) → img/<key>/NN.webp
크롭 없이 프레임 전체를 1200x900으로 축소 → S300·UV 모든 세트의 스케일·배경·수평선이 동일.
사용: python convert_unified.py <frames_*.json 폴더> <출력 img 폴더> [key ...]"""
import json, base64, os, sys, glob, io
from PIL import Image
src_dir, out_dir = sys.argv[1], sys.argv[2]; only = sys.argv[3:]
files = sorted(glob.glob(os.path.join(src_dir, 'frames_*.json')))
assert files, 'frames_*.json 없음'
tot = 0
for p in files:
    d = json.load(open(p, encoding='utf-8'))
    if only and d['key'] not in only: continue
    assert (d['w'], d['h']) == (2000, 1500), f"{p}: {d['w']}x{d['h']} (통일 카메라 2000x1500 아님)"
    od = os.path.join(out_dir, d['key']); os.makedirs(od, exist_ok=True)
    for i, b in enumerate(d['frames']):
        im = Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB').resize((1200, 900), Image.LANCZOS)
        fp = os.path.join(od, f'{i:02d}.webp'); im.save(fp, 'WEBP', quality=82, method=6); tot += os.path.getsize(fp)
    print(d['key'], len(d['frames']), 'frames')
print(f'{tot/1e6:.1f} MB')
