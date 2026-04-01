import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import CameraView from './components/CameraView';
import StatusBar from './components/StatusBar';
import ControlPanel from './components/ControlPanel';
import DetectionOverlay from './components/DetectionOverlay';
import { useCamera } from './hooks/useCamera';
import { useVoice } from './hooks/useVoice';
import { useDetection } from './hooks/useDetection';

const CAMERA_ANNOUNCEMENTS = {
  idle:       '',
  requesting: '카메라 권한을 요청하고 있습니다.',
  active:     '카메라가 연결되었습니다. 내비게이션을 시작합니다.',
  error:      '카메라 연결에 실패했습니다.',
};

/** 연속으로 같은 장애물을 반복 안내하지 않기 위한 쿨다운 (ms) */
const VOICE_COOLDOWN_MS = 4000;

function buildDangerAnnouncement(detections) {
  const inROI = detections.filter((d) => d.inROI);
  if (inROI.length === 0) return null;

  // 클래스별 카운트
  const counts = {};
  for (const d of inROI) {
    counts[d.label] = (counts[d.label] ?? 0) + 1;
  }
  const parts = Object.entries(counts).map(([label, n]) =>
    n > 1 ? `${label} ${n}명` : label
  );
  return `주의! 보행 경로에 ${parts.join(', ')} 있습니다.`;
}

function App() {
  const { videoRef, status, errorMessage, startCamera, stopCamera } = useCamera();
  const { speak, stop: stopSpeech } = useVoice();
  const { detections, modelStatus, modelError } = useDetection({
    videoRef,
    isActive: status === 'active',
  });

  const [announcement, setAnnouncement] = useState('');
  const lastVoiceRef = useRef(0); // 마지막 위험 음성 안내 timestamp

  // 카메라 상태 변화 → 음성 안내
  useEffect(() => {
    const msg = CAMERA_ANNOUNCEMENTS[status];
    if (msg) { setAnnouncement(msg); speak(msg); }
    else setAnnouncement('');
  }, [status, speak]);

  // 모델 로드 완료 → 음성 안내
  useEffect(() => {
    if (modelStatus === 'ready') {
      const msg = '객체 탐지 모델이 준비되었습니다.';
      setAnnouncement(msg);
      speak(msg);
    } else if (modelStatus === 'error') {
      const msg = '객체 탐지 모델을 불러오지 못했습니다.';
      setAnnouncement(msg);
      speak(msg);
    }
  }, [modelStatus, speak]);

  // ROI 내 위험 탐지 → 음성 경고 (쿨다운 적용)
  useEffect(() => {
    const msg = buildDangerAnnouncement(detections);
    if (!msg) return;
    const now = Date.now();
    if (now - lastVoiceRef.current < VOICE_COOLDOWN_MS) return;
    lastVoiceRef.current = now;
    setAnnouncement(msg);
    speak(msg, { rate: 1.1 });
  }, [detections, speak]);

  const handleStop = () => { stopCamera(); stopSpeech(); };

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
          <DetectionOverlay detections={detections} />
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
