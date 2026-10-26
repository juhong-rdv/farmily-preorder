# 아임웹 삽입 (farmilyx.imweb.me/pre-order · 메뉴 "2027사전예약")

- `farmilyx-preorder-imweb.html` : 코드 위젯에 붙여 넣는 단일 파일 (CSS+HTML+JS). 빌드: `python3 tools/build_imweb.py . imweb/farmilyx-preorder-imweb.html imweb/sprite_map.json`
- `farmilyx-preorder-imweb.min.html` : 주석 제거본 (2026-10-25 게시본과 동일 내용 + 캔버스 리사이즈 보강)
- `sprite_map.json` : 아임웹 CDN에 올린 스프라이트 시트 주소 (세트당 2장, 2열×9행, 프레임 960×720). 아임웹은 업로드 이미지를 가로 1920px로 축소하고 높이 8000px를 넘기면 거부함.
- `geo-kr-only.html` : 해외(비 KR) 접속 시 사전예약 메뉴·페이지를 숨기는 스크립트. 아임웹 관리자 → 설정 → SEO → 고급 설정 → 공통 코드 삽입 → **Header Code** 끝에 삽입되어 있음 (2026-10-26).
