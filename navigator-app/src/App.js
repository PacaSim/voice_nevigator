import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import CameraView from './components/CameraView';
import StatusBar from './components/StatusBar';
import ControlPanel from './components/ControlPanel';
import DetectionOverlay from './components/DetectionOverlay';
import { useCamera } from './hooks/useCamera';
import { useVoice, VOICE_PRIORITY } from './hooks/useVoice';
import { useDetection } from './hooks/useDetection';
import { formatThreat } from './utils/detectionInfo';
import { useVibration } from './hooks/useVibration';
import { useTrafficLight } from './hooks/useTrafficLight';

const CAMERA_ANNOUNCEMENTS = {
  idle:       '',
  requesting: '카메라 권한을 요청하고 있습니다.',
  active:     '카메라가 연결되었습니다. 내비게이션을 시작합니다.',
  error:      '카메라 연결에 실패했습니다.',
};

/** 연속으로 같은 장애물을 반복 안내하지 않기 위한 쿨다운 (ms) */
const VOICE_COOLDOWN_MS = 4000;

// 계단·횡단보도는 위험 진동 없이 안내만
const GUIDE_LABELS = new Set(['계단', '횡단보도']);

function buildDangerAnnouncement(detections) {
  const inROI = detections.filter((d) => d.inROI);
  if (inROI.length === 0) return null;

  const sorted = [...inROI].sort((a, b) => (a.distanceOrder ?? 2) - (b.distanceOrder ?? 2));
  const top = sorted.slice(0, 3);

  const seen = new Set();
  const dangerParts = [];
  const guideParts  = [];
  for (const d of top) {
    const phrase = formatThreat(d.direction ?? '정면', d.distance ?? '멀리', d.label);
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    if (GUIDE_LABELS.has(d.label)) guideParts.push(phrase);
    else dangerParts.push(phrase);
  }

  const parts = [];
  if (dangerParts.length) parts.push(`주의! ${dangerParts.join(', ')}`);
  if (guideParts.length)  parts.push(guideParts.join(', '));
  return parts.length ? parts.join('. ') : null;
}

function hasDangerInROI(detections) {
  return detections.some((d) => d.inROI && !GUIDE_LABELS.has(d.label));
}

function App() {
  const { videoRef, status, errorMessage, startCamera, stopCamera } = useCamera();
  const { speak, stop: stopSpeech } = useVoice();
  const { detections, modelStatus, modelError } = useDetection({
    videoRef,
    isActive: status === 'active',
  });

  const { vibrateForThreat, cancel: cancelVibration } = useVibration(2000);
  const { trafficLight } = useTrafficLight({
    videoRef,
    isActive: status === 'active',
    speak,
  });

  const [announcement, setAnnouncement] = useState('');
  const lastVoiceRef = useRef(0); // 마지막 위험 음성 안내 timestamp

  // 카메라 상태 변화 → 음성 안내
  useEffect(() => {
    const msg = CAMERA_ANNOUNCEMENTS[status];
    if (msg) { setAnnouncement(msg); speak(msg, VOICE_PRIORITY.TRAFFIC); }
    else setAnnouncement('');
  }, [status, speak]);

  // 모델 로드 완료 → 음성 안내
  useEffect(() => {
    if (modelStatus === 'ready') {
      const msg = '객체 탐지 모델이 준비되었습니다.';
      setAnnouncement(msg);
      speak(msg, VOICE_PRIORITY.TRAFFIC);
    } else if (modelStatus === 'error') {
      const msg = '객체 탐지 모델을 불러오지 못했습니다.';
      setAnnouncement(msg);
      speak(msg, VOICE_PRIORITY.TRAFFIC);
    }
  }, [modelStatus, speak]);

  // ROI 내 위험 탐지 → 음성 경고 + 진동 (쿨다운 적용)
  useEffect(() => {
    const msg = buildDangerAnnouncement(detections);
    if (!msg) return;

    // 진동: danger 클래스(계단·횡단보도 제외)만 트리거
    if (hasDangerInROI(detections)) {
      const dangerInROI = detections.filter((d) => d.inROI && !GUIDE_LABELS.has(d.label));
      const closestOrder = Math.min(...dangerInROI.map((d) => d.distanceOrder ?? 2));
      vibrateForThreat(closestOrder);
    }

    // 음성: 4s 쿨다운
    const now = Date.now();
    if (now - lastVoiceRef.current < VOICE_COOLDOWN_MS) return;
    lastVoiceRef.current = now;
    setAnnouncement(msg);
    speak(msg, VOICE_PRIORITY.OBSTACLE, { rate: 1.1 });
  }, [detections, speak, vibrateForThreat]);

  const handleStop = () => { stopCamera(); stopSpeech(); cancelVibration(); };

  const handleRepeatSpeak = () => {
    const inROI = detections.filter((d) => d.inROI);
    const msg = inROI.length > 0
      ? buildDangerAnnouncement(detections)
      : '현재 보행 경로에 장애물이 없습니다.';
    speak(msg);
    setAnnouncement(msg);
  };

  // 상태바에 표시할 모델 배지
  const modelBadge =
    modelStatus === 'loading' ? '모델 로딩 중' :
    modelStatus === 'error'   ? `모델 오류: ${modelError}` : null;

  return (
    <div className="app" role="main">
      <h1 className="sr-only">교통약자 AI 보행 내비게이터</h1>

      {/* 카메라 + 탐지 오버레이 */}
      <div className="app-camera">
        <CameraView
          videoRef={videoRef}
          status={status}
          errorMessage={errorMessage}
          onStart={startCamera}
        />
        {status === 'active' && (
          <DetectionOverlay detections={detections} trafficLight={trafficLight} />
        )}
      </div>

      {/* 하단 UI */}
      <div className="app-bottom">
        <StatusBar
          cameraStatus={status}
          announcement={announcement}
          badge={modelBadge}
        />
        <ControlPanel
          cameraStatus={status}
          onStart={startCamera}
          onStop={handleStop}
          onSpeak={handleRepeatSpeak}
        />
      </div>
    </div>
  );
}

export default App;
