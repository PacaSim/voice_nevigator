import { useCallback, useEffect, useRef } from 'react';

/**
 * 음성 우선순위 — 숫자가 낮을수록 높은 우선순위
 *   OBSTACLE: 장애물 경고 (최우선)
 *   TRAFFIC:  신호등 안내
 */
export const VOICE_PRIORITY = {
  OBSTACLE: 0,
  TRAFFIC:  1,
};

export function useVoice() {
  const synthRef         = useRef(window.speechSynthesis);
  const queueRef         = useRef([]);   // { text, priority, options }[]
  const currentPriRef    = useRef(null); // 현재 재생 중인 항목의 우선순위 (null = 미재생)

  // Chrome 모바일 버그: 15초 후 자동 paused → 주기적으로 resume
  useEffect(() => {
    const id = setInterval(() => {
      if (synthRef.current?.paused) synthRef.current.resume();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // 큐에서 다음 항목을 꺼내 재생
  const playNext = useCallback(() => {
    const synth = synthRef.current;
    if (!synth || queueRef.current.length === 0) {
      currentPriRef.current = null;
      return;
    }

    queueRef.current.sort((a, b) => a.priority - b.priority);
    const next = queueRef.current.shift();
    currentPriRef.current = next.priority;

    const utter        = new SpeechSynthesisUtterance(next.text);
    utter.lang         = next.options.lang  ?? 'ko-KR';
    utter.rate         = next.options.rate  ?? 1;
    utter.pitch        = next.options.pitch ?? 1;
    utter.onend        = () => { currentPriRef.current = null; playNext(); };
    utter.onerror      = () => { currentPriRef.current = null; playNext(); };

    synth.resume(); // Chrome 모바일: cancel() 후 paused 상태 해제
    synth.speak(utter);
  }, []);

  /**
   * @param {string} text
   * @param {number} priority  VOICE_PRIORITY 상수 (기본: TRAFFIC)
   * @param {{ rate?, pitch?, lang? }} options
   */
  const speak = useCallback((text, priority = VOICE_PRIORITY.TRAFFIC, options = {}) => {
    const synth = synthRef.current;
    if (!synth) return;

    // 동일 우선순위 기존 항목은 최신 것으로 교체
    queueRef.current = queueRef.current.filter(q => q.priority !== priority);
    queueRef.current.push({ text, priority, options });

    const cur = currentPriRef.current;

    if (cur === null) {
      // 아무것도 재생 중이 아님 → 즉시 시작
      playNext();
    } else if (priority < cur) {
      // 현재 재생보다 높은 우선순위 → 즉시 중단 후 재생
      // Chrome 버그: cancel() 직후 speak() 하면 무시됨 → setTimeout으로 한 틱 뒤에 실행
      currentPriRef.current = null;
      synth.cancel();
      setTimeout(playNext, 0);
    }
    // 같거나 낮은 우선순위 → 큐에서 대기 (현재 재생 끝나면 onend → playNext 호출)
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current      = [];
    currentPriRef.current = null;
    synthRef.current?.cancel();
  }, []);

  return { speak, stop };
}
