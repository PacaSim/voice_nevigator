/**
 * Intersection over Union between two [x1,y1,x2,y2] boxes (normalized coords)
 */
export function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const aArea = (a[2] - a[0]) * (a[3] - a[1]);
  const bArea = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (aArea + bArea - inter);
}

/**
 * Greedy Non-Maximum Suppression
 * @param {number[][]} boxes  - [[x1,y1,x2,y2], ...]
 * @param {number[]}   scores - confidence per box
 * @param {number}     iouThreshold
 * @returns {number[]} indices of kept boxes
 */
export function nms(boxes, scores, iouThreshold = 0.45) {
  const order = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .map(({ i }) => i);

  const suppressed = new Uint8Array(boxes.length);
  const keep = [];

  for (const i of order) {
    if (suppressed[i]) continue;
    keep.push(i);
    for (const j of order) {
      if (j === i || suppressed[j]) continue;
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed[j] = 1;
    }
  }
  return keep;
}
