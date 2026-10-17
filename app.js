import { CONFIG } from './config.js?v=12';

/* ========== 상태 ========== */
const state = { color: CONFIG.colors[0].id, lidar: false, lte: false, qty: 1, frame: CONFIG.initialFrame ?? 0 };
const $ = (id) => document.getElementById(id);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const priceLabel = (p) => (p === null || p === undefined) ? '[가격 미정]' : (p === 0 ? '추가 비용 없음' : '+' + won(p));
const FRAMES = CONFIG.frames;             // 36
const setKey = () => `${state.color}-${state.lidar ? 'on' : 'off'}`;
const frameUrl = (key, i) => `${CONFIG.imageDir}/${key}/${String(i).padStart(2, '0')}.webp`;

/* ========== 턴테이블 뷰어 (이미지 시퀀스) ========== */
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const cache = new Map();                   // url -> HTMLImageElement
const loaded = new Set();                  // key -> fully loaded
let zoom = 1, panX = 0, panY = 0;
const IMG_BG = '#F2F5F1';                   // 렌더 이미지의 배경색 (lab 뷰어 배경)

function load(url) {
  if (cache.has(url)) return cache.get(url);
  const img = new Image(); img.decoding = 'async'; img.src = url;
  const p = new Promise((res) => { img.onload = () => res(img); img.onerror = () => res(null); });
  cache.set(url, p); return p;
}
async function preloadSet(key, onProgress) {
  // 현재 각도부터 양방향으로, 동시 6개씩 (요청 폭주 방지)
  const order = [];
  for (let d = 0; d < FRAMES; d++) { const f = (state.frame + (d % 2 ? -(d + 1) / 2 : d / 2) + FRAMES * 4) % FRAMES; if (!order.includes(f)) order.push(f); }
  let n = 0, idx = 0;
  async function worker() { while (idx < order.length) { const f = order[idx++]; await load(frameUrl(key, f)); n++; onProgress && onProgress(n / FRAMES); } }
  await Promise.all(Array.from({ length: 6 }, worker));
  loaded.add(key);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  draw();
}
new ResizeObserver(resize).observe($('stage'));

const FLOOR_Y = 0.875;                  // 이미지 높이 대비 바퀴 접지선 위치
async function draw() {
  const key = setKey();
  const img = await load(frameUrl(key, state.frame));
  if (!img) return;
  const W = canvas.width, H = canvas.height;
  ctx.globalCompositeOperation = 'source-over';
  // contain fit + zoom/pan
  const s = Math.min(W / img.naturalWidth, H / img.naturalHeight) * zoom;
  const dw = Math.round(img.naturalWidth * s), dh = Math.round(img.naturalHeight * s);
  const dx = Math.round((W - dw) / 2 + panX), dy = Math.round((H - dh) / 2 + panY);   // 정수 좌표: multiply 경계선 방지
  const fy = dy + dh * FLOOR_Y;                 // 바닥선(y)
  const cx = dx + dw / 2;                       // 로봇 중심(x)

  // 1) 스튜디오 배경: 벽(밝음) → 바닥선 → 바닥(점점 어두움)
  const h0 = Math.max(0, Math.min(1, fy / H));
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#ffffff'); wall.addColorStop(Math.max(0, h0 - 0.18), '#fafaf7'); wall.addColorStop(h0, '#eff0ec');
  wall.addColorStop(Math.min(1, h0 + 0.02), '#ebece8'); wall.addColorStop(1, '#d4d5cf');   // multiply(0.95) 후 목표색이 되도록 밝게 설정
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  // 바닥 하이라이트(로봇 주변이 살짝 밝게)
  const spot = ctx.createRadialGradient(cx, fy, 0, cx, fy, dw * 0.8);
  spot.addColorStop(0, 'rgba(255,255,255,.5)'); spot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spot; ctx.fillRect(0, fy, W, H - fy);
  // 2) 접지 그림자 (타원)
  ctx.save(); ctx.translate(cx, fy + dh * 0.01); ctx.scale(1, 0.14);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, dw * 0.36);
  sh.addColorStop(0, 'rgba(20,20,19,.42)'); sh.addColorStop(0.5, 'rgba(20,20,19,.16)'); sh.addColorStop(1, 'rgba(20,20,19,0)');
  ctx.fillStyle = sh; ctx.fillRect(-dw, -dw, dw * 2, dw * 2); ctx.restore();
  // 3) 로봇 이미지: multiply로 얹어 이미지의 흰 배경이 바닥에 녹아들게
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(img, dx, dy, dw, dh);
  // 이미지 밖 영역도 같은 배경색으로 multiply → 사각 경계 제거
  ctx.fillStyle = IMG_BG;
  if (dy > 0) ctx.fillRect(0, 0, W, dy);
  if (dy + dh < H) ctx.fillRect(0, dy + dh, W, H - dy - dh);
  if (dx > 0) ctx.fillRect(0, Math.max(0, dy), dx, Math.min(H, dy + dh) - Math.max(0, dy));
  if (dx + dw < W) ctx.fillRect(dx + dw, Math.max(0, dy), W - dx - dw, Math.min(H, dy + dh) - Math.max(0, dy));
  ctx.globalCompositeOperation = 'source-over';
}

