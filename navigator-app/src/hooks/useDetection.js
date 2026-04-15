import { useEffect, useRef, useState, useCallback } from 'react';
import { getDetector, detectFrame } from '../utils/yoloDetector';

const INFER_EVERY_N_FRAMES = 4; // ~15fps at 60fps display

/**
 * @param {{ videoRef: React.RefObject, isActive: boolean }} options
 * @returns {{ detections: Detection[], modelStatus: string }}
 */
export function useDetection({ videoRef, isActive }) {
  const [modelStatus, setModelStatus] = useState('loading'); // loading | ready | error
  const [modelError, setModelError]   = useState('');
  const [detections, setDetections]   = useState([]);
  const sessionRef  = useRef(null);
  const rafRef      = useRef(null);
  const frameRef    = useRef(0);
  const runningRef  = useRef(false); // prevent overlapping inference

  // ── 모델 로드 (앱 시작 시 한 번) ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getDetector()
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        console.info('[Detection] 모델 로드 성공, 입력 이름:', session.inputNames, '출력 이름:', session.outputNames);
        setModelStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Detection] 모델 로드 실패:', err);
        setModelError(err.message ?? String(err));
        setModelStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // ── 추론 루프 ──────────────────────────────────────────────────────────────
  const runLoop = useCallback(async () => {
    frameRef.current += 1;

    if (
      frameRef.current % INFER_EVERY_N_FRAMES === 0 &&
      !runningRef.current &&
      sessionRef.current &&
      videoRef.current
    ) {
      runningRef.current = true;
      try {
        const dets = await detectFrame(videoRef.current, sessionRef.current);
        setDetections(dets);
      } catch (e) {
        console.error('[Detection] 추론 에러:', e);
      } finally {
        runningRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [videoRef]);

  useEffect(() => {
    if (!isActive || modelStatus !== 'ready') {
      setDetections([]);
      return;
    }
    frameRef.current = 0;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      setDetections([]);
    };
  }, [isActive, modelStatus, runLoop]);

  return { detections, modelStatus, modelError };
}
