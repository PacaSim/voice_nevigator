/**
 * YOLOv8n ONNX 기반 실시간 객체 탐지
 *
 * 지원 모델 형식:
 *   - YOLOv8/v10 Ultralytics ONNX export
 *     Input:  "images"  [1, 3, 640, 640]  NCHW float32 0~1
 *     Output: "output0" [1, 84, 8400]      (cx,cy,w,h + 80 COCO 클래스 스코어)
 *
 * 모델 파일 준비:
 *   pip install ultralytics
 *   yolo export model=yolov8n.pt format=onnx imgsz=640
 *   → yolov8n.onnx 를 public/models/ 에 복사
 *
 * COCO 클래스 중 탐지 대상:
 *   0: 사람(person)
 *   1: 자전거(bicycle)
 *   3: 오토바이/전동킥보드(motorcycle) ← COCO에 킥보드 별도 클래스 없음
 *
 * ※ YOLOv10 end-to-end 출력 형식([1,300,6])은 지원하려면
 *   IS_V10_FORMAT = true 로 설정하세요.
 */

import * as ort from 'onnxruntime-web';
import { nms } from './nms';
import { isInROI } from './roiConfig';
import { getDirection, getDistance, getDistanceOrder } from './detectionInfo';

// ── 설정 ────────────────────────────────────────────────────────────────────
const MODEL_PATH     = `${process.env.PUBLIC_URL}/models/best.onnx`;
const INPUT_SIZE     = 320;
const CONF_THRESHOLD = 0.60; // 디버그용 — 탐지 확인 후 0.30~0.40으로 올리세요
const IOU_THRESHOLD  = 0.45;
const IS_V10_FORMAT  = false;

/** 탐지 대상 클래스 (모델 index → 한국어 라벨) */
const TARGET_CLASSES = new Map([
  [0, '자전거'],
  [1, '전동 킥보드'],
  [2, '볼라드'],
]);

// ── WASM 환경 설정 ───────────────────────────────────────────────────────────
// numThreads = 1 : SharedArrayBuffer 없는 환경(모바일 포함)에서도 동작
ort.env.wasm.numThreads = 1;
// CDN에서 모든 WASM 변형을 제공 → 모바일 브라우저가 지원하는 버전을 자동 선택
ort.env.wasm.wasmPaths  = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';

// ── 전처리 ───────────────────────────────────────────────────────────────────
/**
 * 비디오 프레임을 640×640 letterbox 리사이즈 후 NCHW Float32 텐서로 변환.
 * @returns {{ float32: Float32Array, scale: number, padX: number, padY: number }}
 */
function preprocessFrame(videoEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
  const nw = Math.round(vw * scale);
  const nh = Math.round(vh * scale);
  const padX = (INPUT_SIZE - nw) / 2;
  const padY = (INPUT_SIZE - nh) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(114,114,114)'; // Ultralytics 기본 letterbox 패딩 색상
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(videoEl, padX, padY, nw, nh);

  
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE); // RGBA
  const N = INPUT_SIZE * INPUT_SIZE;
  const float32 = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    float32[i]         = data[i * 4]     / 255.0; // R
    float32[i + N]     = data[i * 4 + 1] / 255.0; // G
    float32[i + N * 2] = data[i * 4 + 2] / 255.0; // B
  }
  return { float32, scale, padX, padY };
}

// ── 후처리 (YOLOv8 형식: [1, 4+numClasses, numPreds]) ───────────────────────
function postprocessV8(outputData, { scale, padX, padY }, vw, vh, numPreds) {
  const NUM_PREDS = numPreds;
  const rawBoxes   = [];
  const rawScores  = [];
  const rawLabels  = [];
  const rawClsIds  = [];

  for (let i = 0; i < NUM_PREDS; i++) {
    let bestScore = CONF_THRESHOLD;
    let bestCls   = -1;

    for (const [clsIdx] of TARGET_CLASSES) {
      const score = outputData[(4 + clsIdx) * NUM_PREDS + i];
      if (score > bestScore) { bestScore = score; bestCls = clsIdx; }
    }
    if (bestCls === -1) continue;

    // 모델 출력이 정규화 좌표(0~1)이므로 픽셀로 변환 후 역letterbox 적용
    const cx_px = outputData[0 * NUM_PREDS + i] * INPUT_SIZE;
    const cy_px = outputData[1 * NUM_PREDS + i] * INPUT_SIZE;
    const bw_px = outputData[2 * NUM_PREDS + i] * INPUT_SIZE;
    const bh_px = outputData[3 * NUM_PREDS + i] * INPUT_SIZE;

    // letterbox 역변환 → 원본 영상 정규화 좌표
    const x1 = Math.max(0, Math.min(1, ((cx_px - bw_px / 2 - padX) / scale) / vw));
    const y1 = Math.max(0, Math.min(1, ((cy_px - bh_px / 2 - padY) / scale) / vh));
    const x2 = Math.max(0, Math.min(1, ((cx_px + bw_px / 2 - padX) / scale) / vw));
    const y2 = Math.max(0, Math.min(1, ((cy_px + bh_px / 2 - padY) / scale) / vh));

    rawBoxes.push([x1, y1, x2, y2]);
    rawScores.push(bestScore);
    rawLabels.push(TARGET_CLASSES.get(bestCls));
    rawClsIds.push(bestCls);
  }

  return applyNMSAndROI(rawBoxes, rawScores, rawLabels, rawClsIds);
}

