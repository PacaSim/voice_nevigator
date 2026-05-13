import { useEffect, useRef, useState, useTransition } from 'react';
import { getDetector, detectFrame } from '../utils/yoloDetector';

// 추론 완료 후 다음 추론까지의 최소 대기 시간 (ms)
// YOLOv8x는 무거우므로 추론이 끝난 직후 곧바로 재실행하면 UI가 굳음
const INFER_COOLDOWN_MS = 200;

export function useDetection({ videoRef, isActive }) {
  const [modelStatus, setModelStatus] = useState('loading');
  const [modelError,  setModelError]  = useState('');
  const [detections,  setDetections]  = useState([]);
  const [, startTransition]           = useTransition();

  const sessionRef = useRef(null);
  const timerRef   = useRef(null);
  const activeRef  = useRef(false);
  const runningRef = useRef(false);

  // 모델 로드 (앱 시작 시 한 번)
  useEffect(() => {
    let cancelled = false;
    getDetector()
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        console.info('[Detection] 모델 로드 성공');
        setModelStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setModelError(err.message ?? String(err));
        setModelStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // 추론 루프 — setTimeout 기반, 추론 완료 후 다음 스케줄
  useEffect(() => {
    if (!isActive || modelStatus !== 'ready') {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      setDetections([]);
      return;
    }

    activeRef.current = true;

    const schedule = () => {
      if (!activeRef.current) return;
      timerRef.current = setTimeout(runOnce, INFER_COOLDOWN_MS);
    };

    const runOnce = async () => {
      if (!activeRef.current) return;
      if (runningRef.current || !sessionRef.current || !videoRef.current) {
        schedule();
        return;
      }

      runningRef.current = true;
      try {
        const dets = await detectFrame(videoRef.current, sessionRef.current);
        if (activeRef.current) {
          startTransition(() => setDetections(dets));
        }
      } catch (e) {
        console.error('[Detection] 추론 에러:', e);
      } finally {
        runningRef.current = false;
        schedule();
      }
    };

    runOnce();

    return () => {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      setDetections([]);
    };
  }, [isActive, modelStatus, videoRef, startTransition]);

  return { detections, modelStatus, modelError };
}
