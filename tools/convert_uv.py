"""frames_uv-*.json (render_uv.js 결과) → img/<key>/NN.webp
S300 세트와 동일한 카메라(1600x1000, fov36, dist5.2, look 0.95, elev14)로 렌더한 뒤
S300과 같은 고정 크롭(tools/s300_crop.json: 133,0,1333,1000)을 적용 → 두 모델의 스케일·배경·수평선이 일치.
사용: python convert_uv.py <frames_uv-*.json 폴더> <출력 img 폴더>"""
import json, base64, os, sys, glob, io
from PIL import Image
src_dir, out_dir = sys.argv[1], sys.argv[2]
crop = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 's300_crop.json')))
files = sorted(glob.glob(os.path.join(src_dir, 'frames_uv-*.json')))
assert files, 'frames_uv-*.json 없음'
tot = 0
for p in files:
    d = json.load(open(p, encoding='utf-8'))
    assert d['w'] == crop['W'] and d['h'] == crop['H'], f"프레임 크기 {d['w']}x{d['h']} != {crop['W']}x{crop['H']} (render_uv.js 설정 확인)"
    od = os.path.join(out_dir, d['key']); os.makedirs(od, exist_ok=True)
    for i, b in enumerate(d['frames']):
        im = Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB')
        out = im.crop((crop['left'], crop['top'], crop['left'] + crop['cw'], crop['top'] + crop['ch'])).resize((1200, 900), Image.LANCZOS)
        fp = os.path.join(od, f'{i:02d}.webp'); out.save(fp, 'WEBP', quality=82, method=6); tot += os.path.getsize(fp)
    print(d['key'], len(d['frames']), 'frames')
print(f'{len(files)} sets, {tot/1e6:.1f} MB')
