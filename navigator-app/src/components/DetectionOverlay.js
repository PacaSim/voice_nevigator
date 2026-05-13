import React, { useRef, useEffect, useCallback } from 'react';
import { getTrapezoidPoints, getTrapezoidBoundsAtY, ZONE_Y } from '../utils/roiConfig';
import './DetectionOverlay.css';

// 클래스별 색상 (ROI 외부)
const CLASS_COLORS = {
  0: '#38bdf8', // 자전거      → 하늘
  1: '#fb923c', // 전동 킥보드 → 주황
  2: '#a78bfa', // 볼라드      → 보라
  3: '#facc15', // 자동차      → 노랑
  4: '#f472b6', // 오토바이    → 핑크
  5: '#4ade80', // 계단        → 초록
  6: '#67e8f9', // 횡단보도    → 청록
  7: '#e2e8f0', // 사람        → 밝은 회색
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

/**
 * 사다리꼴 ROI를 캔버스에 그립니다.
 * 거리 구간(바로 앞 / 가까이 / 멀리)을 가이드선으로 표시합니다.
 */
function drawTrapezoidROI(ctx, W, H) {
  const pts = getTrapezoidPoints();

  // 꼭짓점을 픽셀 좌표로 변환
  const px = (nx) => nx * W;
  const py = (ny) => ny * H;

  // ── 사다리꼴 경로 ────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(px(pts.topLeft.x),     py(pts.topLeft.y));
  ctx.lineTo(px(pts.topRight.x),    py(pts.topRight.y));
  ctx.lineTo(px(pts.bottomRight.x), py(pts.bottomRight.y));
  ctx.lineTo(px(pts.bottomLeft.x),  py(pts.bottomLeft.y));
  ctx.closePath();

  // 배경 채우기
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();

  // 테두리 — 점선
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 거리 구간 가이드선 ────────────────────────────────────────────────────
  const zones = [
    { y: ZONE_Y.near, label: '바로 앞', color: 'rgba(248,113,113,0.7)' },  // 빨강
    { y: ZONE_Y.mid,  label: '가까이',  color: 'rgba(251,191,36,0.7)' },   // 노랑
  ];

  for (const zone of zones) {
    const { xLeft, xRight } = getTrapezoidBoundsAtY(zone.y);
    const lx = px(xLeft);
    const rx = px(xRight);
    const zy = py(zone.y);

    ctx.beginPath();
    ctx.moveTo(lx, zy);
    ctx.lineTo(rx, zy);
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 구간 라벨
    ctx.font = '11px sans-serif';
    ctx.fillStyle = zone.color;
    ctx.textBaseline = 'bottom';
    ctx.fillText(zone.label, lx + 4, zy - 2);
  }

  // ROI 라벨
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textBaseline = 'top';
  ctx.fillText('보행 경로 (ROI)', px(pts.topLeft.x) + 6, py(pts.topLeft.y) + 4);
}

const SIGNAL_STYLE = {
  red:     { bg: 'rgba(239,68,68,0.90)',   text: '🔴 빨간불 — 멈추세요' },
  green:   { bg: 'rgba(34,197,94,0.90)',   text: '🟢 초록불 — 건너세요' },
  unknown: null,
};

/** 신호등 상태 배지를 우상단에 그립니다 */
function drawTrafficLightBadge(ctx, W, trafficLight) {
  if (!trafficLight || trafficLight.state === 'unknown') return;
  const style = SIGNAL_STYLE[trafficLight.state];
  if (!style) return;

  ctx.font = 'bold 16px sans-serif';
  const metrics = ctx.measureText(style.text);
  const padX = 12;
  const bw = metrics.width + padX * 2;
  const bh = 28;
  const bx = W - bw - 12;
  const by = 12;

  ctx.fillStyle = style.bg;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.text, bx + padX, by + bh / 2);
}

export default function DetectionOverlay({ detections, trafficLight }) {
  const canvasRef    = useRef(null);
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

    // ── 신호등 배지 ────────────────────────────────────────────────────────────
    drawTrafficLightBadge(ctx, W, trafficLight);

    // ── 사다리꼴 ROI + 거리 구간선 ──────────────────────────────────────────
    drawTrapezoidROI(ctx, W, H);

    // ── 탐지 결과 박스 ────────────────────────────────────────────────────────
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
  }, [detections, trafficLight, resizeCanvas]);

  return (
    <div ref={containerRef} className="detection-overlay-container" aria-hidden="true">
      <canvas ref={canvasRef} className="detection-canvas" />
    </div>
  );
}
