# AI 보행 내비게이터

교통약자(시각장애인·노약자)를 위한 실시간 장애물 탐지 보행 내비게이션 웹앱.

스마트폰 후면 카메라 영상을 분석해 사람, 자전거, 오토바이/전동킥보드를 탐지하고, 보행 경로(ROI) 내 위험 요소를 음성으로 즉시 안내합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 카메라** | 후면 카메라 전체화면 출력 (`facingMode: environment`) |
| **객체 탐지** | YOLOv8n ONNX + ONNX Runtime Web (브라우저 내 추론, 서버 불필요) |
| **ROI 필터링** | 화면 중앙 하단(보행 경로) 진입 장애물 우선 경고 |
| **음성 안내** | Web Speech API TTS (한국어), 4초 쿨다운으로 반복 방지 |
| **고대비 UI** | 시각장애인 고려 — 큰 버튼, 고대비 색상, `aria-live` 지원 |

---

## 기술 스택

```
React 19          UI 프레임워크
ONNX Runtime Web  브라우저 내 딥러닝 추론 (WASM 백엔드)
YOLOv8n           Ultralytics 경량 객체 탐지 모델
Web Speech API    TTS 음성 안내
navigator.mediaDevices  카메라 스트림
```

---

## 프로젝트 구조

```
Voice_nevigator/
├── .venv/                         # Python 가상환경 (모델 export용)
├── yolov8n.pt                     # 원본 PyTorch 가중치
├── navigator-app/                 # React 앱
│   ├── public/
│   │   ├── models/
│   │   │   └── yolov8n.onnx       # ONNX 모델 (gitignore됨 — 아래 준비 방법 참고)
│   │   └── ort-wasm-simd-threaded*.{wasm,mjs}  # ONNX Runtime WASM 런타임
│   └── src/
│       ├── hooks/
│       │   ├── useCamera.js       # 카메라 스트림 관리
│       │   ├── useDetection.js    # 추론 루프 (rAF 기반 ~15fps)
│       │   └── useVoice.js        # TTS 래퍼
│       ├── utils/
│       │   ├── yoloDetector.js    # ONNX 세션·전처리·후처리
│       │   ├── nms.js             # Non-Maximum Suppression
│       │   └── roiConfig.js       # ROI 정의 및 판정
│       └── components/
│           ├── CameraView         # 카메라 화면 + 상태 오버레이
│           ├── DetectionOverlay   # Canvas bbox·ROI 시각화
│           ├── StatusBar          # 상태 표시줄 (aria-live)
│           └── ControlPanel       # 시작·중지·음성반복 버튼
```

---

## 시작하기

### 1. 의존성 설치

```bash
cd navigator-app
npm install        # postinstall 스크립트가 WASM 파일을 public/에 자동 복사
```

### 2. 모델 파일 준비

```bash
# Python 가상환경 활성화
source .venv/bin/activate       # macOS/Linux
# .venv\Scripts\activate        # Windows

# YOLOv8n → ONNX export
yolo export model=yolov8n.pt format=onnx imgsz=640 simplify=True opset=12

# 모델을 React public 폴더로 이동
mv yolov8n.onnx navigator-app/public/models/
```

> 가상환경이 없으면 먼저 생성:
> ```bash
> python3 -m venv .venv
> source .venv/bin/activate
> pip install ultralytics onnx onnxruntime
> ```

### 3. 개발 서버 실행

```bash
cd navigator-app
npm start          # http://localhost:3000
```

---

## 모델 교체 방법

### 체크포인트(크기) 변경

```bash
# yolov8n (6.2MB) → yolov8s, yolov8m 등으로 교체
yolo export model=yolov8s.pt format=onnx imgsz=640 simplify=True opset=12
mv yolov8s.onnx navigator-app/public/models/
```

`src/utils/yoloDetector.js` 28번째 줄의 `MODEL_PATH`를 변경합니다:

```js
const MODEL_PATH = `${process.env.PUBLIC_URL}/models/yolov8s.onnx`;
```

### YOLOv10 모델 사용

YOLOv10은 end-to-end NMS 출력 형식(`[1, 300, 6]`)이 다릅니다.

```js
// yoloDetector.js
const IS_V10_FORMAT = true;   // false → true 로 변경
```

| 형식 | 출력 shape | 설명 |
|------|-----------|------|
| YOLOv8 | `[1, 84, 8400]` | `cx,cy,w,h + 80 클래스` |
| YOLOv10 | `[1, 300, 6]` | `x1,y1,x2,y2,score,class` (NMS 포함) |

### 커스텀 클래스 모델

전동킥보드 전용 데이터셋으로 학습한 모델을 사용할 때 `TARGET_CLASSES`를 수정합니다:

```js
// yoloDetector.js
const TARGET_CLASSES = new Map([
  [0, '사람'],
  [1, '전동킥보드'],   // 커스텀 모델의 실제 클래스 인덱스
  [2, '자전거'],
  [3, '오토바이'],
]);
```

---

## 탐지 대상 클래스

COCO 데이터셋 기준 (표준 YOLOv8 사용 시):

| COCO 인덱스 | 라벨 | 비고 |
|------------|------|------|
| 0 | 사람 | |
| 1 | 자전거 | |
| 3 | 오토바이/킥보드 | COCO에 전동킥보드 별도 클래스 없음 |

---

## ROI (관심 영역) 설정

보행 경로에 해당하는 화면 중앙 하단 영역을 ROI로 정의합니다.

```
┌──────────────────────────────┐
│                              │
│         카메라 영상           │
│                              │
│  ┌──── ROI (보행 경로) ────┐  │  ← y: 45%
│  │   x: 20% ~ 80%         │  │
│  │   y: 45% ~ 95%         │  │
│  └────────────────────────┘  │  ← y: 95%
└──────────────────────────────┘
```

`src/utils/roiConfig.js`에서 비율 조정 가능:

```js
export const ROI = {
  x: 0.20,   // 좌측 경계
  y: 0.45,   // 상단 경계
  w: 0.60,   // 너비 (x2 = 0.80)
  h: 0.50,   // 높이 (y2 = 0.95)
};
```

ROI 진입 판정 기준:
- bbox 하단 중심점이 ROI 안에 있거나
- bbox 면적의 15% 이상이 ROI와 겹칠 때

---

## 성능 튜닝

| 파라미터 | 위치 | 기본값 | 설명 |
|---------|------|-------|------|
| `INFER_EVERY_N_FRAMES` | `useDetection.js` | 4 | 추론 주기 (낮출수록 빠르나 CPU 사용↑) |
| `CONF_THRESHOLD` | `yoloDetector.js` | 0.30 | 신뢰도 임계값 |
| `IOU_THRESHOLD` | `yoloDetector.js` | 0.45 | NMS IoU 임계값 |
| `VOICE_COOLDOWN_MS` | `App.js` | 4000 | 음성 경고 반복 최소 간격(ms) |
| `numThreads` | `yoloDetector.js` | 1 | WASM 스레드 수 (SharedArrayBuffer 없는 환경에서 1 고정) |

---

## 접근성

- **스크린 리더**: `aria-live="assertive"` — 위험 감지 즉시 읽어줌
- **큰 터치 타깃**: 버튼 최소 높이 60px
- **고대비 색상**: 파랑(`#3b82f6`), 빨강(`#ef4444`) on 어두운 배경
- **포커스 링**: `focus-visible` 노란 외곽선 (`#f59e0b`)
- **음성 안내**: 카메라·모델 상태 변화 전부 TTS로 안내

---

## 라이선스

MIT
