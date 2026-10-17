/* FARMILY S300 사전계약용 턴테이블 렌더링 스크립트 (v3: lab 색상조합 4종 + 라이다 3개/레이저선)
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
  async function palette(id) {
    document.querySelector(`[data-palette="${id}"]`).click(); await sleep(400);
    fixProfile();
  }
  // 순수 V5 구성: 다른 버전의 추가 외장(V4/V6/V7/V8/V10)은 저장된 옵션과 무관하게 숨김
  const OFF_GROUPS = /V4 drive enclosure|V6 |V7 |V8 |V10 |하부 라운드 외장/;
  function pureV5() {
    V.scene.children.forEach(o => { if (o.type === 'Group' && o.name) o.visible = !OFF_GROUPS.test(o.name); });
    V.scene.traverse(o => { if (o.type === 'GridHelper') o.visible = false; });
  }
  const box = new T.Box3().setFromObject(V.model), center = box.getCenter(new T.Vector3());
  const W = 1600, H = 1000;
  function shoot(angleDeg, elevDeg = 14) {
    const r = V.renderer, cam = V.camera;
    const prevSize = new T.Vector2(); r.getSize(prevSize); const prevPR = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(W, H, false); cam.aspect = W / H;
    const look = new T.Vector3(center.x, box.min.y + 0.95, center.z);
    const dist = 5.2;   // 레이저 스캔 부채꼴까지 들어오도록 약간 멀리
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
