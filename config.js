// ===== FARMILY-X S300 사전계약 설정 =====
// 가격·옵션·페이플 키는 이 파일만 고치면 됩니다.

export const CONFIG = {
  // 턴테이블 이미지: img/<색상id>-<on|off>/00.webp … 35.webp
  imageDir: 'img',
  frames: 36,
  initialFrame: 28,   // 처음 보여줄 각도 (0~35, 10°씩 → 28 = 280°: 정면 좌측 3/4 뷰)

  // 사전계약금 (원)
  deposit: 100000,

  // 가격 (원). null이면 "[가격 미정]"으로 표시
  prices: {
    body: 16000000,   // S300 본체
    lidar: 1500000,  // 라이다 안전 센서 (3개)
    lte: 1000000  // LTE 모듈 (원격 서비스 포함, 3년 기본 사용)
  },

  // 색상 조합 — id는 이미지 폴더명과 일치. 스와치는 본체/물통 두 색으로 표시
  colors: [
    { id: 'original', name: '원본 컬러', body: '#1c524e', tank: '#cccccc', price: 0, desc: '본체 딥 그린 · 물통 라이트 그레이' },
    { id: 'forest', name: '포레스트', body: '#35564a', tank: '#f0f2e9', price: 1000000, desc: '본체 포레스트 그린 · 물통 아이보리' },
    { id: 'graphite', name: '그래파이트', body: '#3f494b', tank: '#f1f3ee', price: 1000000, desc: '본체 그래파이트 · 물통 아이보리' },
    { id: 'sand', name: '샌드', body: '#777966', tank: '#f3f0e6', price: 1000000, desc: '본체 샌드 베이지 · 물통 아이보리' }
  ],

  // 페이플
  payple: {
    clientKey: 'YOUR_CLIENT_KEY'   // 페이플 관리자 > 파트너 인증 > 운영 clientKey
    // 테스트 시: index.html의 payment.js를 https://democpay.payple.kr/js/v1/payment.js 로 바꾸고 테스트 키 사용
  }
};
