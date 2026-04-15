/**
 * 탐지 결과에서 방향(좌/정면/우)과 거리(바로 앞/가까이/멀리)를 추정합니다.
 *
 * 방향: bbox 수평 중심 기준
 *   0.0 ~ 0.36 → 왼쪽
 *   0.36 ~ 0.64 → 정면
 *   0.64 ~ 1.0  → 오른쪽
 *
 * 거리: bbox 높이(비율) 기준 (bbox가 클수록 가까움)
 *   > 0.45 → 바로 앞
 *   > 0.25 → 가까이
 *   otherwise → 멀리
 */

/** @param {number[]} bbox [x1, y1, x2, y2] normalized */
export function getDirection(bbox) {
  const cx = (bbox[0] + bbox[2]) / 2;
  if (cx < 0.36) return '왼쪽';
  if (cx > 0.64) return '오른쪽';
  return '정면';
}

/** @param {number[]} bbox [x1, y1, x2, y2] normalized */
export function getDistance(bbox) {
  const bh = bbox[3] - bbox[1];
  if (bh > 0.45) return '바로 앞';
  if (bh > 0.25) return '가까이';
  return '멀리';
}

/**
 * 거리 정렬 우선순위 (낮을수록 가까움)
 * @param {number[]} bbox
 */
export function getDistanceOrder(bbox) {
  const bh = bbox[3] - bbox[1];
  if (bh > 0.45) return 0;
  if (bh > 0.25) return 1;
  return 2;
}

/**
 * 방향 + 거리 + 라벨을 자연스러운 한국어 문장으로 조합합니다.
 * 예) "정면 바로 앞에 사람", "왼쪽 가까이 자전거", "오른쪽에 오토바이"
 *
 * @param {string} direction
 * @param {string} distance
 * @param {string} label
 */
export function formatThreat(direction, distance, label) {
  if (distance === '멀리') {
    // 거리가 멀면 방향만
    return direction === '정면'
      ? `정면에 ${label}`
      : `${direction}에 ${label}`;
  }
  return direction === '정면'
    ? `${distance}에 ${label}`
    : `${direction} ${distance}에 ${label}`;
}