// ── 후처리 (YOLOv10 형식: [1, 300, 6] — end-to-end NMS 포함) ────────────────
function postprocessV10(outputData, { scale, padX, padY }, vw, vh) {
  const NUM_PREDS = 300;
  const rawBoxes  = [];
  const rawScores = [];
  const rawLabels = [];
  const rawClsIds = [];

  for (let i = 0; i < NUM_PREDS; i++) {
    const base = i * 6;
    const x1_img = outputData[base];
    const y1_img = outputData[base + 1];
    const x2_img = outputData[base + 2];
    const y2_img = outputData[base + 3];
    const score  = outputData[base + 4];
    const clsIdx = Math.round(outputData[base + 5]);

    if (score < CONF_THRESHOLD || !TARGET_CLASSES.has(clsIdx)) continue;

    const x1 = Math.max(0, Math.min(1, ((x1_img - padX) / scale) / vw));
    const y1 = Math.max(0, Math.min(1, ((y1_img - padY) / scale) / vh));
    const x2 = Math.max(0, Math.min(1, ((x2_img - padX) / scale) / vw));
    const y2 = Math.max(0, Math.min(1, ((y2_img - padY) / scale) / vh));

    rawBoxes.push([x1, y1, x2, y2]);
    rawScores.push(score);
    rawLabels.push(TARGET_CLASSES.get(clsIdx));
    rawClsIds.push(clsIdx);
  }

  return applyNMSAndROI(rawBoxes, rawScores, rawLabels, rawClsIds);
}

function applyNMSAndROI(rawBoxes, rawScores, rawLabels, rawClsIds) {
  if (rawBoxes.length === 0) return [];

  // 클래스별 NMS
  const result = [];
  const uniqueClasses = [...new Set(rawClsIds)];

  for (const cls of uniqueClasses) {
    const idx = rawClsIds.map((c, i) => (c === cls ? i : -1)).filter((i) => i !== -1);
    const keepLocal = nms(idx.map((i) => rawBoxes[i]), idx.map((i) => rawScores[i]), IOU_THRESHOLD);
    for (const li of keepLocal) {
      const oi = idx[li];
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
        // 우선 wasm만 사용 — webgl EP는 YOLO 대형 모델에서 불안정
        const session = await ort.InferenceSession.create(MODEL_PATH, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        console.info('[Detection] 모델 로드 완료 (wasm)');
        return session;
      } catch (err) {
        _loadPromise = null; // 실패 시 다음 호출에서 재시도 가능하게 리셋
        console.error('[Detection] 모델 로드 실패:', err);
        throw new Error(`모델 로드 실패: ${err.message}`);
      }
    })();
  }
  return _loadPromise;
}

/**
 * 단일 프레임에 대해 탐지를 실행합니다.
 * @param {HTMLVideoElement} videoEl
 * @param {ort.InferenceSession} session
 * @returns {Promise<Detection[]>}
 */
export async function detectFrame(videoEl, session) {
  if (!videoEl || videoEl.readyState < 2) return [];
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return [];

  const letterbox = preprocessFrame(videoEl);
  const inputTensor = new ort.Tensor('float32', letterbox.float32, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const feeds = { images: inputTensor };

  const results   = await session.run(feeds);
  const outputKey = Object.keys(results)[0];
  const output    = results[outputKey];
  const numPreds  = output.dims[2]; // [1, 4+classes, numPreds]

  return IS_V10_FORMAT
    ? postprocessV10(output.data, letterbox, vw, vh)
    : postprocessV8(output.data, letterbox, vw, vh, numPreds);
}
