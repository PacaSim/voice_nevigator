/**
 * 탐지 결과에서 방향(좌/정면/우)과 거리(바로 앞/가까이/멀리)를 추정합니다.
 *
 * 방향: bbox 수평 중심 기준
 *   0.0 ~ 0.36 → 왼쪽
 *   0.36 ~ 0.64 → 정면
 *   0.64 ~ 1.0  → 오른쪽
 *
 * 거리 (개선): bbox 높이(bh)와 bbox 하단 y위치(y2)를 함께 사용
 *   - bh만 쓰면 화면 상단의 큰 물체(실제로 멀 수 있음)를 가깝게 오판 가능
 *   - y2가 낮을수록(화면 아래) + bh가 클수록 더 가까운 물체
 *
 *   proximityScore = bh * 0.55 + y2 * 0.45
 *     > 0.65 → 바로 앞  (~2m 이내)
 *     > 0.42 → 가까이   (~2~5m)
 *     otherwise → 멀리  (5m+)
 */

/** @param {number[]} bbox [x1, y1, x2, y2] normalized */
export function getDirection(bbox) {
  const cx = (bbox[0] + bbox[2]) / 2;
  if (cx < 0.36) return '왼쪽';
  if (cx > 0.64) return '오른쪽';
  return '정면';
}

/**
 * bbox 높이와 하단 y위치를 결합한 거리 추정.
 * @param {number[]} bbox [x1, y1, x2, y2] normalized
 */
export function getProximityScore(bbox) {
  const bh = bbox[3] - bbox[1]; // bbox 높이
  const y2 = bbox[3];           // bbox 하단 y
  return bh * 0.55 + y2 * 0.45;
}

/** @param {number[]} bbox [x1, y1, x2, y2] normalized */
export function getDistance(bbox) {
  const score = getProximityScore(bbox);
  if (score > 0.65) return '바로 앞';
  if (score > 0.42) return '가까이';
  return '멀리';
}

/**
 * 거리 정렬 우선순위 (낮을수록 가까움)
 * @param {number[]} bbox
 */
export function getDistanceOrder(bbox) {
  const score = getProximityScore(bbox);
  if (score > 0.65) return 0;
  if (score > 0.42) return 1;
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
    return direction === '정면'
      ? `정면에 ${label}`
      : `${direction}에 ${label}`;
  }
  return direction === '정면'
    ? `${distance}에 ${label}`
    : `${direction} ${distance}에 ${label}`;
}

