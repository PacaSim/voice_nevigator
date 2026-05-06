import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeTrafficLight } from '../utils/trafficLightDetector';
import { VOICE_PRIORITY } from './useVoice';

const ANALYZE_EVERY_N_FRAMES = 8;  // ~7fps (60fps 기준)
const ANNOUNCE_COOLDOWN_MS   = 5000;

const STATE_MESSAGES = {
  red:   '신호등 빨간불입니다. 멈추세요.',
  green: '신호등 초록불입니다. 건너도 됩니다.',
};

/**
 * @param {{ videoRef, isActive, speak }} options
 * @returns {{ trafficLight: { state: string } | null }}
 */
export function useTrafficLight({ videoRef, isActive, speak }) {
  const [trafficLight, setTrafficLight]   = useState(null);
  const rafRef          = useRef(null);
  const frameRef        = useRef(0);
  const lastAnnounceRef = useRef({ state: null, time: 0 });

  const runLoop = useCallback(() => {
    frameRef.current += 1;

    if (frameRef.current % ANALYZE_EVERY_N_FRAMES === 0 && videoRef.current) {
      const state = analyzeTrafficLight(videoRef.current);
      setTrafficLight(state === 'unknown' ? null : { state });

      if (state !== 'unknown') {
        const { state: lastState, time } = lastAnnounceRef.current;
        const now = Date.now();
        if (state !== lastState || now - time > ANNOUNCE_COOLDOWN_MS) {
          const msg = STATE_MESSAGES[state];
          if (msg) {
            speak(msg, VOICE_PRIORITY.TRAFFIC, { rate: 1.05 });
            lastAnnounceRef.current = { state, time: now };
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [videoRef, speak]);

  useEffect(() => {
    if (!isActive) {
      setTrafficLight(null);
      return;
    }
    frameRef.current = 0;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      setTrafficLight(null);
    };
  }, [isActive, runLoop]);

  return { trafficLight };
}
