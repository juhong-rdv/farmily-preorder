# FARMILY-X S300 사전계약 페이지

이미지 턴테이블 구성기 + 페이플 카드결제. GitHub Pages로 배포.
3D 모델 파일은 포함되지 않습니다 (미리 렌더링한 이미지만 사용).

- `config.js` — 가격, 색상, 페이플 clientKey (여기만 수정)
- `index.html` / `style.css` / `app.js` — 페이지
- `complete.html` — 결제 완료 페이지
- `img/<색상>-<on|off>/00~35.webp` — 10상태 × 36각도 렌더 이미지
- `render_frames.js` — lab 뷰어에서 이미지를 다시 렌더링하는 스크립트 (디자인 변경 시)

## 이미지 재생성 (디자인 버전 변경 시)
1. 크롬에서 lab.farmily.ai:8090/s300/ 열고 F12 콘솔에 `render_frames.js` 내용 붙여넣기
2. 다운로드된 `frames_*.json` 10개를 변환 (Claude에게 요청하거나 `tools/convert.py`)

## 배포
Settings → Pages → Branch: main / (root). 커스텀 도메인 사용 시 `CNAME` 파일에 도메인 한 줄.

## 페이플
1. 페이플 관리자 → 파트너 인증 설정에 배포 도메인 등록
2. `config.js`의 `clientKey`를 운영 키로 교체
3. 테스트: `index.html`의 payment.js를 `democpay.payple.kr`로 바꾸고 테스트 키 사용

## FARMILY-X UV 추가 (2026-10-29)
- 모델 선택(S300 / UV)이 구성기 상단에 추가됨. UV 옵션: 리프트(고정형 / 리프트형 +500만원), LTE. UV는 항상 부가세 포함.
- 아임웹 상품: #8 S300 사전계약금, #9 UV 사전계약금 (옵션 리프트 2종 × LTE 2종)
- 이미지(통일 카메라 2000x1500, fov35, dist5.0): S300은 lab s300 뷰어에서 `render_frames.js`, UV는 lab farmily-uv 뷰어에서 `render_uv.js` 실행
  → 다운로드 폴더의 `frames_*.json` 16개 → `python tools/convert_unified.py <폴더> img` → `python tools/make_sprites_jpg.py img <출력>` (세트당 a/b 2장)
  → 아임웹 업로드 후 `imweb/sprite_map.json`·위젯 CONFIG.sprites 갱신
- UV 세트 키: uv-<original|forest|graphite|sand>-<fixed|lift> (lift = 리프트 400 mm 상승). 아임웹 상품 #9 옵션: 색상 4 × 리프트 2 × LTE 2
