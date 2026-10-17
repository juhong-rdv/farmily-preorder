import { CONFIG } from './config.js?v=9';

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

async function draw() {
  const key = setKey();
  const img = await load(frameUrl(key, state.frame));
  if (!img) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // contain fit + zoom/pan
  const s = Math.min(W / img.naturalWidth, H / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (W - dw) / 2 + panX, (H - dh) / 2 + panY, dw, dh);
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
  $('sLidar').textContent = state.lidar ? `라이다 3개 · ${priceLabel(P.lidar)}` : '초음파 센서 6개 (기본)';
  $('sLte').textContent = state.lte ? `LTE 모듈 · ${priceLabel(P.lte)}` : '미포함 (기본)';
  $('sQty').textContent = `${state.qty}대`;
  $('sTotal').textContent = totalLabel;
  $('pbTotal').textContent = totalLabel;
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
