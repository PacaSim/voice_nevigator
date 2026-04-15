import React, { useRef, useEffect, useCallback } from 'react';
import { getRoiRect } from '../utils/roiConfig';
import './DetectionOverlay.css';

// 클래스별 색상 (ROI 외부) — App.css 디자인 토큰과 통일
const CLASS_COLORS = {
  0: '#38bdf8', // 자전거 → 하늘
  1: '#fb923c', // 전동 킥보드 → 주황
  2: '#a78bfa', // 볼라드 → 보라
};
const ROI_ALERT_COLOR = '#f87171'; // ROI 내 위험 → 빨강 (softer)

function getBoxColor(det) {
  return det.inROI ? ROI_ALERT_COLOR : (CLASS_COLORS[det.classId] ?? '#ffffff');
}

/** 고대비 텍스트 배경 포함 라벨 출력 */
function drawLabel(ctx, text, x, y, color) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textBaseline = 'bottom';
  const metrics = ctx.measureText(text);
  const padX = 6, padY = 4;
  const tw = metrics.width + padX * 2;
  const th = 18 + padY;

  // 배경
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y - th, tw, th);
  ctx.globalAlpha = 1;

  // 텍스트
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + padX, y - padY / 2);
}

export default function DetectionOverlay({ detections }) {
  const canvasRef   = useRef(null);
  const containerRef = useRef(null);

  // 캔버스 크기를 컨테이너에 맞게 조정
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width  = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // ResizeObserver 연결
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    resizeCanvas();
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // 매 프레임 캔버스 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeCanvas();
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // ── ROI 사각형 ─────────────────────────────────────────────────────
    const roi = getRoiRect();
    const rx = roi.x1 * W;
    const ry = roi.y1 * H;
    const rw = (roi.x2 - roi.x1) * W;
    const rh = (roi.y2 - roi.y1) * H;

    // ROI 배경 (연한 하이라이트)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(rx, ry, rw, rh);

    // ROI 테두리 — 점선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    // ROI 라벨
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textBaseline = 'top';
    ctx.fillText('보행 경로 (ROI)', rx + 6, ry + 4);

    // ── 탐지 결과 박스 ─────────────────────────────────────────────────
    for (const det of detections) {
      const [x1n, y1n, x2n, y2n] = det.bbox;
      const bx = x1n * W;
      const by = y1n * H;
      const bw = (x2n - x1n) * W;
      const bh = (y2n - y1n) * H;
      const color = getBoxColor(det);

      // 박스
      ctx.strokeStyle = color;
      ctx.lineWidth = det.inROI ? 3.5 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      // ROI 내 위험 → 반투명 채우기
      if (det.inROI) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(bx, by, bw, bh);
      }

      // 라벨 — ROI 내부는 방향/거리 표시, 외부는 클래스+신뢰도
      const pct = Math.round(det.score * 100);
      const tag = det.inROI
        ? `⚠ ${det.direction} ${det.distance} ${det.label}`
        : `${det.label} ${pct}%`;
      drawLabel(ctx, tag, bx, by, color);
    }
  }, [detections, resizeCanvas]);

  return (
    <div ref={containerRef} className="detection-overlay-container" aria-hidden="true">
      <canvas ref={canvasRef} className="detection-canvas" />
    </div>
  );
}
