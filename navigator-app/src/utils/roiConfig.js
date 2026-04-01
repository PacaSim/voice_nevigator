/**
 * ROI (Region of Interest) — 화면 중앙 하단, 실제 보행 경로에 해당.
 *
 * 모든 값은 비율(0~1), 좌상단 기준.
 *   x: 20% ~ 80%  (좌우 여유)
 *   y: 45% ~ 95%  (상하 — 하단 절반 조금 넘게)
 */
export const ROI = {
  x: 0.20,
  y: 0.45,
  w: 0.60,   // x2 = x + w = 0.80
  h: 0.50,   // y2 = y + h = 0.95
};

/** ROI 코너 좌표 (정규화) */
export function getRoiRect() {
  return {
    x1: ROI.x,
    y1: ROI.y,
    x2: ROI.x + ROI.w,
    y2: ROI.y + ROI.h,
  };
}

/**
 * 바운딩박스가 ROI 안에 '의미 있게' 겹치는지 판정.
 * 판정 기준: bbox의 하단 중심점이 ROI 안에 있거나,
 *           bbox와 ROI의 IoU가 0.15 이상.
 *
 * @param {number[]} bbox - [x1, y1, x2, y2] normalized
 */
export function isInROI(bbox) {
  const [bx1, by1, bx2, by2] = bbox;
  const { x1, y1, x2, y2 } = getRoiRect();

  // 하단 중심점 기준
  const cx = (bx1 + bx2) / 2;
  const by = by2; // bottom y
  if (cx >= x1 && cx <= x2 && by >= y1 && by <= y2) return true;

  // 겹침 면적 기준 (bbox 면적 대비 15% 이상)
  const ix1 = Math.max(bx1, x1);
  const iy1 = Math.max(by1, y1);
  const ix2 = Math.min(bx2, x2);
  const iy2 = Math.min(by2, y2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const bboxArea = (bx2 - bx1) * (by2 - by1);
  if (bboxArea > 0 && inter / bboxArea >= 0.15) return true;

  return false;
}
