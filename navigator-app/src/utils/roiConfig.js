/**
 * ROI (Region of Interest) — 원근감을 반영한 사다리꼴 보행 경로
 *
 * 카메라로 전방 보행로를 촬영하면 실제 경로는 사다리꼴 형태로 보임:
 *   - 화면 하단(가까운 쪽): 넓음
 *   - 화면 상단(먼 쪽):    좁음
 *
 * 사다리꼴 꼭짓점 (정규화 좌표):
 *   y_top    = 0.35  (ROI 상단 — 먼 구간 시작)
 *   y_bottom = 0.98  (ROI 하단 — 화면 끝)
 *   x_top    = 0.30 ~ 0.70  (폭 40%, 먼 곳)
 *   x_bottom = 0.08 ~ 0.92  (폭 84%, 가까운 곳)
 */

const Y_TOP    = 0.35;
const Y_BOTTOM = 0.98;
const X_LEFT_TOP    = 0.30;
const X_RIGHT_TOP   = 0.70;
const X_LEFT_BOTTOM = 0.08;
const X_RIGHT_BOTTOM = 0.92;

/**
 * 특정 y 위치에서의 사다리꼴 좌우 경계를 반환.
 * @param {number} y - 정규화 y (0~1)
 * @returns {{ xLeft: number, xRight: number }}
 */
export function getTrapezoidBoundsAtY(y) {
  // y_top → y_bottom 방향으로 t: 0 → 1
  const t = Math.max(0, Math.min(1, (y - Y_TOP) / (Y_BOTTOM - Y_TOP)));
  const xLeft  = X_LEFT_TOP  + t * (X_LEFT_BOTTOM  - X_LEFT_TOP);
  const xRight = X_RIGHT_TOP + t * (X_RIGHT_BOTTOM - X_RIGHT_TOP);
  return { xLeft, xRight };
}

/** 사다리꼴 꼭짓점 4개 반환 (시각화용) */
export function getTrapezoidPoints() {
  return {
    topLeft:     { x: X_LEFT_TOP,    y: Y_TOP },
    topRight:    { x: X_RIGHT_TOP,   y: Y_TOP },
    bottomRight: { x: X_RIGHT_BOTTOM, y: Y_BOTTOM },
    bottomLeft:  { x: X_LEFT_BOTTOM, y: Y_BOTTOM },
  };
}

/**
 * 거리 구간별 y 경계 (시각화용 가이드선)
 *   near  : y > NEAR_Y  → 바로 앞
 *   mid   : NEAR_Y >= y > MID_Y → 가까이
 *   far   : y <= MID_Y  → 멀리
 */
export const ZONE_Y = {
  near: 0.72,
  mid:  0.52,
};

/**
 * 바운딩박스가 사다리꼴 ROI 안에 있는지 판정.
 * 판정 기준: bbox 하단 중심점(cx, y2)이 사다리꼴 내부에 있거나
 *            bbox와 사다리꼴의 y 범위가 겹치고 cx가 해당 y의 경계 내에 있을 때.
 *
 * @param {number[]} bbox - [x1, y1, x2, y2] normalized
 */
export function isInROI(bbox) {
  const [bx1, , bx2, by2] = bbox;
  const cx = (bx1 + bx2) / 2;

  // y 범위 밖이면 제외
  if (by2 < Y_TOP || by2 > Y_BOTTOM + 0.05) return false;

  // 하단 중심점 기준: 해당 y에서의 사다리꼴 경계 안인지 확인
  const { xLeft, xRight } = getTrapezoidBoundsAtY(Math.min(by2, Y_BOTTOM));
  return cx >= xLeft && cx <= xRight;
}

/** 하위 호환 — 사다리꼴의 외접 사각형 반환 */
export function getRoiRect() {
  return {
    x1: X_LEFT_BOTTOM,
    y1: Y_TOP,
    x2: X_RIGHT_BOTTOM,
    y2: Y_BOTTOM,
  };
}
