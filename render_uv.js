/* FARMILY UV 사전계약용 턴테이블 렌더링 스크립트 (lab.farmily.ai:8090/farmily-uv/ 콘솔에서 실행)
 * 결과: frames_uv-fixed.json / frames_uv-lift.json (각 36장) → 다운로드 폴더
 *   uv-fixed = 리프트 0 mm(고정형), uv-lift = 리프트 400 mm 상승(높이 자동조정형)
 */
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  window.__uvRender = { status: 'start', done: 0 };
  for (let i = 0; i < 300 && !window.__uvReady; i++) await sleep(200);
  const V = window.__farmilyUV; if (!V) { window.__uvRender.status = 'no viewer'; return; }
  const T = (await import('/s300/vendor/three/three.module.js'));
  const LIFT_MM = window.__uvLiftMm || 400, ANGLE0 = window.__uvAngle0 ?? 35;
  const { scene, renderer: r, camera: cam, controls, model, equipment } = V;

  // 1) 뷰어 장식 제거: 격자, 기존 바닥 그림자, 기존 조명 그림자
  scene.traverse(o => { if (o.type === 'GridHelper') o.visible = false; });
  scene.children.filter(o => o.isMesh && o.material && o.material.isShadowMaterial).forEach(o => { o.visible = false; });
  scene.background = new T.Color('#f2f5f1');
  equipment.setHeight(0); equipment.setLamps(true);
  model.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model, true), center = box.getCenter(new T.Vector3());
  const floorY = box.min.y;

  // 2) 바닥 그라데이션 + 접지 그림자 (S300 렌더와 동일)
  {
    r.shadowMap.enabled = true; r.shadowMap.autoUpdate = true;
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
    const grd = g.createRadialGradient(512, 512, 0, 512, 512, 512);
    grd.addColorStop(0, '#e3e5e0'); grd.addColorStop(0.5, '#eceee9'); grd.addColorStop(1, '#f2f5f1');
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, floorY - 0.002, center.z); floor.name = '__floor'; scene.add(floor);
    const shadow = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.30 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(center.x, floorY - 0.001, center.z); shadow.receiveShadow = true; shadow.name = '__shadow'; scene.add(shadow);
    const sun = new T.DirectionalLight(0xffffff, 0.001);
    sun.position.set(center.x + 1.2, box.max.y + 6, center.z + 2.0); sun.target.position.copy(center); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 0.1; sc.far = 25; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);
    scene.traverse(o => { if (o.isLight && o !== sun && o.castShadow) o.castShadow = false; });
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }

  // 3) 촬영
  // S300 렌더(render_frames.js)와 동일한 카메라: 1600x1000, fov 36, dist 5.2, look floorY+0.95, elev 14 → 두 모델 스케일 일치
  const W = window.__uvW || 1600, H = window.__uvH || 1000, DIST = window.__uvDist || 5.2, LOOK_Y = window.__uvLookY ?? 0.95;
  cam.fov = 36;
  function shoot(angleDeg, elevDeg = 14) {
    const prevSize = new T.Vector2(); r.getSize(prevSize); const prevPR = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(W, H, false); cam.aspect = W / H;
    const look = new T.Vector3(center.x, floorY + LOOK_Y, center.z);
    const a = T.MathUtils.degToRad(angleDeg), e = T.MathUtils.degToRad(elevDeg);
    cam.position.set(look.x + DIST * Math.cos(e) * Math.sin(a), look.y + DIST * Math.sin(e), look.z + DIST * Math.cos(e) * Math.cos(a));
    cam.lookAt(look); cam.near = 0.05; cam.far = 50; cam.updateProjectionMatrix();
    equipment.updateGlow(cam);
    r.shadowMap.needsUpdate = true; r.render(scene, cam);
    const data = r.domElement.toDataURL('image/jpeg', 0.9);
    r.setPixelRatio(prevPR); r.setSize(prevSize.x, prevSize.y, false); cam.aspect = prevSize.x / prevSize.y; cam.updateProjectionMatrix();
    return data;
  }
  function download(name, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  const SETS = window.__uvSets || [['uv-fixed', 0], ['uv-lift', LIFT_MM]];
  const PREVIEW = !!window.__uvPreview;
  for (const [key, mm] of SETS) {
    equipment.setHeight(mm); model.updateMatrixWorld(true);
    if (PREVIEW) { window.__uvRender[key] = shoot(ANGLE0 + 280); continue; }
    const frames = [];
    for (let i = 0; i < 36; i++) { frames.push(shoot(i * 10 + ANGLE0).split(',')[1]); if (i % 6 === 5) await sleep(50); }
    download(`frames_${key}.json`, JSON.stringify({ key, w: W, h: H, frames }));
    window.__uvRender.done++; await sleep(800);
  }
  window.__uvRender.status = 'done';
})().catch(e => { window.__uvRender = { status: 'error', msg: String(e && e.stack || e) }; });
