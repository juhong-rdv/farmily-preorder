"""index.html + style.css + app.js + config.js → 아임웹 '코드' 위젯에 통째로 붙여 넣는 단일 HTML 조각 생성
- CSS는 .fxp 안으로 범위를 좁혀 아임웹 테마와 충돌하지 않게 함
- 이미지는 36장 개별 파일 대신 6x6 스프라이트 시트(세트당 1장, 8장)를 사용 → 아임웹에 업로드한 URL을 SPRITES 에 넣으면 됨
- 결제 완료 화면은 별도 페이지 대신 위젯 안에서 표시
사용: python3 build_imweb.py <src_dir> <out.html> [sprite_base_url_or_map.json]
"""
import re, sys, json, os

src, out = sys.argv[1], sys.argv[2]
sprite_map = None
if len(sys.argv) > 3:
    a = sys.argv[3]
    sprite_map = json.load(open(a, encoding='utf-8')) if a.endswith('.json') else {k: a.rstrip('/') + '/' + k + '.webp' for k in ['original-off','original-on','forest-off','forest-on','graphite-off','graphite-on','sand-off','sand-on']}
R = lambda n: open(os.path.join(src, n), encoding='utf-8').read()
html, css, js, cfg = R('index.html'), R('style.css'), R('app.js'), R('config.js')

# ---------- HTML: <div class="app"> … </div> 본문만 ----------
m = re.search(r'<div class="app">.*?</div>\s*\n\s*<script type="module"', html, re.S)
body = m.group(0)[: m.group(0).rfind('<script')].strip()
body = body.replace('<div class="app">', '<div class="app">', 1)
# 결제 완료 화면 (위젯 안)
done = '''
<div class="done" id="done" hidden>
  <div class="done-box">
    <div class="check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
    <h2>사전계약이 완료되었습니다</h2>
    <p id="doneGreet">사전계약금 100,000원 결제가 확인되었습니다. 입력하신 이메일로 결제 영수증과 접수 내역을 보내드리며, 담당자가 영업일 기준 2일 이내에 연락드립니다.</p>
    <div class="done-info">
      <div><span>주문번호</span><b id="doneOid">-</b></div>
      <div><span>구성</span><b id="doneSpec">-</b></div>
      <div><span>결제 금액</span><b>100,000원</b></div>
    </div>
    <div class="done-steps">
      <div><i>01</i><span>담당자 연락 · 온실 구조 확인 및 사양 확정</span></div>
      <div><i>02</i><span>제작 일정 확정 후 잔금 결제 안내 메일 발송 (카드 결제 링크)</span></div>
      <div><i>03</i><span>순차 출고 · 현장 설치 및 운용 교육</span></div>
    </div>
    <p class="done-contact">문의: <a href="mailto:hello@farmily.ai">hello@farmily.ai</a> · 02-6953-4608</p>
  </div>
</div>'''
body = body[: body.rfind('</div>')] + done + '\n</div>'

# ---------- CSS: .fxp 범위로 ----------
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = css.replace(':root{', '.fxp{')
css = re.sub(r'html,body\{[^}]*\}\n?', '', css)
css = re.sub(r'^body\{[^}]*\}\n?', '', css, flags=re.M)
css = css.replace('.app{display:flex;height:100vh;height:100dvh;overflow:hidden}',
                  '.app{display:flex;height:calc(100vh - 120px);min-height:720px;max-height:1040px;overflow:hidden;border:1px solid var(--line-2);border-radius:16px;background:#fff;position:relative}')
css = css.replace('.paybar{position:fixed;left:0;right:0;bottom:0;', '.paybar{position:sticky;left:0;right:0;bottom:0;')
css = css.replace('.app{flex-direction:column;height:auto;overflow:visible}', '.app{flex-direction:column;height:auto;min-height:0;max-height:none;overflow:visible;border-radius:0;border:0}')
def scope(block):
    outp = []
    for rule in re.split(r'(?<=\})', block):
        rule = rule.strip()
        if not rule: continue
        sel, _, rest = rule.partition('{')
        sels = []
        for s in sel.split(','):
            s = s.strip()
            if not s: continue
            if s.startswith('.fxp') or s.startswith('@'): sels.append(s)
            elif s in ('*',): sels.append('.fxp *')
            else: sels.append('.fxp ' + s)
        outp.append(', '.join(sels) + '{' + rest)
    return '\n'.join(outp)
