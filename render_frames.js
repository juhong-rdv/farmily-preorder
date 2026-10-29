/* FARMILY S300 사전계약용 턴테이블 렌더링 스크립트 (v5.2: UV와 통일 카메라 2000x1500/fov35/dist5.0)
 * 사용법: 크롬에서 http://lab.farmily.ai:8090/s300/ 접속 → F5 → F12 → Console → 이 파일 전체 붙여넣기 → Enter
 * 결과: frames_<팔레트>-<on|off>.json 8개가 다운로드 폴더에 저장됨 (각 36장)
 *   팔레트: original(원본) / forest(포레스트) / graphite(그래파이트) / sand(샌드)
 *   on = 라이다 3개(정면 중앙 + 좌·우 측면) + 레이저선·스캔면 표시 / off = 라이다 없음
 */
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const setChk = (el, v) => { if (el.checked !== v) { el.checked = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } };

  // 1) 뷰어 모듈을 패치해 renderer/camera/scene을 노출
  console.log('[1/4] 뷰어 준비');
  let src = await fetch('/s300/viewer.js?v=v10-side-height-1').then(r => r.text());
  src = src.replace(/from\s+(['"])\.\//g, 'from $1' + location.origin + '/s300/');
  src = src.replace(/import\s*\(\s*(['"])\.\//g, 'import($1' + location.origin + '/s300/');
  src = src.replace("controls.addEventListener('change',render);", "controls.addEventListener('change',render); window.__v={renderer,camera,controls,scene,render,frame,THREE, get model(){return model;}};");
  document.querySelectorAll('#viewport canvas').forEach(c => c.remove());
  await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  for (let i = 0; i < 100 && !(window.__v && window.__v.model); i++) await sleep(200);
  const V = window.__v, T = V.THREE;
  if (!V || !V.model) { alert('뷰어 로드 실패 — 페이지를 새로고침하고 다시 시도하세요'); return; }

  // 2) 디자인 버전 V5
  for (let i = 0; i < 5; i++) {
    document.querySelector('[data-version="v5"]').click();
    await sleep(1200);
    const pressed = document.querySelector('#versionChoices button[aria-pressed="true"]')?.dataset.version;
    console.log('[2/4] 디자인 버전:', pressed);
    if (pressed === 'v5') break;
  }

  // 3) 설정
  const PALETTES = ['original', 'forest', 'graphite', 'sand'];
  const LIDAR_ON = ['option-lidar-front', 'option-lidar', 'option-lidar-left'];   // 정면 중앙 + 우측 + 좌측
  const LIDAR_ALL = ['option-lidar-front', 'option-lidar-front2', 'option-lidar', 'option-lidar-left'];
  // 측면 라이다 장착 높이(mm): 하향 45°에서 8인치 바퀴(상단 203mm)에 빔이 걸리지 않는 최저치 ≈ 375mm → 여유 두고 390
  const SIDE_LIDAR_HEIGHT = 390;
  async function lidar(on) {
    $('sensorsTab').click(); await sleep(200);
    for (const id of LIDAR_ALL) {
      setVal($('lidarTarget'), id); await sleep(120);
      $('lidarReset').click(); await sleep(150);          // 각도·오프셋은 lab 기본값
      const use = on && LIDAR_ON.includes(id);
      if (id === 'option-lidar' || id === 'option-lidar-left') { setVal($('lidarHeight'), String(SIDE_LIDAR_HEIGHT)); await sleep(150); }
      setChk($('lidarEnabled'), use);
      setChk($('lidarSideCoverEnabled'), use && id !== 'option-lidar-front');
      setChk($('lidarBeams'), use); setChk($('lidarPlane'), use);
    }
    $('coversTab').click(); await sleep(150);
  }
  // 알루미늄 프로파일(3060/3030)과 보조 롤러 지지대는 검정 프로파일로 고정
  const PROFILE_RE = /\b3060[_xX]|\b3030[xX]|E_3030|Support_Roller_bracket|보조 롤러/;
  const PROFILE_HEX = '#1a1a1a';
  const profileMeshes = [];
  V.scene.traverse(m => { if (m.isMesh && PROFILE_RE.test(m.userData.label || m.name || '')) profileMeshes.push(m); });
  function fixProfile() {
    for (const m of profileMeshes) {
      if (Array.isArray(m.material)) continue;
      m.material = m.material.clone(); m.material.color.set(PROFILE_HEX);
      if ('metalness' in m.material) { m.material.metalness = 0.4; m.material.roughness = 0.5; }
      m.material.needsUpdate = true;
    }
  }
  // 물통은 흰색 고정(도장 불가): 팔레트가 바꾸는 메쉬 중 '비녹색(밝은색)' 부품 = 물통 → 원래 재질로 되돌림
  const origMat = new Map();
  let tankMeshes = null;
  function hsl(c) { const o = {}; c.getHSL(o); return o; }
  async function detectTank() {
    document.querySelector('[data-palette="original"]').click(); await sleep(400);
    V.scene.traverse(m => { if (m.isMesh && !Array.isArray(m.material)) origMat.set(m, m.material.clone()); });   // 원본 팔레트 상태의 재질 보관
    const before = new Map(); V.scene.traverse(m => { if (m.isMesh && !Array.isArray(m.material)) before.set(m, m.material.color.getHex()); });
    document.querySelector('[data-palette="sand"]').click(); await sleep(400);
    tankMeshes = [];
    V.scene.traverse(m => {
      if (!m.isMesh || Array.isArray(m.material) || !before.has(m)) return;
      const o = origMat.get(m); if (!o || !o.color) return;
      const h = hsl(o.color);
      if (before.get(m) !== m.material.color.getHex() && h.l > 0.55 && h.s < 0.25) tankMeshes.push(m);   // 바뀌었고 원래 밝은 무채색 → 물통
    });
    console.log('[3/4] 물통(흰색 고정) 메쉬:', tankMeshes.length);
  }
  function fixTank() { for (const m of tankMeshes || []) { m.material = origMat.get(m).clone(); m.material.needsUpdate = true; } }
  async function palette(id) {
    if (!tankMeshes) await detectTank();
    document.querySelector(`[data-palette="${id}"]`).click(); await sleep(400);
    fixProfile(); fixTank();
  }
  // 순수 V5 구성: 다른 버전의 추가 외장(V4/V6/V7/V8/V10)은 저장된 옵션과 무관하게 숨김
  const OFF_GROUPS = /V4 drive enclosure|V6 |V7 |V8 |V10 |하부 라운드 외장/;
  function pureV5() {
    V.scene.children.forEach(o => { if (o.type === 'Group' && o.name) o.visible = !OFF_GROUPS.test(o.name); });
    V.scene.traverse(o => { if (o.type === 'GridHelper') o.visible = false; });
  }
  const box = new T.Box3().setFromObject(V.model), center = box.getCenter(new T.Vector3());

  // 3-1) 바닥(그라데이션) + 접지 그림자 — 사전계약 페이지에서 로봇이 떠 보이지 않도록
  {
    const r = V.renderer;
    r.shadowMap.enabled = true; if (T.PCFSoftShadowMap !== undefined) r.shadowMap.type = T.PCFSoftShadowMap;
    V.model.traverse(o => { if (o.isMesh && !/lidar|LiDAR/.test(o.name || '')) o.castShadow = true; });
    const floorY = box.min.y;
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
    const grd = g.createRadialGradient(512, 512, 0, 512, 512, 512);
    grd.addColorStop(0, '#e9ebe6'); grd.addColorStop(0.45, '#eff1ec'); grd.addColorStop(1, '#f2f5f1');   // 은은한 바닥 그라데이션(띠처럼 보이지 않게), 가장자리는 배경색과 동일
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
    const tex = new T.CanvasTexture(c);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace; else if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
    const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, floorY - 0.002, center.z); floor.name = '__floor'; V.scene.add(floor);
    const shadow = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.26 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(center.x, floorY - 0.001, center.z); shadow.receiveShadow = true; shadow.name = '__shadow'; V.scene.add(shadow);
    const sun = new T.DirectionalLight(0xffffff, 0.001);   // 조명은 거의 0 — 그림자만 사용
    sun.position.set(center.x + 1.2, box.max.y + 6, center.z + 2.0); sun.target.position.copy(center); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 0.1; sc.far = 25; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
    V.scene.add(sun); V.scene.add(sun.target);
    // lab 뷰어 자체 조명의 그림자는 끔 (그림자가 2개 생기는 문제) — 그림자는 위 sun 하나만
    V.scene.traverse(o => { if (o.isLight && o !== sun && o.castShadow) { o.castShadow = false; console.log('  기존 조명 그림자 끔:', o.type, o.name || ''); } });
    V.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    console.log('[3/4] 바닥·그림자 추가, floorY =', floorY.toFixed(3));
  }
  // 통일 카메라 (UV render_uv.js와 동일): 2000x1500, fov 35, dist 5.0, look floorY+1.0, elev 14 → S300·UV 스케일/배경 일치
  const W = 2000, H = 1500;
  function shoot(angleDeg, elevDeg = 14) {
    const r = V.renderer, cam = V.camera;
    const prevSize = new T.Vector2(); r.getSize(prevSize); const prevPR = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(W, H, false); cam.aspect = W / H; cam.fov = 35;
    const look = new T.Vector3(center.x, box.min.y + 1.0, center.z);
    const dist = 5.0;
    const a = T.MathUtils.degToRad(angleDeg), e = T.MathUtils.degToRad(elevDeg);
    cam.position.set(look.x + dist * Math.cos(e) * Math.sin(a), look.y + dist * Math.sin(e), look.z + dist * Math.cos(e) * Math.cos(a));
    cam.lookAt(look); cam.updateProjectionMatrix();
    V.render();
    const data = r.domElement.toDataURL('image/jpeg', 0.9);
    r.setPixelRatio(prevPR); r.setSize(prevSize.x, prevSize.y, false); cam.aspect = prevSize.x / prevSize.y; cam.updateProjectionMatrix(); V.controls.update(); V.render();
    return data;
  }
  function download(name, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // 4) 4팔레트 × 라이다 on/off × 36각도
  let n = 0;
  for (const on of [false, true]) {
    await lidar(on);
    for (const pid of PALETTES) {
      await palette(pid); pureV5();
      const key = `${pid}-${on ? 'on' : 'off'}`;
      const frames = [];
      for (let i = 0; i < 36; i++) frames.push(shoot(i * 10 + 35).split(',')[1]);
      download(`frames_${key}.json`, JSON.stringify({ key, w: W, h: H, frames }));
      n++; console.log(`[${n}/8] ${key} 저장`);
      await sleep(600);
    }
  }
  console.log('완료 — 다운로드 폴더에 frames_*.json 8개 확인');
  alert('렌더링 완료: frames_*.json 8개가 다운로드되었습니다.');
})();