// 드래그 회전
let dragging = false, lastX = 0, acc = 0, autoRotate = false, autoTimer = null;   // 자동 회전 끔: 마우스/터치 드래그·버튼으로만 회전
const PX_PER_FRAME = 14;
function setFrame(f) { state.frame = ((f % FRAMES) + FRAMES) % FRAMES; draw(); $('angle').textContent = `${state.frame * (360 / FRAMES)}°`; }
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; acc = 0; canvas.setPointerCapture(e.pointerId); stopAuto(); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  acc += e.clientX - lastX; lastX = e.clientX;
  while (Math.abs(acc) >= PX_PER_FRAME) { setFrame(state.frame + (acc > 0 ? 1 : -1)); acc -= Math.sign(acc) * PX_PER_FRAME; }
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(2.2, Math.max(1, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); if (zoom === 1) { panX = panY = 0; } draw(); }, { passive: false });
canvas.addEventListener('dblclick', () => { zoom = 1; panX = panY = 0; draw(); });
function startAuto() { stopAuto(); autoTimer = setInterval(() => setFrame(state.frame + 1), 120); }
function stopAuto() { autoRotate = false; if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
$('rotL').onclick = () => { stopAuto(); setFrame(state.frame - 3); };
$('rotR').onclick = () => { stopAuto(); setFrame(state.frame + 3); };

// 초기 로드: 기본 세트(36장)만. 다른 세트는 사용자가 해당 옵션을 고를 때 로드 (호스팅 요청 한도·초기 속도 고려)
(async () => {
  const lt = $('loadingText');
  await preloadSet(setKey(), (p) => { lt.textContent = `이미지 ${Math.round(p * 100)}%`; });
  $('loading').hidden = true; resize(); setFrame(state.frame); if (autoRotate) startAuto();
})();

async function switchSet() {
  const key = setKey();
  if (!loaded.has(key)) {
    // 현재 각도 한 장을 먼저 받아 바로 바꿔 보여주고, 나머지는 뒤에서 채움
    await load(frameUrl(key, state.frame)); draw();
    preloadSet(key);
    return;
  }
  draw();
}

/* ========== UI ========== */
function renderSwatches() {
  const wrap = $('swatches'); wrap.innerHTML = '';
  wrap.className = 'choice'; wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', '색상 조합');
  for (const c of CONFIG.colors) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card color-card'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    const sw = document.createElement('i'); sw.className = 'sw'; sw.style.background = `linear-gradient(135deg, ${c.body} 0 55%, ${c.tank} 55% 100%)`;
    const d = document.createElement('div');
    const t = document.createElement('b'); t.textContent = c.name;
    if (c.price === 0) { const s = document.createElement('small'); s.textContent = '기본'; t.appendChild(s); }
    const s2 = document.createElement('span'); s2.textContent = c.desc || '';
    d.append(t, s2);
    const em = document.createElement('em'); em.textContent = priceLabel(c.price);
    b.append(sw, d, em);
    b.onclick = () => { if (state.color !== c.id) { state.color = c.id; update(); switchSet(); } };
    wrap.appendChild(b);
  }
}