parts, pos = [], 0
for mm in re.finditer(r'@(media|keyframes)[^{]*\{', css):
    parts.append(scope(css[pos:mm.start()]))
    depth, i = 1, mm.end()
    while depth and i < len(css):
        depth += {'{': 1, '}': -1}.get(css[i], 0); i += 1
    inner = css[mm.end(): i - 1]
    parts.append(mm.group(0) + (inner if mm.group(1) == 'keyframes' else scope(inner)) + '}')
    pos = i
parts.append(scope(css[pos:]))
css = '\n'.join(parts)
css = css.replace('.fxp .fxp{', '.fxp{')
css += '''
.fxp{font-family:'Noto Sans KR',system-ui,sans-serif;color:#141413;-webkit-font-smoothing:antialiased;line-height:1.4}
.fxp button,.fxp input{font-family:inherit}
.fxp .done{position:absolute;inset:0;background:#F4F4F2;display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.fxp .done[hidden]{display:none}
.fxp .done-box{background:#fff;border-radius:16px;padding:40px 36px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:18px;box-shadow:0 8px 30px rgba(0,0,0,.06)}
.fxp .done .check{width:56px;height:56px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center}
.fxp .done h2{margin:0;font-size:26px;font-weight:900}
.fxp .done p{margin:0;font-size:14px;color:var(--ink-2);line-height:1.7}
.fxp .done-info{border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;font-size:14px;background:#FAFAF8}
.fxp .done-info div{display:flex;justify-content:space-between;gap:12px}
.fxp .done-info span{color:var(--ink-2)}
.fxp .done-info b{font-weight:500;text-align:right;word-break:break-all}
.fxp .done-steps{display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--ink-2);line-height:1.6}
.fxp .done-steps div{display:flex;gap:10px}
.fxp .done-steps i{font-style:normal;font-weight:700;color:var(--green);flex:0 0 22px}
'''

# ---------- JS: 모듈 → 즉시실행, 스프라이트 로딩, 위젯 내 완료 화면 ----------
cfg_body = cfg[cfg.index('export const CONFIG = ') + len('export const CONFIG = '):].strip().rstrip(';')
cfg_body = re.sub(r"\n  // 턴테이블 이미지:.*?\n  imageDir: 'img',\n  frames: 36,", "\n  frames: 36,", cfg_body, flags=re.S)
sprites = sprite_map or {k: '여기에_아임웹_이미지_URL_' + k for k in ['original-off','original-on','forest-off','forest-on','graphite-off','graphite-on','sand-off','sand-on']}
sprite_js = '  // 턴테이블 스프라이트 시트(6x6, 36장): 아임웹에 업로드한 이미지 주소\n  sprites: ' + json.dumps(sprites, ensure_ascii=False, indent=4).replace('\n', '\n  ') + ',\n  spriteCols: 6, spriteW: 900, spriteH: 675,\n'
cfg_body = cfg_body.replace('\n  frames: 36,', '\n  frames: 36,\n' + sprite_js, 1)

