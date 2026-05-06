/**
 * 신호등 색상 분석 모듈 (모델 불필요)
 *
 * 화면 상단 탐색 구역에서 픽셀을 스캔하여
 * 밝고 채도 높은 빨강/초록 클러스터를 찾아 신호 상태를 반환합니다.
 *
 * 탐색 구역: y 0~55%, x 15~85% (신호등이 주로 등장하는 영역)
 * 분석 해상도: 성능을 위해 4픽셀마다 1개 샘플링
 */

const ZONE = { x1: 0.15, y1: 0.0, x2: 0.85, y2: 0.55 };
const SAMPLE_STEP = 4;       // 픽셀 샘플링 간격
const MIN_PIXELS  = 30;      // 신호로 인정할 최소 픽셀 수 (노이즈 제거)
const MIN_RATIO   = 2.5;     // 빨강/초록 중 우세한 쪽이 반대의 몇 배 이상이어야 인정

/**
 * 픽셀 RGB 값으로 밝고 채도 높은 빨강인지 판별.
 * 신호등 빨간 LED는 R이 매우 높고 G·B는 낮음.
 */
function isSignalRed(r, g, b) {
  return r > 160 && g < 80 && b < 80;
}

/**
 * 픽셀 RGB 값으로 밝고 채도 높은 초록인지 판별.
 * 한국 신호등 초록은 약간 청록 계열 포함.
 */
function isSignalGreen(r, g, b) {
  return g > 130 && r < 100 && b < 150 && g > r && g > b;
}

/**
 * 비디오 프레임에서 신호등 색상을 분석합니다.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {'red' | 'green' | 'unknown'}
 */
export function analyzeTrafficLight(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return 'unknown';
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return 'unknown';

  // 탐색 구역을 픽셀 좌표로 변환
  const px1 = Math.floor(ZONE.x1 * vw);
  const py1 = Math.floor(ZONE.y1 * vh);
  const pw  = Math.floor((ZONE.x2 - ZONE.x1) * vw);
  const ph  = Math.floor((ZONE.y2 - ZONE.y1) * vh);

  const canvas = document.createElement('canvas');
  canvas.width  = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, px1, py1, pw, ph, 0, 0, pw, ph);

  const { data } = ctx.getImageData(0, 0, pw, ph);

  let redCount   = 0;
  let greenCount = 0;

  for (let row = 0; row < ph; row += SAMPLE_STEP) {
    for (let col = 0; col < pw; col += SAMPLE_STEP) {
      const i = (row * pw + col) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (isSignalRed(r, g, b))   redCount++;
      if (isSignalGreen(r, g, b)) greenCount++;
    }
  }

  const dominant = Math.max(redCount, greenCount);
  const other    = Math.min(redCount, greenCount);

  // 최소 픽셀 수 미달이거나 명확한 우세가 없으면 unknown
  if (dominant < MIN_PIXELS) return 'unknown';
  if (other > 0 && dominant / other < MIN_RATIO) return 'unknown';

  return redCount > greenCount ? 'red' : 'green';
}