function update() {
  const col = CONFIG.colors.find((c) => c.id === state.color);
  const P = CONFIG.prices;
  [...document.querySelectorAll('.color-card')].forEach((b, i) => b.setAttribute('aria-checked', String(CONFIG.colors[i].id === state.color)));
  $('colorLabel').textContent = `${col.name} · ${priceLabel(col.price)}`;
  $('optLidar').setAttribute('aria-checked', String(state.lidar));
  $('optUltra').setAttribute('aria-checked', String(!state.lidar));
  $('optLte').setAttribute('aria-pressed', String(state.lte));
  document.querySelector('[data-price="lidar"]').textContent = priceLabel(P.lidar);
  document.querySelector('[data-price="lte"]').textContent = priceLabel(P.lte);
  $('qtyVal').textContent = state.qty;

  const unit = (P.body ?? 0) + (col.price ?? 0) + (state.lidar ? (P.lidar ?? 0) : 0) + (state.lte ? (P.lte ?? 0) : 0);
  const known = P.body !== null && P.body !== undefined;
  const totalLabel = known ? won(unit * state.qty) : `[가격 미정] × ${state.qty}대`;

  $('sBody').textContent = `S300 · ${P.body != null ? won(P.body) : '[가격 미정]'}`;
  $('sColor').textContent = `${col.name} · ${priceLabel(col.price)}`;
  $('sLidar').textContent = state.lidar ? `라이다 3개 · ${priceLabel(P.lidar)}` : '초음파 센서 6개 · 추가 비용 없음';
  $('sLte').textContent = state.lte ? `LTE 모듈 · ${priceLabel(P.lte)}` : '미포함 (기본)';
  $('sQty').textContent = `${state.qty}대`;
  const disc = (CONFIG.eventDiscount ?? 1500000) * state.qty;
  $('sCash').textContent = `−${won(disc)}`;
  $('sTotal').textContent = totalLabel;
  const finalTotal = Math.max(0, unit * state.qty - disc);
  $('sFinal').textContent = known ? won(finalTotal) : '[가격 미정]';
  $('sBalance').textContent = known ? won(Math.max(0, finalTotal - CONFIG.deposit)) : '[가격 미정]';
  $('pbTotal').textContent = known ? won(finalTotal) + ' (할인 적용)' : totalLabel;
  $('pbSummary').textContent = `S300 · ${col.name}${state.lidar ? ' · 라이다' : ''}${state.lte ? ' · LTE' : ''} · ${state.qty}대`;
  const chips = ['S300', col.name, state.lidar ? '라이다 센서 3' : '초음파 센서 6', ...(state.lte ? ['LTE'] : []), `${state.qty}대`];
  $('chips').innerHTML = chips.map((c) => `<span>${c}</span>`).join('');
}

$('optLidar').onclick = () => { if (!state.lidar) { state.lidar = true; update(); switchSet(); } };
$('optUltra').onclick = () => { if (state.lidar) { state.lidar = false; update(); switchSet(); } };
$('optLte').onclick = () => { state.lte = !state.lte; update(); };
$('qtyUp').onclick = () => { state.qty = Math.min(10, state.qty + 1); update(); };
$('qtyDown').onclick = () => { state.qty = Math.max(1, state.qty - 1); update(); };

/* ========== 페이플 결제 ========== */
$('payBtn').onclick = () => {
  const name = $('fName').value.trim();
  const hp = $('fHp').value.replace(/[^0-9]/g, '');
  const email = $('fEmail').value.trim();
  const memo = $('fMemo').value.trim();
  if (!name || !hp || !email) { alert('성함, 휴대전화, 이메일을 모두 입력해 주세요.'); return; }
  if (!/^01[0-9]{8,9}$/.test(hp)) { alert('휴대전화 번호를 확인해 주세요.'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert('이메일 주소를 확인해 주세요.'); return; }
  if (!$('fAgree').checked) { alert('약관 및 개인정보 수집·이용에 동의해 주세요.'); return; }
  if (typeof PaypleCpayAuthCheck !== 'function') { alert('결제 모듈을 불러오지 못했습니다. 새로고침해 주세요.'); return; }

  const col = CONFIG.colors.find((c) => c.id === state.color);
  const spec = `S300/${col.name}${state.lidar ? '/라이다' : ''}${state.lte ? '/LTE' : ''}/${state.qty}대${memo ? '/' + memo : ''}`;
  const oid = 'PRE' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + Math.random().toString(36).slice(2, 7).toUpperCase();

  PaypleCpayAuthCheck({
    clientKey: CONFIG.payple.clientKey,
    PCD_PAY_TYPE: 'card',
    PCD_PAY_WORK: 'PAY',
    PCD_CARD_VER: '02',
    PCD_PAY_GOODS: ('FARMILY-X 사전계약금 ' + spec).slice(0, 100),
    PCD_PAY_TOTAL: CONFIG.deposit,
    PCD_PAY_OID: oid,
    PCD_PAYER_NAME: name,
    PCD_PAYER_HP: hp,
    PCD_PAYER_EMAIL: email,
    PCD_PAYER_NO: spec.slice(0, 50),
    PCD_PAY_ISTAX: 'Y',
    PCD_RST_URL: location.pathname,
    callbackFunction: (res) => {
      if (res && res.PCD_PAY_RST === 'success') {
        location.href = `complete.html?oid=${encodeURIComponent(res.PCD_PAY_OID || oid)}&name=${encodeURIComponent(name)}&spec=${encodeURIComponent(spec)}`;
      } else {
        alert('결제가 완료되지 않았습니다.\n' + (res && res.PCD_PAY_MSG ? res.PCD_PAY_MSG : ''));
      }
    }
  });
};

renderSwatches();
update();