js = js.replace("import { CONFIG } from './config.js?v=15';", 'const CONFIG = ' + cfg_body + ';')
js = js.replace("const $ = (id) => document.getElementById(id);", "const ROOT = document.currentScript ? document.currentScript.closest('.fxp') || document.querySelector('.fxp') : document.querySelector('.fxp');\nconst $ = (id) => ROOT.querySelector('#' + id);")
js = js.replace("document.querySelectorAll('.color-card')", "ROOT.querySelectorAll('.color-card')")
js = js.replace("document.querySelector('[data-price=\"lidar\"]')", "ROOT.querySelector('[data-price=\"lidar\"]')")
js = js.replace("document.querySelector('[data-price=\"lte\"]')", "ROOT.querySelector('[data-price=\"lte\"]')")
js = js.replace("const root = document.documentElement.style;", "const root = ROOT.style;")
# 이미지 로딩: 스프라이트
old = js[js.index('const frameUrl = '): js.index('function resize()')]
new = '''const SHEET = { cols: CONFIG.spriteCols, w: CONFIG.spriteW, h: CONFIG.spriteH };

/* ========== 턴테이블 뷰어 (스프라이트 시트) ========== */
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const sheets = new Map();                  // key -> Promise<HTMLImageElement|null>
let zoom = 1, panX = 0, panY = 0;
const IMG_BG = '#F2F5F1';                   // 렌더 이미지의 배경색

function loadSheet(key) {
  if (sheets.has(key)) return sheets.get(key);
  const img = new Image(); img.decoding = 'async'; img.src = CONFIG.sprites[key];
  const p = new Promise((res) => { img.onload = () => res(img); img.onerror = () => res(null); });
  sheets.set(key, p); return p;
}

'''
js = js.replace(old, new)
old_draw = js[js.index('async function draw() {'): js.index('// 드래그 회전')]
new_draw = '''async function draw() {
  const key = setKey();
  const img = await loadSheet(key);
  if (!img || key !== setKey()) return;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = IMG_BG; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / SHEET.w, H / SHEET.h) * zoom;
  const dw = Math.round(SHEET.w * s), dh = Math.round(SHEET.h * s);
  const dx = Math.round((W - dw) / 2 + panX), dy = Math.round((H - dh) / 2 + panY);
  const sx = (state.frame % SHEET.cols) * SHEET.w, sy = Math.floor(state.frame / SHEET.cols) * SHEET.h;
  ctx.drawImage(img, sx, sy, SHEET.w, SHEET.h, dx, dy, dw, dh);
}

'''
js = js.replace(old_draw, new_draw)
old_init = js[js.index('// 초기 로드:'): js.index('/* ========== UI ==========')]
new_init = '''// 초기 로드: 기본 세트 1장(스프라이트)만. 다른 세트는 해당 옵션을 고를 때 로드
(async () => {
  const lt = $('loadingText'); lt.textContent = '이미지 불러오는 중…';
  const img = await loadSheet(setKey());
  if (!img) { lt.textContent = '이미지를 불러오지 못했습니다.'; return; }
  $('loading').hidden = true; resize(); setFrame(state.frame);
})();

async function switchSet() {
  const key = setKey();
  if (!sheets.has(key)) { $('loading').hidden = false; $('loadingText').textContent = '이미지 불러오는 중…'; }
  await loadSheet(key);
  $('loading').hidden = true;
  draw();
}

'''
js = js.replace(old_init, new_init)
js = js.replace("PCD_RST_URL: location.pathname,", "PCD_RST_URL: location.href.split('#')[0],")
js = js.replace("        location.href = `complete.html?oid=${encodeURIComponent(res.PCD_PAY_OID || oid)}&name=${encodeURIComponent(name)}&spec=${encodeURIComponent(spec)}`;",
                "        showDone(res.PCD_PAY_OID || oid, name, spec);")
js += '''
/* ========== 결제 완료 화면 (위젯 안) ========== */
function showDone(oid, name, spec) {
  $('doneOid').textContent = oid;
  $('doneSpec').textContent = spec.replace(/\\//g, ' · ');
  if (name) $('doneGreet').textContent = `${name} 님, ` + $('doneGreet').textContent;
  $('done').hidden = false;
  ROOT.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
'''
js = '(function(){\n"use strict";\n' + js + '\n})();'

out_html = f'''<!-- FARMILY-X S300 사전계약 · 아임웹 코드 위젯용 (한 덩어리로 붙여 넣기) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<script src="https://cpay.payple.kr/js/v1/payment.js"></script>
<style>
{css}
</style>
<div class="fxp">
{body}
</div>
<script>
{js}
</script>
'''
open(out, 'w', encoding='utf-8').write(out_html)
print('written', out, len(out_html), 'bytes')
