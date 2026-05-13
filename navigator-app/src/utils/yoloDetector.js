/**
 * SafeWalk v7 ONNX 기반 실시간 객체 탐지
 *
 * 모델: safewalk_train_v7 (YOLOv8x 파인튜닝)
 *   Input:  "images"  [1, 3, 640, 640]  NCHW float32 0~1
 *   Output: "output0" [1, 12, 8400]     (cx,cy,w,h + 8클래스 스코어)
 *
 * 8개 탐지 클래스:
 *   0: bicycle    → 자전거
 *   1: kickboard  → 전동 킥보드
 *   2: bollard    → 볼라드
 *   3: car        → 자동차
 *   4: motorcycle → 오토바이
 *   5: stairs     → 계단
 *   6: crosswalk  → 횡단보도
 *   7: people     → 사람
 */

import * as ort from 'onnxruntime-web';
import { nms } from './nms';
import { isInROI } from './roiConfig';
import { getDirection, getDistance, getDistanceOrder } from './detectionInfo';

// ── 설정 ────────────────────────────────────────────────────────────────────
const MODEL_PATH     = `${process.env.PUBLIC_URL}/models/best.onnx`;
const INPUT_SIZE     = 640;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD  = 0.45;

const TARGET_CLASSES = new Map([
  [0, '자전거'],
  [1, '전동 킥보드'],
  [2, '볼라드'],
  [3, '자동차'],
  [4, '오토바이'],
  [5, '계단'],
  [6, '횡단보도'],
  [7, '사람'],
]);

// ── WASM 환경 설정 ───────────────────────────────────────────────────────────
// proxy=true: 추론을 별도 Worker에서 실행 → 메인 스레드 블로킹 없음
ort.env.wasm.proxy      = true;
ort.env.wasm.numThreads = 1;
// 로컬 public/에 복사된 WASM 파일 사용 (CDN 의존성 제거)
ort.env.wasm.wasmPaths  = `${process.env.PUBLIC_URL}/`;

// ── 전처리 버퍼 (모듈 수준 싱글턴 — 매 프레임 재할당 방지) ─────────────────
const _canvas  = document.createElement('canvas');
_canvas.width  = INPUT_SIZE;
_canvas.height = INPUT_SIZE;
const _ctx     = _canvas.getContext('2d', { willReadFrequently: true });
const _N       = INPUT_SIZE * INPUT_SIZE;
const _float32 = new Float32Array(3 * _N);

// ── 전처리 ───────────────────────────────────────────────────────────────────
function preprocessFrame(videoEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
  const nw = Math.round(vw * scale);
  const nh = Math.round(vh * scale);
  const padX = (INPUT_SIZE - nw) / 2;
  const padY = (INPUT_SIZE - nh) / 2;

  _ctx.fillStyle = '#727272';
  _ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  _ctx.drawImage(videoEl, padX, padY, nw, nh);

  const { data } = _ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  for (let i = 0; i < _N; i++) {
    _float32[i]         = data[i * 4]     / 255.0;
    _float32[i + _N]    = data[i * 4 + 1] / 255.0;
    _float32[i + _N * 2] = data[i * 4 + 2] / 255.0;
  }
  return { float32: _float32, scale, padX, padY };
}

// ── 후처리 (YOLOv8: [1, 4+nc, 8400], 좌표는 픽셀 단위) ─────────────────────
function postprocess(outputData, { scale, padX, padY }, vw, vh, numPreds) {
  const rawBoxes  = [];
  const rawScores = [];
  const rawLabels = [];
  const rawClsIds = [];

  for (let i = 0; i < numPreds; i++) {
    let bestScore = CONF_THRESHOLD;
    let bestCls   = -1;

    for (const [clsIdx] of TARGET_CLASSES) {
      const score = outputData[(4 + clsIdx) * numPreds + i];
      if (score > bestScore) { bestScore = score; bestCls = clsIdx; }
    }
    if (bestCls === -1) continue;

    // 픽셀 좌표 → 역letterbox → 정규화 (0~1)
    const cx = outputData[0 * numPreds + i];
    const cy = outputData[1 * numPreds + i];
    const bw = outputData[2 * numPreds + i];
    const bh = outputData[3 * numPreds + i];

    const x1 = Math.max(0, Math.min(1, ((cx - bw / 2 - padX) / scale) / vw));
    const y1 = Math.max(0, Math.min(1, ((cy - bh / 2 - padY) / scale) / vh));
    const x2 = Math.max(0, Math.min(1, ((cx + bw / 2 - padX) / scale) / vw));
    const y2 = Math.max(0, Math.min(1, ((cy + bh / 2 - padY) / scale) / vh));

    rawBoxes.push([x1, y1, x2, y2]);
    rawScores.push(bestScore);
    rawLabels.push(TARGET_CLASSES.get(bestCls));
    rawClsIds.push(bestCls);
  }

  if (rawBoxes.length === 0) return [];

  const result = [];
  const uniqueClasses = [...new Set(rawClsIds)];
  for (const cls of uniqueClasses) {
    const idx = rawClsIds.map((c, i) => (c === cls ? i : -1)).filter((i) => i !== -1);
    const kept = nms(idx.map((i) => rawBoxes[i]), idx.map((i) => rawScores[i]), IOU_THRESHOLD);
    for (const li of kept) {
      const oi   = idx[li];
      const bbox = rawBoxes[oi];
      result.push({
        bbox,
        score:         rawScores[oi],
        label:         rawLabels[oi],
        classId:       rawClsIds[oi],
        inROI:         isInROI(bbox),
        direction:     getDirection(bbox),
        distance:      getDistance(bbox),
        distanceOrder: getDistanceOrder(bbox),
      });
    }
  }
  return result;
}

// ── Singleton Detector ───────────────────────────────────────────────────────
let _loadPromise = null;

export async function getDetector() {
  if (!_loadPromise) {
    _loadPromise = (async () => {
      try {
        const session = await ort.InferenceSession.create(MODEL_PATH, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        console.info('[Detection] 모델 로드 완료 (proxy-wasm)');
        return session;
      } catch (err) {
        _loadPromise = null;
        throw new Error(`모델 로드 실패: ${err.message}`);
      }
    })();
  }
  return _loadPromise;
}

export async function detectFrame(videoEl, session) {
  if (!videoEl || videoEl.readyState < 2) return [];
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return [];

  const letterbox = preprocessFrame(videoEl);
  // Float32Array를 slice해서 복사본 전달 — Worker postMessage 시 버퍼 transfer 방지
  const tensor = new ort.Tensor('float32', letterbox.float32.slice(), [1, 3, INPUT_SIZE, INPUT_SIZE]);

  const results  = await session.run({ images: tensor });
  const output   = results[Object.keys(results)[0]];
  const numPreds = output.dims[2];

  return postprocess(output.data, letterbox, vw, vh, numPreds);
}
